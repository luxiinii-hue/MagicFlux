/**
 * Declare blockers logic.
 *
 * The defending player declares which creatures block which attackers.
 * Validates flying/reach and menace restrictions.
 */

import type {
  GameState,
  GameEvent,
  BlockerInfo,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { canBlock, cardHasKeyword } from "./keywords.js";

/**
 * Validate and apply blocker declarations.
 *
 * blockerAssignments: Map of blocker instanceId → array of attacker
 * instanceIds being blocked (typically one attacker per blocker).
 */
export function declareBlockers(
  state: GameState,
  playerId: string,
  blockerAssignments: Readonly<Record<string, readonly string[]>>,
): { state: GameState; events: GameEvent[] } {
  if (!state.combatState) {
    throw new Error("Cannot declare blockers outside of combat");
  }

  const events: GameEvent[] = [];
  const blockers: Record<string, BlockerInfo> = {};
  const updatedAttackers = { ...state.combatState.attackers };

  for (const [blockerId, attackerIds] of Object.entries(blockerAssignments)) {
    const blocker = state.cardInstances[blockerId];
    if (!blocker) continue;
    if (blocker.controller !== playerId) continue;
    if (blocker.zone !== ZoneType.Battlefield) continue;
    if (blocker.tapped) continue;
    if (blocker.modifiedPower === null) continue;

    const validAttackerIds: string[] = [];

    for (const attackerId of attackerIds) {
      // Validate this blocker can block this attacker
      const check = canBlock(state, blockerId, attackerId);
      if (!check.canBlock) continue;

      // Attacker must be in combat
      if (!updatedAttackers[attackerId]) continue;

      validAttackerIds.push(attackerId);

      // Mark attacker as blocked
      updatedAttackers[attackerId] = {
        ...updatedAttackers[attackerId],
        blocked: true,
        blockers: [...updatedAttackers[attackerId].blockers, blockerId],
      };
    }

    if (validAttackerIds.length > 0) {
      blockers[blockerId] = { blocking: validAttackerIds };
    }
  }

  // Menace check: if an attacker with menace is blocked by only 1 creature,
  // that block is illegal — undo it
  for (const [attackerId, info] of Object.entries(updatedAttackers)) {
    if (info.blocked && info.blockers.length === 1) {
      const attacker = state.cardInstances[attackerId];
      if (attacker && cardHasKeyword(attacker, "menace")) {
        // Undo this block
        const singleBlockerId = info.blockers[0];
        updatedAttackers[attackerId] = {
          ...info,
          blocked: false,
          blockers: [],
        };
        // Remove from blockers map
        delete blockers[singleBlockerId];
      }
    }
  }

  // Default damage assignment order = blocker order as declared
  const damageAssignmentOrders: Record<string, readonly string[]> = {};
  for (const [attackerId, info] of Object.entries(updatedAttackers)) {
    if (info.blockers.length > 0) {
      damageAssignmentOrders[attackerId] = info.blockers;
    }
  }

  const blockerAssignmentEvent: Record<string, readonly string[]> = {};
  for (const [bid, binfo] of Object.entries(blockers)) {
    blockerAssignmentEvent[bid] = binfo.blocking;
  }

  events.push({
    type: "blockersDeclared",
    blockerAssignments: blockerAssignmentEvent,
    timestamp: Date.now(),
  });

  const updatedCombatState = {
    ...state.combatState,
    attackers: updatedAttackers,
    blockers,
    damageAssignmentOrders,
  };

  const updatedTurnState = {
    ...state.turnState,
    hasDeclaredBlockers: true,
  };

  return {
    state: {
      ...state,
      combatState: updatedCombatState,
      turnState: updatedTurnState,
    },
    events,
  };
}
