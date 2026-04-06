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
  ResolvedTarget,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

/**
 * Check all triggered abilities in the game against a list of events.
 * Returns StackItems for any that trigger, ordered deterministically
 * by source instanceId (APNAP ordering in Phase 4+).
 */
export function checkTriggeredAbilities(
  state: GameState,
  events: readonly GameEvent[],
): StackItem[] {
  const triggeredItems: StackItem[] = [];

  if (events.length === 0) return triggeredItems;

  for (const [instanceId, card] of Object.entries(state.cardInstances)) {
    for (const ability of card.abilities) {
      if (ability.type !== "triggered") continue;

      const triggered = ability as SpellAbilityTriggered;

      if (!triggered.zones.includes(card.zone)) continue;

      for (const event of events) {
        if (matchesTrigger(state, card, triggered, event)) {
          // Auto-populate targets from event context where possible
          const targets = autoPopulateTargets(triggered, event, state);

          const stackItem: StackItem = {
            id: `trigger_${instanceId}_${ability.id}_${Date.now()}`,
            sourceCardInstanceId: instanceId,
            ability: triggered,
            controller: card.controller,
            targets,
            isSpell: false,
            isCopy: false,
            choices: null,
          };
          triggeredItems.push(stackItem);
          break;
        }
      }
    }
  }

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
 * Handles per-event-type self-checking.
 */
function matchesTrigger(
  state: GameState,
  card: CardInstance,
  ability: SpellAbilityTriggered,
  event: GameEvent,
): boolean {
  const condition = ability.triggerCondition;

  const eventTypes = Array.isArray(condition.eventType)
    ? condition.eventType
    : [condition.eventType];

  if (!eventTypes.includes(event.type)) return false;

  // Self-check: trigger only on events involving this card
  if (condition.self) {
    if (!isEventAboutCard(event, card.instanceId)) {
      return false;
    }
  }

  return true;
}

/**
 * Per-event-type check: does this event involve the specified card?
 * Different event types store the relevant card ID in different fields.
 */
function isEventAboutCard(event: GameEvent, cardInstanceId: string): boolean {
  switch (event.type) {
    case "cardEnteredZone":
    case "cardLeftZone":
    case "cardTapped":
    case "cardUntapped":
    case "cardDestroyed":
    case "tokenCreated":
    case "counterAdded":
    case "counterRemoved":
      return (event as any).cardInstanceId === cardInstanceId;

    case "spellCast":
      return (event as any).cardInstanceId === cardInstanceId;

    case "attackersDeclared":
      // Check if this card is one of the declared attackers
      return ((event as any).attackerIds as string[])?.includes(cardInstanceId) ?? false;

    case "blockersDeclared":
      // Check if this card is one of the blockers
      return Object.keys((event as any).blockerAssignments ?? {}).includes(cardInstanceId);

    case "damageDealt":
      return (event as any).sourceInstanceId === cardInstanceId ||
        (event as any).targetRef?.targetId === cardInstanceId;

    case "abilityActivated":
    case "abilityTriggered":
      return (event as any).cardInstanceId === cardInstanceId;

    case "lifeChanged":
    case "manaAdded":
    case "playerLost":
      // Player events — check if the card's controller is the player
      return false; // These aren't card-specific

    case "phaseChanged":
    case "turnBegan":
    case "combatDamageDealt":
    case "gameOver":
    case "stackItemResolved":
    case "stackItemCountered":
      return false; // Not card-specific events

    default:
      return false;
  }
}

/**
 * Auto-populate targets for triggered abilities from event context.
 *
 * When a triggered ability has target requirements, try to fill them
 * from the triggering event's data. For example:
 * - ETB trigger on a creature: the entering creature is the target
 * - "When ~ deals damage to a player": the player is the target
 * - "When ~ attacks": the attacking creature is the target (self)
 *
 * If targets can't be auto-populated (needs player choice), they stay
 * empty and the server should create a PendingPrompt.
 */
function autoPopulateTargets(
  ability: SpellAbilityTriggered,
  event: GameEvent,
  state: GameState,
): ResolvedTarget[] {
  const targets: ResolvedTarget[] = [];

  if (!ability.targets || ability.targets.length === 0) {
    return targets;
  }

  for (const req of ability.targets) {
    let targetId: string | null = null;
    let targetType: "card" | "player" = "card";

    // Try to extract a suitable target from the event
    switch (event.type) {
      case "cardEnteredZone":
      case "cardLeftZone":
      case "cardDestroyed":
        // The card that entered/left/was destroyed
        targetId = (event as any).cardInstanceId;
        targetType = "card";
        break;

      case "spellCast":
        // The player who cast the spell (for Eidolon-type triggers)
        if (req.targetTypes.includes("player")) {
          targetId = (event as any).playerId;
          targetType = "player";
        } else {
          targetId = (event as any).cardInstanceId;
          targetType = "card";
        }
        break;

      case "damageDealt":
        // The target of the damage (player or creature)
        if ((event as any).targetRef) {
          targetId = (event as any).targetRef.targetId;
          targetType = (event as any).targetRef.targetType;
        }
        break;

      case "attackersDeclared":
        // For "whenever ~ attacks" triggers, the source card is the attacker.
        // The target might be the defending player.
        if (req.targetTypes.includes("player")) {
          // Find who this card is attacking
          const attackTargets = (event as any).attackTargets as Record<string, string> | undefined;
          const sourceId = ability.sourceCardInstanceId;
          if (sourceId && attackTargets && attackTargets[sourceId]) {
            targetId = attackTargets[sourceId];
            targetType = "player";
          }
        }
        break;

      case "lifeChanged":
        if (req.targetTypes.includes("player")) {
          targetId = (event as any).playerId;
          targetType = "player";
        }
        break;

      default:
        break;
    }

    if (targetId) {
      targets.push({
        requirementId: req.id,
        targetId,
        targetType,
      });
    }
  }

  return targets;
}
