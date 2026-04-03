import { describe, it, expect } from "vitest";
import { processStateBasedActions, processStateBasedActionsLoop } from "../src/state-based/sba.js";
import { twoPlayerGame } from "./helpers.js";
import type { GameState, Player } from "@magic-flux/types";

describe("state-based actions", () => {
  it("should eliminate a player at 0 life", () => {
    const state = twoPlayerGame();

    // Set p1 life to 0
    const updatedPlayers = state.players.map((p) =>
      p.id === "p1" ? { ...p, life: 0 } : p,
    );
    const modifiedState: GameState = { ...state, players: updatedPlayers };

    const result = processStateBasedActions(modifiedState);

    expect(result.actionsPerformed).toBe(true);
    const p1 = result.state.players.find((p) => p.id === "p1")!;
    expect(p1.hasLost).toBe(true);
    expect(result.events.some((e) => e.type === "playerLost")).toBe(true);
  });

  it("should eliminate a player at negative life", () => {
    const state = twoPlayerGame();

    const updatedPlayers = state.players.map((p) =>
      p.id === "p1" ? { ...p, life: -5 } : p,
    );
    const modifiedState: GameState = { ...state, players: updatedPlayers };

    const result = processStateBasedActions(modifiedState);
    const p1 = result.state.players.find((p) => p.id === "p1")!;
    expect(p1.hasLost).toBe(true);
  });

  it("should eliminate a player who drew from empty library", () => {
    const state = twoPlayerGame();

    const updatedPlayers = state.players.map((p) =>
      p.id === "p2" ? { ...p, drewFromEmptyLibrary: true } : p,
    );
    const modifiedState: GameState = { ...state, players: updatedPlayers };

    const result = processStateBasedActions(modifiedState);
    const p2 = result.state.players.find((p) => p.id === "p2")!;
    expect(p2.hasLost).toBe(true);
  });

  it("should end the game when only one player remains", () => {
    const state = twoPlayerGame();

    const updatedPlayers = state.players.map((p) =>
      p.id === "p1" ? { ...p, life: 0 } : p,
    );
    const modifiedState: GameState = { ...state, players: updatedPlayers };

    const { state: finalState } = processStateBasedActionsLoop(modifiedState);
    expect(finalState.gameOver).toBe(true);
    expect(finalState.winners).toEqual(["p2"]);
  });

  it("should not fire when all players are healthy", () => {
    const state = twoPlayerGame();
    const result = processStateBasedActions(state);

    expect(result.actionsPerformed).toBe(false);
    expect(result.events).toHaveLength(0);
  });

  it("should eliminate a player with 10+ poison counters", () => {
    const state = twoPlayerGame();

    const updatedPlayers = state.players.map((p) =>
      p.id === "p1" ? { ...p, poisonCounters: 10 } : p,
    );
    const modifiedState: GameState = { ...state, players: updatedPlayers };

    const result = processStateBasedActions(modifiedState);
    const p1 = result.state.players.find((p) => p.id === "p1")!;
    expect(p1.hasLost).toBe(true);
  });
});
