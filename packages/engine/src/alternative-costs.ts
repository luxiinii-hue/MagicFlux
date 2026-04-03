/**
 * Alternative and additional cost mechanics: kicker, flashback.
 *
 * Kicker: optional additional cost. If paid, the spell has enhanced effects.
 * Effects check CastingChoices.kickerPaid to determine behavior.
 *
 * Flashback: cast a spell from the graveyard instead of hand. After
 * resolution (or leaving the stack for any reason), exile it instead
 * of putting it in the graveyard.
 */

import type {
  GameState,
  GameEvent,
  CardInstance,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { moveCard, graveyardKey } from "./zones/transfers.js";

/**
 * Check if a card can be cast with flashback from the graveyard.
 * The card needs an ability with alternativeCost "flashback" defined.
 */
export function canCastWithFlashback(
  state: GameState,
  cardInstanceId: string,
  playerId: string,
): boolean {
  const card = state.cardInstances[cardInstanceId];
  if (!card) return false;

  // Must be in the graveyard
  const gKey = graveyardKey(playerId);
  const graveyard = state.zones[gKey];
  if (!graveyard || !graveyard.cardInstanceIds.includes(cardInstanceId)) {
    return false;
  }

  // Must have a spell ability (castable)
  return card.abilities.some((a) => a.type === "spell");
}

/**
 * After a flashback spell leaves the stack (resolves, is countered, or
 * fizzles), exile it instead of putting it in the graveyard.
 *
 * This should be called by the stack resolution system when it detects
 * the spell was cast with flashback (CastingChoices.alternativeCostUsed === "flashback").
 */
export function exileFlashbackSpell(
  state: GameState,
  cardInstanceId: string,
): { state: GameState; events: GameEvent[] } {
  const card = state.cardInstances[cardInstanceId];
  if (!card) return { state, events: [] };

  // Find the card's current zone
  for (const [key, zone] of Object.entries(state.zones)) {
    if (zone.cardInstanceIds.includes(cardInstanceId)) {
      if (zone.type === ZoneType.Exile) {
        return { state, events: [] }; // Already exiled
      }
      return moveCard(state, cardInstanceId, key, "exile", Date.now());
    }
  }

  return { state, events: [] };
}
