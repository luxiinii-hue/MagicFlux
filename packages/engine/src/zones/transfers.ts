/**
 * Zone management — creating zones for a game and moving cards between them.
 *
 * Zone keys follow a structured format:
 * - Shared: "battlefield", "exile", "stack", "commandZone"
 * - Per-player: "player:{playerId}:library", "player:{playerId}:hand",
 *   "player:{playerId}:graveyard"
 */

import type {
  Zone,
  ZoneType,
  GameState,
  CardInstance,
  GameEvent,
} from "@magic-flux/types";
import { checkZoneChangeReplacement } from "../replacement/replacement.js";

// ---------------------------------------------------------------------------
// Zone key helpers
// ---------------------------------------------------------------------------

export function libraryKey(playerId: string): string {
  return `player:${playerId}:library`;
}

export function handKey(playerId: string): string {
  return `player:${playerId}:hand`;
}

export function graveyardKey(playerId: string): string {
  return `player:${playerId}:graveyard`;
}

const SHARED_ZONE_KEYS = ["battlefield", "exile", "stack", "commandZone"] as const;

// ---------------------------------------------------------------------------
// Zone creation
// ---------------------------------------------------------------------------

function makeZone(
  key: string,
  type: ZoneType,
  ownerId: string | null,
  visibility: "hidden" | "owner" | "public",
): Zone {
  return { key, type, ownerId, cardInstanceIds: [], visibility };
}

/** Create all zones for a game with the given player IDs. */
export function createZones(playerIds: readonly string[]): Record<string, Zone> {
  const zones: Record<string, Zone> = {
    battlefield: makeZone("battlefield", "Battlefield" as ZoneType, null, "public"),
    exile: makeZone("exile", "Exile" as ZoneType, null, "public"),
    stack: makeZone("stack", "Stack" as ZoneType, null, "public"),
    commandZone: makeZone("commandZone", "CommandZone" as ZoneType, null, "public"),
  };

  for (const pid of playerIds) {
    zones[libraryKey(pid)] = makeZone(libraryKey(pid), "Library" as ZoneType, pid, "hidden");
    zones[handKey(pid)] = makeZone(handKey(pid), "Hand" as ZoneType, pid, "owner");
    zones[graveyardKey(pid)] = makeZone(graveyardKey(pid), "Graveyard" as ZoneType, pid, "public");
  }

  return zones;
}

// ---------------------------------------------------------------------------
// Zone queries
// ---------------------------------------------------------------------------

/** Get the zone key where a card currently resides. */
export function findCardZoneKey(state: GameState, instanceId: string): string | null {
  for (const [key, zone] of Object.entries(state.zones)) {
    if (zone.cardInstanceIds.includes(instanceId)) {
      return key;
    }
  }
  return null;
}

/** Get all card instance IDs in a zone. */
export function getZoneCards(state: GameState, zoneKey: string): readonly string[] {
  return state.zones[zoneKey]?.cardInstanceIds ?? [];
}

// ---------------------------------------------------------------------------
// Zone transfers
// ---------------------------------------------------------------------------

/**
 * Move a card from one zone to another. Returns the updated GameState and
 * the zone-transfer events. Pure — no mutation.
 *
 * The card's `zone` and `zoneOwnerId` fields on CardInstance are updated.
 * When entering the battlefield, summoningSickness is set to true.
 * When leaving the battlefield, tapped/damage/counters are reset.
 */
export function moveCard(
  state: GameState,
  instanceId: string,
  fromZoneKey: string,
  toZoneKey: string,
  eventTimestamp: number,
): { state: GameState; events: GameEvent[] } {
  // Check replacement effects (e.g., "exile instead of graveyard")
  if (state.replacementEffects && state.replacementEffects.length > 0) {
    const replacement = checkZoneChangeReplacement(state, instanceId, fromZoneKey, toZoneKey);
    if (replacement) {
      toZoneKey = replacement.replacedToZone;
    }
  }
  const fromZone = state.zones[fromZoneKey];
  const toZone = state.zones[toZoneKey];
  if (!fromZone || !toZone) {
    throw new Error(`Zone not found: ${!fromZone ? fromZoneKey : toZoneKey}`);
  }

  if (!fromZone.cardInstanceIds.includes(instanceId)) {
    throw new Error(`Card ${instanceId} not in zone ${fromZoneKey}`);
  }

  const card = state.cardInstances[instanceId];
  if (!card) {
    throw new Error(`Card instance ${instanceId} not found`);
  }

  // Remove from source zone
  const updatedFromZone: Zone = {
    ...fromZone,
    cardInstanceIds: fromZone.cardInstanceIds.filter((id) => id !== instanceId),
  };

  // Add to destination zone (top of zone = index 0 for library/graveyard/stack)
  const updatedToZone: Zone = {
    ...toZone,
    cardInstanceIds: [instanceId, ...toZone.cardInstanceIds],
  };

  // Update card instance zone info
  let updatedCard: CardInstance = {
    ...card,
    zone: toZone.type,
    zoneOwnerId: toZone.ownerId,
  };

  // Entering battlefield: set summoning sickness
  if (toZone.type === ("Battlefield" as ZoneType)) {
    updatedCard = { ...updatedCard, summoningSickness: true };
  }

  // Leaving battlefield: reset battlefield-specific state
  if (fromZone.type === ("Battlefield" as ZoneType)) {
    updatedCard = {
      ...updatedCard,
      tapped: false,
      damage: 0,
      summoningSickness: false,
      attachedTo: null,
      attachments: [],
    };
  }

  const updatedZones = {
    ...state.zones,
    [fromZoneKey]: updatedFromZone,
    [toZoneKey]: updatedToZone,
  };

  const updatedCardInstances = {
    ...state.cardInstances,
    [instanceId]: updatedCard,
  };

  const events: GameEvent[] = [
    {
      type: "cardLeftZone",
      cardInstanceId: instanceId,
      fromZone: fromZone.type,
      toZone: toZone.type,
      timestamp: eventTimestamp,
    },
    {
      type: "cardEnteredZone",
      cardInstanceId: instanceId,
      toZone: toZone.type,
      fromZone: fromZone.type,
      timestamp: eventTimestamp + 1,
    },
  ];

  return {
    state: {
      ...state,
      zones: updatedZones,
      cardInstances: updatedCardInstances,
    },
    events,
  };
}

/**
 * Draw a card: move the top card of a player's library to their hand.
 * If the library is empty, set the player's drewFromEmptyLibrary flag.
 */
export function drawCard(
  state: GameState,
  playerId: string,
  eventTimestamp: number,
): { state: GameState; events: GameEvent[] } {
  const libKey = libraryKey(playerId);
  const library = state.zones[libKey];

  if (!library || library.cardInstanceIds.length === 0) {
    // Empty library — flag for SBA
    const updatedPlayers = state.players.map((p) =>
      p.id === playerId ? { ...p, drewFromEmptyLibrary: true } : p,
    );
    return { state: { ...state, players: updatedPlayers }, events: [] };
  }

  const topCardId = library.cardInstanceIds[0];
  return moveCard(state, topCardId, libKey, handKey(playerId), eventTimestamp);
}
