/**
 * Declare attackers logic.
 *
 * The active player declares which creatures attack which targets
 * (defending player or planeswalker). Non-vigilance attackers are tapped.
 * Creates the CombatState on the GameState.
 */

import type {
  GameState,
  GameEvent,
  CardInstance,
  CombatState,
  AttackerInfo,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { canAttack, cardHasKeyword } from "./keywords.js";

/**
 * Validate and apply attacker declarations.
 *
 * attackerAssignments: Map of attacker instanceId → defending player ID
 * (or planeswalker instanceId).
 */
export function declareAttackers(
  state: GameState,
  playerId: string,
  attackerAssignments: Readonly<Record<string, string>>,
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const attackers: Record<string, AttackerInfo> = {};

  const updatedCards = { ...state.cardInstances };

  for (const [attackerId, target] of Object.entries(attackerAssignments)) {
    const card = updatedCards[attackerId];
    if (!card) continue;

    // Validate this creature can attack
    const check = canAttack(state, attackerId);
    if (!check.canAttack) continue;

    // Must be controlled by the declaring player
    if (card.controller !== playerId) continue;

    // Must be on the battlefield
    if (card.zone !== ZoneType.Battlefield) continue;

    // Tap the attacker (unless it has vigilance)
    if (!cardHasKeyword(card, "vigilance")) {
      updatedCards[attackerId] = { ...card, tapped: true };
      events.push({
        type: "cardTapped",
        cardInstanceId: attackerId,
        timestamp: Date.now(),
      });
    }

    attackers[attackerId] = {
      attackTarget: target,
      blocked: false,
      blockers: [],
      dealtFirstStrikeDamage: false,
    };
  }

  const combatState: CombatState = {
    attackers,
    blockers: {},
    damageAssignmentOrders: {},
  };

  const attackerIds = Object.keys(attackers);
  const attackTargets: Record<string, string> = {};
  for (const [id, info] of Object.entries(attackers)) {
    attackTargets[id] = info.attackTarget;
  }

  events.push({
    type: "attackersDeclared",
    attackerIds,
    attackTargets,
    timestamp: Date.now(),
  });

  const updatedTurnState = {
    ...state.turnState,
    hasDeclaredAttackers: true,
  };

  return {
    state: {
      ...state,
      cardInstances: updatedCards,
      combatState,
      turnState: updatedTurnState,
    },
    events,
  };
}
