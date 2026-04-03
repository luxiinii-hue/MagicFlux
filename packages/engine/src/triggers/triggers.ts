/**
 * Triggered ability checking.
 *
 * Given a list of events, scans all cards in the game for triggered abilities
 * that match. Returns StackItems for any that trigger.
 *
 * Phase 2: basic implementation — deterministic ordering by instanceId.
 * Player-ordered triggers (APNAP with choice) are a Phase 4 feature.
 */

import type {
  GameState,
  GameEvent,
  StackItem,
  CardInstance,
  SpellAbilityTriggered,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

/**
 * Check all triggered abilities in the game against a list of events.
 * Returns StackItems for any that trigger, ordered deterministically
 * by source instanceId (APNAP ordering deferred to Phase 4).
 */
export function checkTriggeredAbilities(
  state: GameState,
  events: readonly GameEvent[],
): StackItem[] {
  const triggeredItems: StackItem[] = [];

  if (events.length === 0) return triggeredItems;

  // Scan all card instances for triggered abilities
  for (const [instanceId, card] of Object.entries(state.cardInstances)) {
    for (const ability of card.abilities) {
      if (ability.type !== "triggered") continue;

      const triggered = ability as SpellAbilityTriggered;

      // Check if this ability functions from the card's current zone
      if (!triggered.zones.includes(card.zone)) continue;

      // Check if any event matches the trigger condition
      for (const event of events) {
        if (matchesTrigger(state, card, triggered, event)) {
          const stackItem: StackItem = {
            id: `trigger_${instanceId}_${ability.id}_${Date.now()}`,
            sourceCardInstanceId: instanceId,
            ability: triggered,
            controller: card.controller,
            targets: [], // Targets chosen when put on stack (Phase 4: prompts)
            isSpell: false,
            isCopy: false,
            choices: null,
          };
          triggeredItems.push(stackItem);
          break; // Don't trigger the same ability twice from the same batch
        }
      }
    }
  }

  // Sort by: active player's triggers first, then by instanceId
  triggeredItems.sort((a, b) => {
    const aIsActive = a.controller === state.activePlayerId ? 0 : 1;
    const bIsActive = b.controller === state.activePlayerId ? 0 : 1;
    if (aIsActive !== bIsActive) return aIsActive - bIsActive;
    return a.sourceCardInstanceId.localeCompare(b.sourceCardInstanceId);
  });

  return triggeredItems;
}

/**
 * Check if a single event matches a trigger condition.
 */
function matchesTrigger(
  state: GameState,
  card: CardInstance,
  ability: SpellAbilityTriggered,
  event: GameEvent,
): boolean {
  const condition = ability.triggerCondition;

  // Check event type match
  const eventTypes = Array.isArray(condition.eventType)
    ? condition.eventType
    : [condition.eventType];

  if (!eventTypes.includes(event.type)) return false;

  // Check "self" condition — trigger only on the source card's own events
  if (condition.self) {
    if ("cardInstanceId" in event && (event as any).cardInstanceId !== card.instanceId) {
      return false;
    }
  }

  // Intervening-if condition checked at trigger time
  // (Full condition evaluation deferred to later phases)

  return true;
}
