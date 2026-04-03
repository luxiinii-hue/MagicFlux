import { describe, it, expect } from "vitest";
import { filterStateForPlayer } from "../src/game-session/state-filter.js";
import { createGame } from "@magic-flux/engine";
import type { GameConfig, GameState } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

function makeTestGame(): GameState {
  const config: GameConfig = {
    format: "standard",
    players: [
      {
        id: "p1",
        name: "Player 1",
        decklist: Array.from({ length: 60 }, () => ({
          cardName: "Plains",
          cardDataId: "plains",
          count: 1,
          setCode: null,
          collectorNumber: null,
        })),
      },
      {
        id: "p2",
        name: "Player 2",
        decklist: Array.from({ length: 60 }, () => ({
          cardName: "Island",
          cardDataId: "island",
          count: 1,
          setCode: null,
          collectorNumber: null,
        })),
      },
    ],
    seed: 42,
  };
  return createGame(config);
}

describe("filterStateForPlayer", () => {
  it("should include the viewing player's hand cards", () => {
    const state = makeTestGame();
    const filtered = filterStateForPlayer(state, "p1");

    const handZone = filtered.zones["player:p1:hand"];
    expect(handZone).toBeDefined();
    expect(handZone.type).toBe("Hand");
    // Own hand: should have card IDs
    if ("cardInstanceIds" in handZone && handZone.cardInstanceIds !== null) {
      expect(handZone.cardInstanceIds.length).toBe(7);
      // All hand cards should be in cardInstances
      for (const id of handZone.cardInstanceIds) {
        expect(filtered.cardInstances[id]).toBeDefined();
      }
    } else {
      throw new Error("Expected own hand to have cardInstanceIds");
    }
  });

  it("should hide the opponent's hand cards", () => {
    const state = makeTestGame();
    const filtered = filterStateForPlayer(state, "p1");

    const opponentHand = filtered.zones["player:p2:hand"];
    expect(opponentHand).toBeDefined();
    expect(opponentHand.type).toBe("Hand");
    if ("cardInstanceIds" in opponentHand) {
      expect(opponentHand.cardInstanceIds).toBeNull();
    }
    if ("cardCount" in opponentHand) {
      expect(opponentHand.cardCount).toBe(7);
    }
  });

  it("should hide library contents, showing only count", () => {
    const state = makeTestGame();
    const filtered = filterStateForPlayer(state, "p1");

    // Own library
    const ownLib = filtered.zones["player:p1:library"];
    expect(ownLib).toBeDefined();
    expect(ownLib.type).toBe("Library");
    if ("cardCount" in ownLib) {
      expect(ownLib.cardCount).toBe(53); // 60 - 7 drawn
    }
    expect("cardInstanceIds" in ownLib).toBe(false);

    // Opponent library
    const oppLib = filtered.zones["player:p2:library"];
    expect(oppLib).toBeDefined();
    expect(oppLib.type).toBe("Library");
    if ("cardCount" in oppLib) {
      expect(oppLib.cardCount).toBe(53);
    }
  });

  it("should not include library cards in cardInstances", () => {
    const state = makeTestGame();
    const filtered = filterStateForPlayer(state, "p1");

    // Library cards should NOT be in the filtered cardInstances
    const libZone = state.zones["player:p1:library"];
    for (const cardId of libZone.cardInstanceIds) {
      expect(filtered.cardInstances[cardId]).toBeUndefined();
    }
  });

  it("should not include opponent hand cards in cardInstances", () => {
    const state = makeTestGame();
    const filtered = filterStateForPlayer(state, "p1");

    // Opponent's hand cards should NOT be in filtered cardInstances
    const oppHand = state.zones["player:p2:hand"];
    for (const cardId of oppHand.cardInstanceIds) {
      expect(filtered.cardInstances[cardId]).toBeUndefined();
    }
  });

  it("should include public zone cards (battlefield, graveyard)", () => {
    const state = makeTestGame();
    const filtered = filterStateForPlayer(state, "p1");

    // Battlefield should be present (even if empty)
    expect(filtered.zones["battlefield"]).toBeDefined();
    // Graveyards should be present
    expect(filtered.zones["player:p1:graveyard"]).toBeDefined();
    expect(filtered.zones["player:p2:graveyard"]).toBeDefined();
  });

  it("should preserve game metadata", () => {
    const state = makeTestGame();
    const filtered = filterStateForPlayer(state, "p1");

    expect(filtered.gameId).toBe(state.gameId);
    expect(filtered.turnNumber).toBe(state.turnNumber);
    expect(filtered.activePlayerId).toBe(state.activePlayerId);
    expect(filtered.format).toBe("standard");
    expect(filtered.gameOver).toBe(false);
    expect(filtered.players).toHaveLength(2);
  });

  it("should produce different views for different players", () => {
    const state = makeTestGame();
    const filteredP1 = filterStateForPlayer(state, "p1");
    const filteredP2 = filterStateForPlayer(state, "p2");

    // P1 sees own hand
    const p1Hand = filteredP1.zones["player:p1:hand"];
    if ("cardInstanceIds" in p1Hand) {
      expect(p1Hand.cardInstanceIds).not.toBeNull();
    }

    // P2 does NOT see P1's hand
    const p1HandFromP2 = filteredP2.zones["player:p1:hand"];
    if ("cardInstanceIds" in p1HandFromP2) {
      expect(p1HandFromP2.cardInstanceIds).toBeNull();
    }

    // P2 sees own hand
    const p2Hand = filteredP2.zones["player:p2:hand"];
    if ("cardInstanceIds" in p2Hand) {
      expect(p2Hand.cardInstanceIds).not.toBeNull();
    }
  });
});
