/**
 * London mulligan system.
 *
 * Each player, starting with the first player, may choose to mulligan:
 * 1. Shuffle hand into library
 * 2. Draw 7 cards
 * 3. After all players have decided, each player who mulliganed puts
 *    N cards from hand on the bottom of their library (where N = number
 *    of times they mulliganed)
 *
 * This is implemented as a pre-game phase with player actions.
 */

import type { GameState, GameEvent, Player } from "@magic-flux/types";
import { shuffle } from "./rng.js";
import { libraryKey, handKey, moveCard, drawCard } from "./zones/transfers.js";
import { STARTING_HAND_SIZE } from "@magic-flux/types";

/**
 * Execute a mulligan for a player: shuffle hand into library, draw 7.
 * Returns the updated state. The "put N on bottom" happens separately.
 */
export function performMulligan(
  state: GameState,
  playerId: string,
  mulliganCount: number,
): { state: GameState; events: GameEvent[] } {
  const hKey = handKey(playerId);
  const lKey = libraryKey(playerId);
  let currentState = state;
  const allEvents: GameEvent[] = [];

  // Move all cards from hand back to library
  const hand = currentState.zones[hKey];
  for (const cardId of [...hand.cardInstanceIds]) {
    const result = moveCard(currentState, cardId, hKey, lKey, Date.now());
    currentState = result.state;
    // Don't emit events for shuffle-back, it's internal
  }

  // Shuffle library
  const library = currentState.zones[lKey];
  const shuffled = shuffle(library.cardInstanceIds, currentState.rngState);
  currentState = {
    ...currentState,
    rngState: shuffled.nextState,
    zones: {
      ...currentState.zones,
      [lKey]: { ...library, cardInstanceIds: shuffled.result },
    },
  };

  // Draw 7 new cards
  for (let i = 0; i < STARTING_HAND_SIZE; i++) {
    const result = drawCard(currentState, playerId, Date.now());
    currentState = result.state;
    allEvents.push(...result.events);
  }

  return { state: currentState, events: allEvents };
}

/**
 * Put cards from hand on the bottom of library (the "put back" step
 * after all mulligan decisions are made).
 *
 * @param cardIds The specific card instance IDs to put on bottom.
 */
export function putCardsOnBottom(
  state: GameState,
  playerId: string,
  cardIds: readonly string[],
): { state: GameState; events: GameEvent[] } {
  const hKey = handKey(playerId);
  const lKey = libraryKey(playerId);
  let currentState = state;
  const allEvents: GameEvent[] = [];

  for (const cardId of cardIds) {
    const hand = currentState.zones[hKey];
    if (!hand.cardInstanceIds.includes(cardId)) continue;

    // Move to bottom of library (append to end instead of prepend)
    const result = moveCard(currentState, cardId, hKey, lKey, Date.now());
    currentState = result.state;

    // Move the card to the bottom (moveCard puts at top by default)
    const lib = currentState.zones[lKey];
    const withoutCard = lib.cardInstanceIds.filter((id) => id !== cardId);
    currentState = {
      ...currentState,
      zones: {
        ...currentState.zones,
        [lKey]: { ...lib, cardInstanceIds: [...withoutCard, cardId] },
      },
    };

    allEvents.push(...result.events);
  }

  return { state: currentState, events: allEvents };
}
