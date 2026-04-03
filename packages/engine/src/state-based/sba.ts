/**
 * State-based actions (SBAs).
 *
 * Checked before any player receives priority. Must be called in a loop
 * until actionsPerformed is false, since SBAs can trigger more SBAs.
 *
 * Phase 1: 0 life loss, empty library draw loss.
 * Later phases add: lethal damage, deathtouch, legend rule, tokens in
 * non-battlefield zones, aura/equipment rules, poison, planeswalker loyalty,
 * +1/+1 & -1/-1 counter annihilation, commander damage.
 */

import type { GameState, GameEvent, CardInstance } from "@magic-flux/types";
import { ZoneType, LETHAL_POISON_COUNTERS, LETHAL_COMMANDER_DAMAGE } from "@magic-flux/types";
import { moveCard, graveyardKey } from "../zones/transfers.js";
import { cardHasKeyword } from "../combat/keywords.js";

export interface SBAResult {
  state: GameState;
  events: GameEvent[];
  actionsPerformed: boolean;
}

/**
 * Check and apply all state-based actions once.
 * Returns the updated state, any events generated, and whether any SBAs fired.
 */
export function processStateBasedActions(state: GameState): SBAResult {
  const events: GameEvent[] = [];
  let changed = false;
  let updatedPlayers = [...state.players];

  for (let i = 0; i < updatedPlayers.length; i++) {
    const player = updatedPlayers[i];
    if (player.hasLost) continue;

    // SBA: Player at 0 or less life loses
    if (player.life <= 0) {
      updatedPlayers[i] = { ...player, hasLost: true };
      events.push({
        type: "playerLost",
        playerId: player.id,
        reason: "life reached 0",
        timestamp: Date.now(),
      });
      changed = true;
    }

    // SBA: Player who drew from empty library loses
    if (player.drewFromEmptyLibrary) {
      updatedPlayers[i] = { ...updatedPlayers[i], hasLost: true, drewFromEmptyLibrary: false };
      events.push({
        type: "playerLost",
        playerId: player.id,
        reason: "attempted to draw from empty library",
        timestamp: Date.now(),
      });
      changed = true;
    }

    // SBA: 10+ poison counters
    if (player.poisonCounters >= LETHAL_POISON_COUNTERS) {
      updatedPlayers[i] = { ...updatedPlayers[i], hasLost: true };
      events.push({
        type: "playerLost",
        playerId: player.id,
        reason: "10 or more poison counters",
        timestamp: Date.now(),
      });
      changed = true;
    }

    // SBA: 21+ commander damage from a single commander (Commander format)
    if (state.format === "commander") {
      for (const [cmdId, dmg] of Object.entries(player.commanderDamageReceived)) {
        if (dmg >= LETHAL_COMMANDER_DAMAGE) {
          updatedPlayers[i] = { ...updatedPlayers[i], hasLost: true };
          events.push({
            type: "playerLost",
            playerId: player.id,
            reason: `received ${dmg} commander damage from ${cmdId}`,
            timestamp: Date.now(),
          });
          changed = true;
          break;
        }
      }
    }
  }

  // SBA: Creatures with 0 or less toughness → owner's graveyard
  // SBA: Creatures with lethal damage marked → destroy
  let newState: GameState = { ...state, players: updatedPlayers };
  const creaturesDestroyed: string[] = [];

  for (const [instanceId, card] of Object.entries(newState.cardInstances)) {
    if (card.zone !== ZoneType.Battlefield) continue;
    if (card.modifiedToughness === null) continue; // Not a creature

    let shouldDestroy = false;

    // Toughness 0 or less
    if (card.modifiedToughness <= 0) {
      shouldDestroy = true;
    }

    // Lethal damage (damage >= toughness)
    if (card.damage >= card.modifiedToughness) {
      // Indestructible creatures don't die from damage
      if (!cardHasKeyword(card, "indestructible")) {
        shouldDestroy = true;
      }
    }

    if (shouldDestroy) {
      creaturesDestroyed.push(instanceId);
    }
  }

  for (const instanceId of creaturesDestroyed) {
    const card = newState.cardInstances[instanceId];
    if (!card || card.zone !== ZoneType.Battlefield) continue;

    const moveResult = moveCard(
      newState,
      instanceId,
      "battlefield",
      graveyardKey(card.owner),
      Date.now(),
    );
    newState = moveResult.state;
    events.push(...moveResult.events);
    events.push({
      type: "cardDestroyed",
      cardInstanceId: instanceId,
      timestamp: Date.now(),
    });
    changed = true;
  }

  // Check for game over
  const remainingPlayers = updatedPlayers.filter((p) => !p.hasLost);
  newState = { ...newState, players: updatedPlayers };

  if (remainingPlayers.length <= 1 && !state.gameOver) {
    newState = {
      ...newState,
      gameOver: true,
      winners: remainingPlayers.map((p) => p.id),
      losers: updatedPlayers.filter((p) => p.hasLost).map((p) => p.id),
    };
    events.push({
      type: "gameOver",
      winnerIds: newState.winners,
      timestamp: Date.now(),
    });
  }

  return { state: newState, events, actionsPerformed: changed };
}

/**
 * Run the SBA loop until no more actions are performed.
 * Collects all events across iterations.
 */
export function processStateBasedActionsLoop(
  state: GameState,
): { state: GameState; events: GameEvent[] } {
  let currentState = state;
  const allEvents: GameEvent[] = [];

  let result: SBAResult;
  do {
    result = processStateBasedActions(currentState);
    currentState = result.state;
    allEvents.push(...result.events);
  } while (result.actionsPerformed);

  return { state: currentState, events: allEvents };
}
