import { describe, it, expect } from "vitest";
import { Lobby } from "../src/lobby/lobby.js";
import type { PlayerConnection } from "../src/game-session/session.js";
import type { ServerMessage } from "../src/websocket/protocol.js";
import type { DecklistEntry } from "@magic-flux/types";

function makePlainsDeck(): DecklistEntry[] {
  return Array.from({ length: 60 }, () => ({
    cardName: "Plains",
    cardDataId: "plains",
    count: 1,
    setCode: null,
    collectorNumber: null,
  }));
}

function mockConnection(playerId: string): PlayerConnection {
  return {
    playerId,
    playerName: playerId,
    send(_msg: ServerMessage) {},
  };
}

describe("Lobby", () => {
  it("should create a game and list it", () => {
    const lobby = new Lobby();

    const session = lobby.createGame(
      "standard", 2,
      "p1", "Player 1",
      makePlainsDeck(),
      mockConnection("p1")
    );

    expect(session.gameId).toBeDefined();
    expect(session.getPlayerCount()).toBe(1);

    const games = lobby.listGames();
    expect(games).toHaveLength(1);
    expect(games[0].format).toBe("standard");
    expect(games[0].creatorName).toBe("Player 1");
  });

  it("should allow a second player to join", () => {
    const lobby = new Lobby();

    const session = lobby.createGame(
      "standard", 2,
      "p1", "Player 1",
      makePlainsDeck(),
      mockConnection("p1")
    );

    const joined = lobby.joinGame(
      session.gameId,
      "p2", "Player 2",
      makePlainsDeck(),
      mockConnection("p2")
    );

    expect(joined).not.toBeNull();
    expect(joined!.getPlayerCount()).toBe(2);
  });

  it("should return null when joining a non-existent game", () => {
    const lobby = new Lobby();
    const result = lobby.joinGame(
      "nonexistent",
      "p1", "Player 1",
      makePlainsDeck(),
      mockConnection("p1")
    );
    expect(result).toBeNull();
  });

  it("should remove a player and clean up empty sessions", () => {
    const lobby = new Lobby();

    const session = lobby.createGame(
      "standard", 2,
      "p1", "Player 1",
      makePlainsDeck(),
      mockConnection("p1")
    );

    expect(lobby.listGames()).toHaveLength(1);

    lobby.leaveGame(session.gameId, "p1");

    // Session should be removed when empty
    expect(lobby.listGames()).toHaveLength(0);
    expect(lobby.getSession(session.gameId)).toBeUndefined();
  });

  it("should not list games that have started", () => {
    const lobby = new Lobby();

    const session = lobby.createGame(
      "standard", 2,
      "p1", "Player 1",
      makePlainsDeck(),
      mockConnection("p1")
    );

    lobby.joinGame(
      session.gameId,
      "p2", "Player 2",
      makePlainsDeck(),
      mockConnection("p2")
    );

    session.start(42, true);

    // Active games should not appear in the lobby list
    const games = lobby.listGames();
    expect(games).toHaveLength(0);
  });
});
