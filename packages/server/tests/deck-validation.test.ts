import { describe, it, expect } from "vitest";
import { handleClientMessage, type ConnectedClient } from "../src/websocket/handlers.js";
import { Lobby } from "../src/lobby/lobby.js";
import type { ServerMessage, ClientMessage } from "../src/websocket/protocol.js";
import type { DecklistEntry } from "@magic-flux/types";

function makePlainsDeck(count: number): DecklistEntry[] {
  return Array.from({ length: count }, () => ({
    cardName: "Plains",
    cardDataId: "plains",
    count: 1,
    setCode: null,
    collectorNumber: null,
  }));
}

function createTestClient(id: string): ConnectedClient & { messages: ServerMessage[] } {
  const messages: ServerMessage[] = [];
  return {
    clientId: id,
    playerName: `Player ${id}`,
    messages,
    send(msg: ServerMessage) {
      messages.push(msg);
    },
  };
}

describe("Deck validation in lobby flow", () => {
  it("should validate deck on game creation and return validation result", () => {
    const lobby = new Lobby();
    const client = createTestClient("p1");

    const msg: ClientMessage = {
      type: "lobby:createGame",
      payload: {
        format: "standard",
        maxPlayers: 2,
        decklist: makePlainsDeck(60),
      },
    };

    handleClientMessage(client, msg, lobby);

    // Should receive a deck validation message
    const validationMsg = client.messages.find((m) => m.type === "lobby:deckValidation");
    expect(validationMsg).toBeDefined();
    expect(validationMsg!.type).toBe("lobby:deckValidation");

    if (validationMsg!.type === "lobby:deckValidation") {
      expect(validationMsg!.payload.valid).toBe(true);
    }

    // Should also receive gameCreated since deck is valid
    const createdMsg = client.messages.find((m) => m.type === "lobby:gameCreated");
    expect(createdMsg).toBeDefined();
  });

  it("should reject a deck that is too small", () => {
    const lobby = new Lobby();
    const client = createTestClient("p1");

    const msg: ClientMessage = {
      type: "lobby:createGame",
      payload: {
        format: "standard",
        maxPlayers: 2,
        decklist: makePlainsDeck(30), // Too few cards
      },
    };

    handleClientMessage(client, msg, lobby);

    const validationMsg = client.messages.find((m) => m.type === "lobby:deckValidation");
    expect(validationMsg).toBeDefined();

    if (validationMsg!.type === "lobby:deckValidation") {
      expect(validationMsg!.payload.valid).toBe(false);
      expect(validationMsg!.payload.errors.length).toBeGreaterThan(0);
    }

    // Should NOT receive gameCreated
    const createdMsg = client.messages.find((m) => m.type === "lobby:gameCreated");
    expect(createdMsg).toBeUndefined();
  });

  it("should validate deck on game join", () => {
    const lobby = new Lobby();
    const creator = createTestClient("p1");
    const joiner = createTestClient("p2");

    // Create a game with valid deck
    handleClientMessage(creator, {
      type: "lobby:createGame",
      payload: {
        format: "standard",
        maxPlayers: 2,
        decklist: makePlainsDeck(60),
      },
    }, lobby);

    const createdMsg = creator.messages.find((m) => m.type === "lobby:gameCreated");
    expect(createdMsg).toBeDefined();
    const gameId = (createdMsg as { payload: { gameId: string } }).payload.gameId;

    // Join with invalid deck
    handleClientMessage(joiner, {
      type: "lobby:joinGame",
      payload: {
        gameId,
        decklist: makePlainsDeck(10), // Too few cards
      },
    }, lobby);

    const validationMsg = joiner.messages.find((m) => m.type === "lobby:deckValidation");
    expect(validationMsg).toBeDefined();

    if (validationMsg!.type === "lobby:deckValidation") {
      expect(validationMsg!.payload.valid).toBe(false);
    }

    // Game should still be in waiting state (joiner rejected)
    const session = lobby.getSession(gameId);
    expect(session).toBeDefined();
    expect(session!.getPlayerCount()).toBe(1); // Only creator
  });

  it("should reject invalid format", () => {
    const lobby = new Lobby();
    const client = createTestClient("p1");

    handleClientMessage(client, {
      type: "lobby:createGame",
      payload: {
        format: "vintage", // Not supported
        maxPlayers: 2,
        decklist: makePlainsDeck(60),
      },
    }, lobby);

    const errorMsg = client.messages.find((m) => m.type === "game:error");
    expect(errorMsg).toBeDefined();
  });
});
