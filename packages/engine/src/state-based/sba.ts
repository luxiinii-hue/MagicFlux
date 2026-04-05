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
      if (!cardHasKeyword(card, "indestructible")) {
        shouldDestroy = true;
      }
    }

    // Deathtouch: any damage from a deathtouch source is lethal
    if (card.damage > 0 && card.counters["deathtouchDamage"]) {
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

  // SBA: Planeswalker with 0 or fewer loyalty counters → owner's graveyard
  for (const [instanceId, card] of Object.entries(newState.cardInstances)) {
    if (card.zone !== ZoneType.Battlefield) continue;
    if (card.currentLoyalty === null) continue;
    if (card.currentLoyalty <= 0) {
      const moveResult = moveCard(
        newState, instanceId, "battlefield", graveyardKey(card.owner), Date.now(),
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
  }

  // SBA: Legend Rule (CR 704.5j) — if a player controls 2+ legendary permanents
  // with the same name, they choose one to keep, rest go to graveyard.
  // Simplified: keep the one with the lowest instanceId (deterministic).
  const legendariesByController: Record<string, Record<string, string[]>> = {};
  for (const [instanceId, card] of Object.entries(newState.cardInstances)) {
    if (card.zone !== ZoneType.Battlefield) continue;
    if (!card.isLegendary) continue;

    const key = `${card.controller}:${card.cardDataId}`;
    if (!legendariesByController[key]) {
      legendariesByController[key] = {};
    }
    if (!legendariesByController[key][card.cardDataId]) {
      legendariesByController[key][card.cardDataId] = [];
    }
    legendariesByController[key][card.cardDataId].push(instanceId);
  }

  for (const [_key, nameMap] of Object.entries(legendariesByController)) {
    for (const [_name, ids] of Object.entries(nameMap)) {
      if (ids.length <= 1) continue;
      // Keep the first (lowest ID), sacrifice the rest
      const toRemove = ids.slice(1);
      for (const instanceId of toRemove) {
        const card = newState.cardInstances[instanceId];
        if (!card || card.zone !== ZoneType.Battlefield) continue;
        const result = moveCard(
          newState, instanceId, "battlefield", graveyardKey(card.owner), Date.now(),
        );
        newState = result.state;
        events.push(...result.events);
        events.push({
          type: "cardDestroyed",
          cardInstanceId: instanceId,
          timestamp: Date.now(),
        });
        changed = true;
      }
    }
  }

  // SBA: Aura/Equipment attachment legality (CR 704.5m/n)
  // If an Aura is attached to an illegal object or not attached to anything
  // while on the battlefield, it goes to its owner's graveyard.
  for (const [instanceId, card] of Object.entries(newState.cardInstances)) {
    if (card.zone !== ZoneType.Battlefield) continue;
    if (card.attachedTo === null) continue;

    // Check if the attached-to card still exists on the battlefield
    const attachedTo = newState.cardInstances[card.attachedTo];
    if (!attachedTo || attachedTo.zone !== ZoneType.Battlefield) {
      // Attachment target gone — unattach. For Auras, send to graveyard.
      // For Equipment, just unattach (stays on battlefield).
      const isAura = card.abilities.some(
        (a) => a.type === "static" && a.continuousEffect?.effectType === "enchant",
      );
      if (isAura) {
        const result = moveCard(
          newState, instanceId, "battlefield", graveyardKey(card.owner), Date.now(),
        );
        newState = result.state;
        events.push(...result.events);
        changed = true;
      } else {
        // Equipment: just detach
        newState = {
          ...newState,
          cardInstances: {
            ...newState.cardInstances,
            [instanceId]: { ...card, attachedTo: null },
          },
        };
      }
    }
  }

  // SBA: +1/+1 and -1/-1 counter annihilation (CR 704.5q)
  // If a permanent has both +1/+1 and -1/-1 counters, remove pairs until
  // only one type remains.
  for (const [instanceId, card] of Object.entries(newState.cardInstances)) {
    if (card.zone !== ZoneType.Battlefield) continue;
    const plusCounters = card.counters["+1/+1"] ?? 0;
    const minusCounters = card.counters["-1/-1"] ?? 0;
    if (plusCounters > 0 && minusCounters > 0) {
      const toRemove = Math.min(plusCounters, minusCounters);
      const newPlus = plusCounters - toRemove;
      const newMinus = minusCounters - toRemove;
      const updatedCounters = { ...card.counters };
      if (newPlus > 0) {
        updatedCounters["+1/+1"] = newPlus;
      } else {
        delete updatedCounters["+1/+1"];
      }
      if (newMinus > 0) {
        updatedCounters["-1/-1"] = newMinus;
      } else {
        delete updatedCounters["-1/-1"];
      }
      // Also adjust P/T
      const ptDelta = -toRemove; // Removing +1/+1 counters reduces P/T (net effect)
      // Actually: removing N +1/+1 and N -1/-1 has net zero P/T impact
      newState = {
        ...newState,
        cardInstances: {
          ...newState.cardInstances,
          [instanceId]: { ...newState.cardInstances[instanceId], counters: updatedCounters },
        },
      };
      changed = true;
    }
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
