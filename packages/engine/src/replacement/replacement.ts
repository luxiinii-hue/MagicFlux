/**
 * Replacement effect system — CR 614 "instead" semantics.
 *
 * Before certain game events happen, this module checks all active
 * replacement effects. If one matches, the replacement is applied
 * instead of (or in addition to) the original event.
 *
 * Key replacement patterns:
 * - Zone change: "If a card would be put into a graveyard, exile it instead" (Rest in Peace)
 * - Damage prevention: "Prevent the next N damage" (Fog, Circle of Protection)
 * - Amount modification: "If you would create tokens, create twice that many" (Doubling Season)
 * - Additional effect: "If a creature would die, also do X"
 *
 * Each replacement effect can only apply once per event (CR 614.5)
 * to prevent infinite loops.
 */

import type {
  GameState,
  GameEvent,
  ReplacementEffect,
  CardInstance,
  GameEventType,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

// ---------------------------------------------------------------------------
// Replacement check — called before events are applied
// ---------------------------------------------------------------------------

/**
 * Check if any active replacement effects match a pending zone transfer.
 * Returns the modified destination zone if a replacement applies, or
 * null if no replacement matches.
 *
 * This is the primary hook for "exile instead of graveyard" effects.
 */
export function checkZoneChangeReplacement(
  state: GameState,
  cardInstanceId: string,
  fromZone: string,
  toZone: string,
): { replacedToZone: string; appliedEffectId: string } | null {
  const card = state.cardInstances[cardInstanceId];
  if (!card) return null;

  for (const effect of state.replacementEffects) {
    if (!isReplacementActive(state, effect)) continue;
    if (!matchesEventType(effect, "cardEnteredZone")) continue;

    // Self-only check
    if (effect.self && effect.sourceCardInstanceId !== cardInstanceId) continue;

    // Check filter
    if (effect.filter && !matchesReplacementFilter(card, effect)) continue;

    // Apply the replacement
    if (effect.replacementAction.type === "changeZone") {
      const action = effect.replacementAction;
      // Check if the original destination matches what this replacement intercepts
      if (toZone.includes(action.fromZone.toString().toLowerCase())) {
        // Map the zone type to a zone key
        const newZoneKey = getZoneKeyForType(action.toZone, card.owner);
        if (newZoneKey) {
          return { replacedToZone: newZoneKey, appliedEffectId: effect.id };
        }
      }
    }
  }

  return null;
}

/**
 * Check if any replacement effects modify damage amount.
 * Returns the modified amount, or the original if no replacement applies.
 */
export function checkDamageReplacement(
  state: GameState,
  sourceInstanceId: string,
  targetId: string,
  amount: number,
): { amount: number; prevented: boolean } {
  let currentAmount = amount;
  let prevented = false;

  for (const effect of state.replacementEffects) {
    if (!isReplacementActive(state, effect)) continue;
    if (!matchesEventType(effect, "damageDealt")) continue;

    if (effect.replacementAction.type === "preventDamage") {
      const preventAmount = resolvePreventAmount(effect.replacementAction.amount);
      currentAmount = Math.max(0, currentAmount - preventAmount);
      if (currentAmount === 0) {
        prevented = true;
        break;
      }
    } else if (effect.replacementAction.type === "modifyAmount") {
      const action = effect.replacementAction;
      if (action.multiplier !== undefined) {
        currentAmount = Math.floor(currentAmount * action.multiplier);
      }
      if (action.addition !== undefined) {
        currentAmount += action.addition;
      }
    }
  }

  return { amount: currentAmount, prevented };
}

/**
 * Check if any replacement effects modify token/counter creation amounts.
 * Used by Doubling Season, Parallel Lives, etc.
 */
export function checkAmountReplacement(
  state: GameState,
  eventType: GameEventType,
  controllerId: string,
  amount: number,
): number {
  let currentAmount = amount;

  for (const effect of state.replacementEffects) {
    if (!isReplacementActive(state, effect)) continue;
    if (!matchesEventType(effect, eventType)) continue;

    if (effect.replacementAction.type === "modifyAmount") {
      const action = effect.replacementAction;
      if (action.multiplier !== undefined) {
        currentAmount = Math.floor(currentAmount * action.multiplier);
      }
      if (action.addition !== undefined) {
        currentAmount += action.addition;
      }
    }
  }

  return currentAmount;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isReplacementActive(state: GameState, effect: ReplacementEffect): boolean {
  switch (effect.duration) {
    case "whileSourceOnBattlefield": {
      const source = state.cardInstances[effect.sourceCardInstanceId];
      return !!source && source.zone === ZoneType.Battlefield;
    }
    case "endOfTurn":
    case "permanent":
      return true;
    default:
      return true;
  }
}

function matchesEventType(effect: ReplacementEffect, eventType: GameEventType): boolean {
  if (Array.isArray(effect.eventType)) {
    return effect.eventType.includes(eventType);
  }
  return effect.eventType === eventType;
}

function matchesReplacementFilter(card: CardInstance, effect: ReplacementEffect): boolean {
  if (!effect.filter) return true;

  // Card type check
  if (effect.filter.cardTypes && effect.filter.cardTypes.length > 0) {
    const isCreature = card.modifiedPower !== null;
    if (effect.filter.cardTypes.includes("Creature") && !isCreature) return false;
  }

  return true;
}

function resolvePreventAmount(amount: number | { countOf: any } | { variable: string }): number {
  if (typeof amount === "number") return amount;
  // Dynamic amounts not supported for prevention yet
  return 0;
}

function getZoneKeyForType(zoneType: any, ownerId: string): string | null {
  const zt = String(zoneType);
  switch (zt) {
    case "Exile": return "exile";
    case "Battlefield": return "battlefield";
    case "Graveyard": return `player:${ownerId}:graveyard`;
    case "Hand": return `player:${ownerId}:hand`;
    case "Library": return `player:${ownerId}:library`;
    default: return null;
  }
}

/**
 * Add a replacement effect to the game state.
 */
export function addReplacementEffect(
  state: GameState,
  effect: ReplacementEffect,
): GameState {
  return {
    ...state,
    replacementEffects: [...state.replacementEffects, effect],
  };
}

/**
 * Remove replacement effects from a source that left the battlefield.
 */
export function removeReplacementEffectsFromSource(
  state: GameState,
  sourceCardInstanceId: string,
): GameState {
  return {
    ...state,
    replacementEffects: state.replacementEffects.filter(
      (e) => e.sourceCardInstanceId !== sourceCardInstanceId ||
        e.duration !== "whileSourceOnBattlefield",
    ),
  };
}
