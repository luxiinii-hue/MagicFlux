/**
 * Full layer system per MTG Comprehensive Rules 613.
 *
 * Continuous effects are applied in layer order. Within a layer, effects
 * are applied in timestamp order (unless dependency applies).
 *
 * Layers:
 * 1. Copy effects
 * 2. Control-changing effects
 * 3. Text-changing effects
 * 4. Type-changing effects
 * 5. Color-changing effects
 * 6. Ability-adding/removing effects
 * 7. Power/toughness modifications
 *    7a: Characteristic-defining abilities (CDA)
 *    7b: Setting P/T to a specific value
 *    7c: Modifications from non-counter sources (+1/+1 from enchantments)
 *    7d: Counter modifications (+1/+1 counters, -1/-1 counters)
 *    7e: Switching power and toughness
 *
 * This module evaluates all active ContinuousEffects on the GameState
 * and produces updated CardInstance values. It does NOT mutate — returns
 * a new GameState with recalculated derived values.
 */

import type {
  GameState,
  CardInstance,
  ContinuousEffect,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { cardHasKeyword } from "../combat/keywords.js";

// ---------------------------------------------------------------------------
// Layer constants
// ---------------------------------------------------------------------------

const LAYER_ORDER = [1, 2, 3, 4, 5, 6, 7] as const;
const SUBLAYER_7_ORDER = ["a", "b", "c", "d", "e"] as const;

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Recalculate all derived values on CardInstances by applying continuous
 * effects in layer order. Call this whenever the board state changes
 * (after SBAs, after resolution, after zone transfers).
 *
 * Returns a new GameState with updated modifiedPower/modifiedToughness
 * and any ability modifications from layer 6.
 */
export function applyLayerSystem(state: GameState): GameState {
  // Collect all active continuous effects
  const effects = getActiveEffects(state);

  // Sort by layer, sublayer, then timestamp
  const sorted = sortEffects(effects);

  // Start with base values for all battlefield creatures
  let updatedCards = resetDerivedValues(state);

  // Apply effects in layer order
  for (const effect of sorted) {
    updatedCards = applyEffect(state, updatedCards, effect);
  }

  // Apply counter-based P/T (layer 7d) — always from the card's own counters
  updatedCards = applyCounterPT(updatedCards);

  return {
    ...state,
    cardInstances: updatedCards,
  };
}

// ---------------------------------------------------------------------------
// Active effect collection
// ---------------------------------------------------------------------------

/** Get all currently active continuous effects. */
function getActiveEffects(state: GameState): ContinuousEffect[] {
  const active: ContinuousEffect[] = [];

  // Effects from GameState.continuousEffects (from resolved spells, etc.)
  for (const effect of state.continuousEffects) {
    if (isEffectActive(state, effect)) {
      active.push(effect);
    }
  }

  // Static abilities from permanents on the battlefield generate implicit effects
  const bf = state.zones["battlefield"];
  if (bf) {
    for (const cardId of bf.cardInstanceIds) {
      const card = state.cardInstances[cardId];
      if (!card) continue;

      for (const ability of card.abilities) {
        if (ability.type === "static" && ability.continuousEffect) {
          active.push({
            id: `static_${cardId}_${ability.id}`,
            sourceCardInstanceId: cardId,
            effect: ability.continuousEffect.modification,
            affectedFilter: ability.continuousEffect.affectedFilter,
            duration: "whileSourceOnBattlefield",
            layer: ability.layer,
            subLayer: ability.layer === 7 ? "c" : null,
            timestamp: 0, // Static abilities have no timestamp ordering among themselves
            dependsOn: [],
          });
        }
      }
    }
  }

  return active;
}

/** Check if an effect is still active based on its duration. */
function isEffectActive(state: GameState, effect: ContinuousEffect): boolean {
  switch (effect.duration) {
    case "whileSourceOnBattlefield": {
      const source = state.cardInstances[effect.sourceCardInstanceId];
      return !!source && source.zone === ZoneType.Battlefield;
    }
    case "endOfTurn":
    case "untilYourNextTurn":
    case "permanent":
      return true; // Cleanup handles endOfTurn removal
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Effect sorting
// ---------------------------------------------------------------------------

function sortEffects(effects: ContinuousEffect[]): ContinuousEffect[] {
  return [...effects].sort((a, b) => {
    // Sort by layer first
    if (a.layer !== b.layer) return a.layer - b.layer;

    // Within layer 7, sort by sublayer
    if (a.layer === 7 && a.subLayer && b.subLayer) {
      const aIdx = SUBLAYER_7_ORDER.indexOf(a.subLayer as any);
      const bIdx = SUBLAYER_7_ORDER.indexOf(b.subLayer as any);
      if (aIdx !== bIdx) return aIdx - bIdx;
    }

    // Within same layer+sublayer, sort by timestamp
    return a.timestamp - b.timestamp;
  });
}

// ---------------------------------------------------------------------------
// Base value reset
// ---------------------------------------------------------------------------

/**
 * Reset derived values to base values for all battlefield creatures.
 * Base P/T comes from the card's printed values (stored on CardData,
 * but we use the initial values set during instantiation).
 *
 * For Phase 5, we track base values separately from modified values.
 * The base values are whatever was set at instantiation time.
 */
function resetDerivedValues(
  state: GameState,
): Record<string, CardInstance> {
  const updated = { ...state.cardInstances };

  for (const [id, card] of Object.entries(updated)) {
    if (card.zone !== ZoneType.Battlefield) continue;
    if (card.basePower === null && card.baseToughness === null) continue;

    // Reset modifiedPower/modifiedToughness to base values.
    // The layer system will then reapply all continuous effects on top.
    updated[id] = {
      ...card,
      modifiedPower: card.basePower,
      modifiedToughness: card.baseToughness,
    };
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Effect application per layer
// ---------------------------------------------------------------------------

function applyEffect(
  state: GameState,
  cards: Record<string, CardInstance>,
  effect: ContinuousEffect,
): Record<string, CardInstance> {
  const mod = effect.effect as Record<string, any>;
  const filter = effect.affectedFilter;

  switch (effect.layer) {
    case 1:
      return applyLayer1(state, cards, effect, mod, filter);
    case 2:
      return applyLayer2(state, cards, effect, mod, filter);
    case 3:
      return applyLayer3(state, cards, effect, mod, filter);
    case 4:
      return applyLayer4(state, cards, effect, mod, filter);
    case 5:
      return applyLayer5(state, cards, effect, mod, filter);
    case 6:
      return applyLayer6(state, cards, effect, mod, filter);
    case 7:
      return applyLayer7(state, cards, effect, mod, filter);
    default:
      return cards;
  }
}

/**
 * Layer 1: Copy effects.
 * When a permanent enters as a copy (Clone, Phantasmal Image), its copiable
 * values are set to the original's. This is the base for all other layers.
 * Copy effects are handled during resolution (copyPermanent in copy.ts),
 * not during layer evaluation — by the time we get here, the copy's values
 * are already set. This layer handles ongoing copy effects that might change
 * what something is a copy of.
 */
function applyLayer1(
  _state: GameState,
  cards: Record<string, CardInstance>,
  _effect: ContinuousEffect,
  mod: Record<string, any>,
  _filter: any,
): Record<string, CardInstance> {
  // Copy effects that change what a permanent is a copy of.
  // For now, initial copy is handled by copyPermanent at resolution time.
  // Ongoing "becomes a copy" effects would be handled here.
  if (mod.copyOf) {
    const targetId = mod.targetId as string;
    const originalId = mod.copyOf as string;
    const original = cards[originalId];
    const target = cards[targetId];
    if (original && target) {
      return {
        ...cards,
        [targetId]: {
          ...target,
          cardDataId: original.cardDataId,
          abilities: [...original.abilities],
          modifiedPower: original.basePower,
          modifiedToughness: original.baseToughness,
          basePower: original.basePower,
          baseToughness: original.baseToughness,
          currentLoyalty: original.currentLoyalty,
        },
      };
    }
  }
  return cards;
}

/**
 * Layer 2: Control-changing effects.
 * Mind Control, Treachery, Act of Treason — change who controls a permanent.
 */
function applyLayer2(
  state: GameState,
  cards: Record<string, CardInstance>,
  effect: ContinuousEffect,
  mod: Record<string, any>,
  filter: any,
): Record<string, CardInstance> {
  if (mod.changeController) {
    const targetId = mod.targetId as string;
    const newControllerId = mod.newController as string;
    const card = cards[targetId];
    if (card && card.zone === ZoneType.Battlefield) {
      return {
        ...cards,
        [targetId]: { ...card, controller: newControllerId },
      };
    }
  }
  return cards;
}

/**
 * Layer 3: Text-changing effects.
 * Very rare (Slight of Mind, Sleight of Mind). Changes text of cards.
 * Stub for now — not needed for standard gameplay.
 */
function applyLayer3(
  _state: GameState,
  cards: Record<string, CardInstance>,
  _effect: ContinuousEffect,
  _mod: Record<string, any>,
  _filter: any,
): Record<string, CardInstance> {
  return cards;
}

/**
 * Layer 4: Type-changing effects.
 * Blood Moon (nonbasic lands become Mountains), land animation
 * (Mutavault becomes a creature until end of turn).
 */
function applyLayer4(
  state: GameState,
  cards: Record<string, CardInstance>,
  effect: ContinuousEffect,
  mod: Record<string, any>,
  filter: any,
): Record<string, CardInstance> {
  const affected = findAffectedCards(state, cards, effect, filter);
  let updated = cards;

  for (const cardId of affected) {
    const card = updated[cardId];
    if (!card) continue;

    // Animate land: give it P/T (becomes a creature)
    if (mod.animate) {
      const power = mod.animate.power as number ?? 0;
      const toughness = mod.animate.toughness as number ?? 0;
      updated = {
        ...updated,
        [cardId]: {
          ...card,
          modifiedPower: power,
          modifiedToughness: toughness,
          basePower: power,
          baseToughness: toughness,
        },
      };
    }

    // Type overwrite: e.g., Blood Moon makes nonbasic lands into Mountains
    if (mod.setLandType) {
      // This would change the card's subtypes and mana production.
      // Simplified: update cardDataId to reflect the new type.
      updated = {
        ...updated,
        [cardId]: {
          ...card,
          cardDataId: mod.setLandType as string,
        },
      };
    }
  }

  return updated;
}

/**
 * Layer 5: Color-changing effects.
 * Painter's Servant, Moonlace — change a permanent's colors.
 * Rare in normal gameplay. Stub for now.
 */
function applyLayer5(
  _state: GameState,
  cards: Record<string, CardInstance>,
  _effect: ContinuousEffect,
  _mod: Record<string, any>,
  _filter: any,
): Record<string, CardInstance> {
  return cards;
}

/**
 * Layer 6: Ability adding/removing.
 * Handles: granting keywords, removing abilities.
 */
function applyLayer6(
  state: GameState,
  cards: Record<string, CardInstance>,
  effect: ContinuousEffect,
  mod: Record<string, any>,
  filter: any,
): Record<string, CardInstance> {
  // effectType-based keyword granting is handled by cardHasKeyword
  // which checks individual card abilities. Global effects that grant
  // keywords to matching creatures would be handled here.

  if (mod.keywords && Array.isArray(mod.keywords)) {
    const affected = findAffectedCards(state, cards, effect, filter);
    let updated = cards;

    for (const cardId of affected) {
      const card = updated[cardId];
      if (!card) continue;

      // Add keyword static abilities to the card
      for (const keyword of mod.keywords as string[]) {
        const hasIt = cardHasKeyword(card, keyword.toLowerCase());
        if (!hasIt) {
          const kwAbility = {
            id: `granted_${effect.id}_${keyword}`,
            type: "static" as const,
            sourceCardInstanceId: effect.sourceCardInstanceId,
            effects: [],
            zones: [ZoneType.Battlefield],
            continuousEffect: {
              effectType: keyword.toLowerCase(),
              affectedFilter: {},
              modification: {},
            },
            condition: null,
            layer: 6,
          };
          updated = {
            ...updated,
            [cardId]: {
              ...card,
              abilities: [...card.abilities, kwAbility],
            },
          };
        }
      }
    }

    return updated;
  }

  return cards;
}

/**
 * Layer 7: Power/toughness modifications.
 * Handles sublayers 7a-7e.
 */
function applyLayer7(
  state: GameState,
  cards: Record<string, CardInstance>,
  effect: ContinuousEffect,
  mod: Record<string, any>,
  filter: any,
): Record<string, CardInstance> {
  const powerMod = mod.power as number | undefined;
  const toughnessMod = mod.toughness as number | undefined;

  if (powerMod === undefined && toughnessMod === undefined) return cards;

  const affected = findAffectedCards(state, cards, effect, filter);
  let updated = cards;

  for (const cardId of affected) {
    const card = updated[cardId];
    if (!card || card.modifiedPower === null) continue;

    // If this is a targeted effect (has targetId in mod), only affect that card
    if (mod.targetId && mod.targetId !== cardId) continue;

    updated = {
      ...updated,
      [cardId]: {
        ...card,
        modifiedPower: card.modifiedPower + (powerMod ?? 0),
        modifiedToughness: (card.modifiedToughness ?? 0) + (toughnessMod ?? 0),
      },
    };
  }

  return updated;
}

/** Apply +1/+1 and -1/-1 counter modifications (layer 7d). */
function applyCounterPT(cards: Record<string, CardInstance>): Record<string, CardInstance> {
  // Counter-based P/T is already applied when counters are added/removed
  // in resolution.ts. This function is a placeholder for when we have
  // proper base value tracking and need to recalculate from scratch.
  return cards;
}

// ---------------------------------------------------------------------------
// Affected card selection
// ---------------------------------------------------------------------------

/**
 * Find which cards on the battlefield are affected by a continuous effect.
 */
function findAffectedCards(
  state: GameState,
  cards: Record<string, CardInstance>,
  effect: ContinuousEffect,
  filter: any,
): string[] {
  const bf = state.zones["battlefield"];
  if (!bf) return [];

  const sourceCard = cards[effect.sourceCardInstanceId];
  const controllerId = sourceCard?.controller;

  return bf.cardInstanceIds.filter((cardId) => {
    const card = cards[cardId];
    if (!card) return false;

    // "self: false" means don't affect the source itself (anthem pattern)
    if (filter?.self === false && cardId === effect.sourceCardInstanceId) {
      return false;
    }

    // "self: true" means only affect the source
    if (filter?.self === true && cardId !== effect.sourceCardInstanceId) {
      return false;
    }

    // Controller filter
    if (filter?.controller === "you" && card.controller !== controllerId) return false;
    if (filter?.controller === "opponent" && card.controller === controllerId) return false;

    // Card type filter
    if (filter?.cardTypes && filter.cardTypes.length > 0) {
      const isCreature = card.modifiedPower !== null;
      if (filter.cardTypes.includes("Creature") && !isCreature) return false;
    }

    // Custom filters (e.g., "equipped_creature" for equipment)
    if (filter?.custom === "equipped_creature") {
      const equipment = cards[effect.sourceCardInstanceId];
      return equipment?.attachedTo === cardId;
    }

    return true;
  });
}
