import { describe, it, expect } from "vitest";
import { Phase, Step, STARTING_HAND_SIZE, STARTING_LIFE_STANDARD } from "@magic-flux/types";
import { createGame, getGameStatus } from "../src/game.js";
import { twoPlayerConfig, twoPlayerGame, basicLandDeck } from "./helpers.js";
import { handKey, libraryKey } from "../src/zones/transfers.js";

describe("createGame", () => {
  it("should create a game with correct player setup", () => {
    const state = twoPlayerGame();

    expect(state.players).toHaveLength(2);
    expect(state.players[0].id).toBe("p1");
    expect(state.players[1].id).toBe("p2");
    expect(state.players[0].life).toBe(STARTING_LIFE_STANDARD);
    expect(state.players[1].life).toBe(STARTING_LIFE_STANDARD);
  });

  it("should draw 7-card opening hands", () => {
    const state = twoPlayerGame();

    const p1Hand = state.zones[handKey("p1")];
    const p2Hand = state.zones[handKey("p2")];

    expect(p1Hand.cardInstanceIds).toHaveLength(STARTING_HAND_SIZE);
    expect(p2Hand.cardInstanceIds).toHaveLength(STARTING_HAND_SIZE);
  });

  it("should have libraries of 60 - 7 = 53 cards after drawing hands", () => {
    const state = twoPlayerGame();

    const p1Lib = state.zones[libraryKey("p1")];
    const p2Lib = state.zones[libraryKey("p2")];

    expect(p1Lib.cardInstanceIds).toHaveLength(53);
    expect(p2Lib.cardInstanceIds).toHaveLength(53);
  });

  it("should start on turn 1 with first player active", () => {
    const state = twoPlayerGame();

    expect(state.turnNumber).toBe(1);
    expect(state.activePlayerId).toBe("p1");
    expect(state.turnState.phase).toBe(Phase.Beginning);
    expect(state.turnState.step).toBe(Step.Untap);
  });

  it("should produce deterministic results with the same seed", () => {
    const state1 = twoPlayerGame(123);
    const state2 = twoPlayerGame(123);

    const hand1 = state1.zones[handKey("p1")].cardInstanceIds;
    const hand2 = state2.zones[handKey("p1")].cardInstanceIds;
    expect(hand1).toEqual(hand2);
  });

  it("should produce different results with different seeds", () => {
    const state1 = twoPlayerGame(1);
    const state2 = twoPlayerGame(2);

    const hand1 = state1.zones[handKey("p1")].cardInstanceIds;
    const hand2 = state2.zones[handKey("p1")].cardInstanceIds;
    // Statistically almost impossible to match
    expect(hand1).not.toEqual(hand2);
  });

  it("should start with empty mana pools", () => {
    const state = twoPlayerGame();
    for (const player of state.players) {
      expect(player.manaPool).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
    }
  });

  it("should start with no priority (untap step)", () => {
    const state = twoPlayerGame();
    expect(state.priorityPlayerId).toBeNull();
  });

  it("should set commander starting life to 40", () => {
    const config = {
      format: "commander" as const,
      seed: 42,
      players: [
        { id: "p1", name: "Alice", decklist: basicLandDeck("Plains", 99) },
        { id: "p2", name: "Bob", decklist: basicLandDeck("Plains", 99) },
      ],
    };
    const state = createGame(config);
    expect(state.players[0].life).toBe(40);
  });
});

describe("getGameStatus", () => {
  it("should return correct status for a fresh game", () => {
    const state = twoPlayerGame();
    const status = getGameStatus(state);

    expect(status.isOver).toBe(false);
    expect(status.winners).toEqual([]);
    expect(status.losers).toEqual([]);
    expect(status.activePlayerId).toBe("p1");
    expect(status.turnNumber).toBe(1);
    expect(status.currentPhase).toBe(Phase.Beginning);
    expect(status.currentStep).toBe(Step.Untap);
  });
});
