/**
 * Test helpers — create game states for testing without boilerplate.
 */

import type { GameConfig, GameState, DecklistEntry } from "@magic-flux/types";
import { createGame } from "../src/game.js";

/** Create a decklist of N basic lands of one type. */
export function basicLandDeck(landName: string, count: number = 60): DecklistEntry[] {
  return [{ count, cardName: landName, cardDataId: landName, setCode: null, collectorNumber: null }];
}

/** Create a decklist mixing basic lands. */
export function mixedLandDeck(lands: Record<string, number>): DecklistEntry[] {
  return Object.entries(lands).map(([name, count]) => ({
    count,
    cardName: name,
    cardDataId: name,
    setCode: null,
    collectorNumber: null,
  }));
}

/** Standard 2-player game config with 60 Plains each. Deterministic seed. */
export function twoPlayerConfig(seed: number = 42): GameConfig {
  return {
    format: "standard",
    seed,
    players: [
      { id: "p1", name: "Alice", decklist: basicLandDeck("Plains") },
      { id: "p2", name: "Bob", decklist: basicLandDeck("Plains") },
    ],
  };
}

/** Create a ready-to-play 2-player game. */
export function twoPlayerGame(seed: number = 42): GameState {
  return createGame(twoPlayerConfig(seed));
}
