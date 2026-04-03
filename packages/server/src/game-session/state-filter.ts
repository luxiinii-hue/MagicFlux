/**
 * State filtering: GameState → ClientGameState per player.
 *
 * Per DEC-007: the server filters hidden information before sending
 * state to clients. Library contents become counts, opponent hands
 * become counts, face-down exiled cards are hidden.
 */

import type {
  GameState,
  ClientGameState,
  ClientLibraryZone,
  ClientHandZone,
  CardInstance,
  Zone,
  StackItem,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

/**
 * Creates a ClientGameState from a full GameState, filtered for the
 * specified player. Hidden information is removed:
 * - Library contents → card count only
 * - Opponent hands → card count only
 * - Face-down exiled cards (not controlled by viewer) → removed
 */
export function filterStateForPlayer(
  state: GameState,
  viewingPlayerId: string
): ClientGameState {
  const filteredZones: Record<string, Zone | ClientLibraryZone | ClientHandZone> = {};
  const visibleCardIds = new Set<string>();

  // Process each zone
  for (const [key, zone] of Object.entries(state.zones)) {
    if (zone.type === ZoneType.Library) {
      // Libraries: count only, no card list
      filteredZones[key] = {
        key: zone.key,
        type: "Library",
        ownerId: zone.ownerId!,
        cardCount: zone.cardInstanceIds.length,
      } satisfies ClientLibraryZone;
      // No cards from libraries are visible
    } else if (zone.type === ZoneType.Hand) {
      if (zone.ownerId === viewingPlayerId) {
        // Own hand: full card list
        filteredZones[key] = {
          key: zone.key,
          type: "Hand",
          ownerId: zone.ownerId!,
          cardInstanceIds: zone.cardInstanceIds,
          cardCount: zone.cardInstanceIds.length,
        } satisfies ClientHandZone;
        for (const id of zone.cardInstanceIds) {
          visibleCardIds.add(id);
        }
      } else {
        // Opponent hand: count only
        filteredZones[key] = {
          key: zone.key,
          type: "Hand",
          ownerId: zone.ownerId!,
          cardInstanceIds: null,
          cardCount: zone.cardInstanceIds.length,
        } satisfies ClientHandZone;
      }
    } else {
      // Public zones (battlefield, graveyard, exile, stack, command zone)
      filteredZones[key] = zone;
      for (const id of zone.cardInstanceIds) {
        const card = state.cardInstances[id];
        if (card && zone.type === ZoneType.Exile && card.faceDown) {
          // Face-down exile: only visible if viewer controls the exiling effect
          if (card.controller === viewingPlayerId) {
            visibleCardIds.add(id);
          }
        } else {
          visibleCardIds.add(id);
        }
      }
    }
  }

  // Stack items are always visible
  for (const stackId of state.stack) {
    visibleCardIds.add(stackId);
  }

  // Filter card instances to only visible ones
  const filteredCardInstances: Record<string, CardInstance> = {};
  for (const id of visibleCardIds) {
    const card = state.cardInstances[id];
    if (card) {
      filteredCardInstances[id] = card;
    }
  }

  // Filter stack items to only those on the stack
  const filteredStackItems: Record<string, StackItem> = {};
  for (const stackId of state.stack) {
    const item = state.stackItems[stackId];
    if (item) {
      filteredStackItems[stackId] = item;
    }
  }

  return {
    gameId: state.gameId,
    players: state.players,
    cardInstances: filteredCardInstances,
    zones: filteredZones,
    turnState: state.turnState,
    activePlayerId: state.activePlayerId,
    priorityPlayerId: state.priorityPlayerId,
    stack: state.stack,
    stackItems: filteredStackItems,
    turnNumber: state.turnNumber,
    gameOver: state.gameOver,
    winners: state.winners,
    losers: state.losers,
    continuousEffects: state.continuousEffects,
    combatState: state.combatState,
    format: state.format,
  };
}
