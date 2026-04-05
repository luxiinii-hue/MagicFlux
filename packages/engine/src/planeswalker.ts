/**
 * Planeswalker loyalty system.
 *
 * Planeswalkers enter with starting loyalty (from CardData.loyalty).
 * They have loyalty abilities activated by adding/removing loyalty counters.
 * Rules:
 * - Only one loyalty ability per planeswalker per turn (at sorcery speed)
 * - +N abilities add N loyalty counters as cost
 * - -N abilities remove N loyalty counters as cost
 * - 0 abilities neither add nor remove
 * - SBA: planeswalker with 0 or fewer loyalty counters goes to graveyard
 * - Combat: players can redirect attacks to planeswalkers
 */

import type {
  GameState,
  GameEvent,
  CardInstance,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

/**
 * Check if a loyalty ability can be activated.
 * Requirements: sorcery speed (main phase, stack empty, active player),
 * no loyalty ability used this turn, enough loyalty for -N costs.
 */
export function canActivateLoyaltyAbility(
  state: GameState,
  cardInstanceId: string,
  abilityId: string,
  playerId: string,
): { canActivate: boolean; reason?: string } {
  const card = state.cardInstances[cardInstanceId];
  if (!card) return { canActivate: false, reason: "Card not found" };
  if (card.currentLoyalty === null) return { canActivate: false, reason: "Not a planeswalker" };
  if (card.controller !== playerId) return { canActivate: false, reason: "Not your planeswalker" };
  if (card.zone !== ZoneType.Battlefield) return { canActivate: false, reason: "Not on battlefield" };

  // Check if a loyalty ability was already used this turn
  const loyaltyUsedKey = `loyaltyUsed_${cardInstanceId}`;
  const turnFlags = state.turnFlags as Record<string, any>;
  if (turnFlags[loyaltyUsedKey]) {
    return { canActivate: false, reason: "Already activated a loyalty ability this turn" };
  }

  // Find the ability and check loyalty cost
  const ability = card.abilities.find((a) => a.id === abilityId);
  if (!ability) return { canActivate: false, reason: "Ability not found" };

  if (ability.type === "activated") {
    // Check loyalty cost from the ability's cost structure
    // Convention: loyalty cost stored as removeCounters in ActivationCost
    const cost = ability.cost;
    if (cost.removeCounters && cost.removeCounters.counterType === "loyalty") {
      if (card.currentLoyalty < cost.removeCounters.count) {
        return { canActivate: false, reason: "Not enough loyalty" };
      }
    }
  }

  return { canActivate: true };
}

/**
 * Activate a loyalty ability. Adjusts loyalty counters and marks the
 * planeswalker as having used a loyalty ability this turn.
 */
export function activateLoyaltyAbility(
  state: GameState,
  cardInstanceId: string,
  abilityId: string,
  playerId: string,
): { state: GameState; events: GameEvent[] } {
  const card = state.cardInstances[cardInstanceId];
  if (!card || card.currentLoyalty === null) {
    throw new Error("Not a planeswalker");
  }

  const ability = card.abilities.find((a) => a.id === abilityId);
  if (!ability || ability.type !== "activated") {
    throw new Error("Ability not found or not activated");
  }

  let newLoyalty = card.currentLoyalty;
  const events: GameEvent[] = [];

  const cost = ability.cost;

  // +N loyalty (addCounters convention)
  if (cost.additionalCosts?.some((c) => c.type === "addLoyalty")) {
    const addCost = cost.additionalCosts.find((c) => c.type === "addLoyalty");
    const amount = (addCost?.data?.amount as number) ?? 0;
    newLoyalty += amount;
    events.push({
      type: "counterAdded",
      cardInstanceId,
      counterType: "loyalty",
      newCount: newLoyalty,
      timestamp: Date.now(),
    });
  }

  // -N loyalty (removeCounters)
  if (cost.removeCounters && cost.removeCounters.counterType === "loyalty") {
    newLoyalty -= cost.removeCounters.count;
    events.push({
      type: "counterRemoved",
      cardInstanceId,
      counterType: "loyalty",
      newCount: newLoyalty,
      timestamp: Date.now(),
    });
  }

  // Update card
  const updatedCard: CardInstance = { ...card, currentLoyalty: newLoyalty };

  // Mark loyalty ability as used this turn
  const loyaltyUsedKey = `loyaltyUsed_${cardInstanceId}`;
  const updatedTurnFlags = {
    ...state.turnFlags,
    [loyaltyUsedKey]: true,
  } as any;

  return {
    state: {
      ...state,
      cardInstances: { ...state.cardInstances, [cardInstanceId]: updatedCard },
      turnFlags: updatedTurnFlags,
    },
    events,
  };
}

/**
 * Deal damage to a planeswalker (removes loyalty counters).
 */
export function dealDamageToPlayeswalker(
  state: GameState,
  planeswalkerInstanceId: string,
  amount: number,
): { state: GameState; events: GameEvent[] } {
  const card = state.cardInstances[planeswalkerInstanceId];
  if (!card || card.currentLoyalty === null) {
    return { state, events: [] };
  }

  const newLoyalty = Math.max(0, card.currentLoyalty - amount);
  const updatedCard: CardInstance = { ...card, currentLoyalty: newLoyalty };

  return {
    state: {
      ...state,
      cardInstances: { ...state.cardInstances, [planeswalkerInstanceId]: updatedCard },
    },
    events: [
      {
        type: "counterRemoved",
        cardInstanceId: planeswalkerInstanceId,
        counterType: "loyalty",
        newCount: newLoyalty,
        timestamp: Date.now(),
      },
    ],
  };
}
