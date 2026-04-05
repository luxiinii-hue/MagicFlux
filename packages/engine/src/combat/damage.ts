/**
 * Combat damage calculation and application.
 *
 * Handles: unblocked attackers, blocked attackers (damage assignment order),
 * first strike, double strike, trample, deathtouch, deathtouch + trample,
 * lifelink.
 */

import type {
  GameState,
  GameEvent,
  DamageAssignment,
  CardInstance,
  Player,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { cardHasKeyword } from "./keywords.js";

// ---------------------------------------------------------------------------
// Combat damage calculation
// ---------------------------------------------------------------------------

/**
 * Does combat currently involve any first-strike or double-strike creatures?
 * Used to determine if the first-strike damage step should exist.
 */
export function hasFirstStrikeCreatures(state: GameState): boolean {
  if (!state.combatState) return false;

  for (const attackerId of Object.keys(state.combatState.attackers)) {
    const card = state.cardInstances[attackerId];
    if (card && (cardHasKeyword(card, "first strike") || cardHasKeyword(card, "double strike"))) {
      return true;
    }
  }

  for (const blockerId of Object.keys(state.combatState.blockers)) {
    const card = state.cardInstances[blockerId];
    if (card && (cardHasKeyword(card, "first strike") || cardHasKeyword(card, "double strike"))) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate combat damage assignments for a given damage step.
 *
 * isFirstStrike: true for first-strike damage step, false for regular.
 * Only creatures with first strike / double strike deal damage in the
 * first-strike step. Only creatures WITHOUT first strike (or with double
 * strike) deal damage in the regular step.
 */
export function calculateCombatDamage(
  state: GameState,
  isFirstStrike: boolean,
): DamageAssignment[] {
  if (!state.combatState) return [];

  const assignments: DamageAssignment[] = [];

  for (const [attackerId, info] of Object.entries(state.combatState.attackers)) {
    const attacker = state.cardInstances[attackerId];
    if (!attacker || attacker.modifiedPower === null) continue;
    if (attacker.zone !== ZoneType.Battlefield) continue;

    const hasFS = cardHasKeyword(attacker, "first strike");
    const hasDS = cardHasKeyword(attacker, "double strike");

    // Should this creature deal damage in this step?
    if (isFirstStrike) {
      if (!hasFS && !hasDS) continue; // No first/double strike, skip first-strike step
    } else {
      if (hasFS && !hasDS) continue; // First strike only, already dealt damage
      // Double strike deals damage in both steps
    }

    const power = attacker.modifiedPower;
    if (power <= 0) continue;

    const hasDeathtouch = cardHasKeyword(attacker, "deathtouch");
    const hasTrample = cardHasKeyword(attacker, "trample");

    if (!info.blocked) {
      // Unblocked: damage to defending player
      assignments.push({
        sourceInstanceId: attackerId,
        targetId: info.attackTarget,
        amount: power,
        isFirstStrike,
      });
    } else if (info.blockers.length > 0) {
      // Blocked: distribute damage among blockers
      const blockerOrder = state.combatState.damageAssignmentOrders[attackerId] ?? info.blockers;
      let remaining = power;

      for (const blockerId of blockerOrder) {
        if (remaining <= 0) break;

        const blocker = state.cardInstances[blockerId];
        if (!blocker || blocker.zone !== ZoneType.Battlefield) continue;
        if (blocker.modifiedToughness === null) continue;

        // Deathtouch: 1 damage is lethal
        const lethalDamage = hasDeathtouch
          ? Math.max(1, 1) // 1 damage is enough with deathtouch
          : Math.max(0, blocker.modifiedToughness - blocker.damage);

        const assignedToBlocker = Math.min(remaining, lethalDamage);
        if (assignedToBlocker > 0) {
          assignments.push({
            sourceInstanceId: attackerId,
            targetId: blockerId,
            amount: assignedToBlocker,
            isFirstStrike,
          });
          remaining -= assignedToBlocker;
        }
      }

      // Trample: excess damage goes to defending player
      if (remaining > 0 && hasTrample) {
        assignments.push({
          sourceInstanceId: attackerId,
          targetId: info.attackTarget,
          amount: remaining,
          isFirstStrike,
        });
      }
    }
    // Blocked with 0 blockers (all blockers died to first strike): no damage dealt
  }

  // Blockers deal damage to attackers
  for (const [blockerId, binfo] of Object.entries(state.combatState.blockers)) {
    const blocker = state.cardInstances[blockerId];
    if (!blocker || blocker.modifiedPower === null) continue;
    if (blocker.zone !== ZoneType.Battlefield) continue;

    const hasFS = cardHasKeyword(blocker, "first strike");
    const hasDS = cardHasKeyword(blocker, "double strike");

    if (isFirstStrike) {
      if (!hasFS && !hasDS) continue;
    } else {
      if (hasFS && !hasDS) continue;
    }

    const power = blocker.modifiedPower;
    if (power <= 0) continue;

    // Blocker deals damage to the first attacker it's blocking
    for (const attackerId of binfo.blocking) {
      const attacker = state.cardInstances[attackerId];
      if (!attacker || attacker.zone !== ZoneType.Battlefield) continue;

      assignments.push({
        sourceInstanceId: blockerId,
        targetId: attackerId,
        amount: power,
        isFirstStrike,
      });
      break; // Blocker deals all damage to one attacker
    }
  }

  return assignments;
}

// ---------------------------------------------------------------------------
// Apply combat damage
// ---------------------------------------------------------------------------

/**
 * Apply a set of damage assignments to the game state.
 * Handles lifelink (controller gains life equal to damage dealt).
 * Tracks deathtouch damage sources for SBA processing.
 */
export function applyCombatDamage(
  state: GameState,
  assignments: readonly DamageAssignment[],
): { state: GameState; events: GameEvent[] } {
  let currentState = state;
  const events: GameEvent[] = [];

  for (const assignment of assignments) {
    const source = currentState.cardInstances[assignment.sourceInstanceId];
    if (!source) continue;

    const hasLifelink = cardHasKeyword(source, "lifelink");
    const hasDeathtouch = cardHasKeyword(source, "deathtouch");

    // Check if target is a player or a card
    const player = currentState.players.find((p) => p.id === assignment.targetId);
    if (player) {
      // Damage to player
      const newLife = player.life - assignment.amount;
      let updatedPlayers = currentState.players.map((p) =>
        p.id === assignment.targetId ? { ...p, life: newLife } : p,
      );

      // Commander damage tracking: if the source is a commander, track per-commander
      if (currentState.format === "commander" && source.instanceId) {
        const isCommander = currentState.players.some(
          (p) => p.commanderId === source.instanceId,
        );
        if (isCommander) {
          updatedPlayers = updatedPlayers.map((p) => {
            if (p.id !== assignment.targetId) return p;
            const currentDmg = p.commanderDamageReceived[source.instanceId] ?? 0;
            return {
              ...p,
              commanderDamageReceived: {
                ...p.commanderDamageReceived,
                [source.instanceId]: currentDmg + assignment.amount,
              },
            };
          });
        }
      }

      currentState = { ...currentState, players: updatedPlayers };

      events.push({
        type: "lifeChanged",
        playerId: assignment.targetId,
        oldLife: player.life,
        newLife,
        reason: "damage",
        timestamp: Date.now(),
      });
      events.push({
        type: "damageDealt",
        sourceInstanceId: assignment.sourceInstanceId,
        targetRef: { targetId: assignment.targetId, targetType: "player" },
        amount: assignment.amount,
        isCombatDamage: true,
        isDeathtouch: hasDeathtouch,
        timestamp: Date.now(),
      });
    } else {
      // Damage to a creature
      const card = currentState.cardInstances[assignment.targetId];
      if (!card) continue;

      const updatedCard: CardInstance = {
        ...card,
        damage: card.damage + assignment.amount,
        // Mark deathtouch damage for SBA checking
        ...(hasDeathtouch && assignment.amount > 0
          ? { counters: { ...card.counters, deathtouchDamage: 1 } }
          : {}),
      };
      currentState = {
        ...currentState,
        cardInstances: {
          ...currentState.cardInstances,
          [assignment.targetId]: updatedCard,
        },
      };

      events.push({
        type: "damageDealt",
        sourceInstanceId: assignment.sourceInstanceId,
        targetRef: { targetId: assignment.targetId, targetType: "card" },
        amount: assignment.amount,
        isCombatDamage: true,
        isDeathtouch: hasDeathtouch,
        timestamp: Date.now(),
      });
    }

    // Lifelink: controller gains life equal to damage dealt
    if (hasLifelink && assignment.amount > 0) {
      const controllerId = source.controller;
      const controller = currentState.players.find((p) => p.id === controllerId);
      if (controller) {
        const newLife = controller.life + assignment.amount;
        const updatedPlayers = currentState.players.map((p) =>
          p.id === controllerId ? { ...p, life: newLife } : p,
        );
        currentState = { ...currentState, players: updatedPlayers };

        events.push({
          type: "lifeChanged",
          playerId: controllerId,
          oldLife: controller.life,
          newLife,
          reason: "gainLife",
          timestamp: Date.now(),
        });
      }
    }
  }

  events.push({
    type: "combatDamageDealt",
    timestamp: Date.now(),
  });

  return { state: currentState, events };
}
