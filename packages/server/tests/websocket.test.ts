/**
 * Real WebSocket integration test.
 *
 * Starts the actual server, connects two ws clients, creates a game,
 * joins, and plays through priority passes over real WebSocket.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import WebSocket from "ws";
import { createMagicFluxServer, type MagicFluxServer } from "../src/websocket/server.js";
import type { ServerMessage, ClientMessage } from "../src/websocket/protocol.js";
import type { DecklistEntry } from "@magic-flux/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_PORT = 18273; // Unlikely to conflict

function makePlainsDeck(): DecklistEntry[] {
  return Array.from({ length: 60 }, () => ({
    cardName: "Plains",
    cardDataId: "plains",
    count: 1,
    setCode: null,
    collectorNumber: null,
  }));
}

/** Connect a ws client and wait for the connection to open. */
function connectClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

/** Send a message and collect all responses until a predicate is met or timeout. */
function sendAndCollect(
  ws: WebSocket,
  message: ClientMessage,
  predicate: (msgs: ServerMessage[]) => boolean,
  timeoutMs = 3000
): Promise<ServerMessage[]> {
  return new Promise((resolve, reject) => {
    const collected: ServerMessage[] = [];
    const timeout = setTimeout(() => {
      cleanup();
      resolve(collected); // Resolve with what we have instead of rejecting
    }, timeoutMs);

    function onMessage(data: WebSocket.Data) {
      const msg = JSON.parse(data.toString()) as ServerMessage;
      collected.push(msg);
      if (predicate(collected)) {
        cleanup();
        resolve(collected);
      }
    }

    function cleanup() {
      clearTimeout(timeout);
      ws.off("message", onMessage);
    }

    ws.on("message", onMessage);
    ws.send(JSON.stringify(message));
  });
}

/** Collect messages without sending, until predicate or timeout. */
function collect(
  ws: WebSocket,
  predicate: (msgs: ServerMessage[]) => boolean,
  timeoutMs = 3000
): Promise<ServerMessage[]> {
  return new Promise((resolve) => {
    const collected: ServerMessage[] = [];
    const timeout = setTimeout(() => {
      cleanup();
      resolve(collected);
    }, timeoutMs);

    function onMessage(data: WebSocket.Data) {
      const msg = JSON.parse(data.toString()) as ServerMessage;
      collected.push(msg);
      if (predicate(collected)) {
        cleanup();
        resolve(collected);
      }
    }

    function cleanup() {
      clearTimeout(timeout);
      ws.off("message", onMessage);
    }

    ws.on("message", onMessage);
  });
}

/** Drain any pending messages from ws. */
function drain(ws: WebSocket, ms = 100): Promise<ServerMessage[]> {
  return collect(ws, () => false, ms);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Real WebSocket integration", () => {
  let server: MagicFluxServer;
  const openClients: WebSocket[] = [];

  beforeAll(async () => {
    server = createMagicFluxServer({ port: TEST_PORT });
    await server.start();
  });

  afterEach(() => {
    // Close all clients opened during test
    for (const ws of openClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    openClients.length = 0;
  });

  afterAll(async () => {
    await server.stop();
  });

  function trackClient(ws: WebSocket): WebSocket {
    openClients.push(ws);
    return ws;
  }

  it("should accept WebSocket connections", async () => {
    const ws = trackClient(await connectClient(TEST_PORT));
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });

  it("should return game list on lobby:listGames", async () => {
    const ws = trackClient(await connectClient(TEST_PORT));

    const msgs = await sendAndCollect(
      ws,
      { type: "lobby:listGames", payload: {} as Record<string, never> },
      (m) => m.some((msg) => msg.type === "lobby:gameList")
    );

    const listMsg = msgs.find((m) => m.type === "lobby:gameList");
    expect(listMsg).toBeDefined();
    if (listMsg?.type === "lobby:gameList") {
      expect(Array.isArray(listMsg.payload.games)).toBe(true);
    }
  });

  it("should create a game and return gameCreated", async () => {
    const ws = trackClient(await connectClient(TEST_PORT));

    const msgs = await sendAndCollect(
      ws,
      {
        type: "lobby:createGame",
        payload: {
          format: "standard",
          maxPlayers: 2,
          decklist: makePlainsDeck(),
        },
      },
      (m) => m.some((msg) => msg.type === "lobby:gameCreated")
    );

    const created = msgs.find((m) => m.type === "lobby:gameCreated");
    expect(created).toBeDefined();
    if (created?.type === "lobby:gameCreated") {
      expect(created.payload.gameId).toBeDefined();
      expect(created.payload.format).toBe("standard");
      expect(created.payload.playerCount).toBe(1);
    }

    // Should also have deck validation
    const validation = msgs.find((m) => m.type === "lobby:deckValidation");
    expect(validation).toBeDefined();
    if (validation?.type === "lobby:deckValidation") {
      expect(validation.payload.valid).toBe(true);
    }
  });

  it("should reject invalid deck over WebSocket", async () => {
    const ws = trackClient(await connectClient(TEST_PORT));

    const msgs = await sendAndCollect(
      ws,
      {
        type: "lobby:createGame",
        payload: {
          format: "standard",
          maxPlayers: 2,
          decklist: makePlainsDeck().slice(0, 10), // Only 10 cards
        },
      },
      (m) => m.some((msg) => msg.type === "lobby:deckValidation")
    );

    const validation = msgs.find((m) => m.type === "lobby:deckValidation");
    expect(validation).toBeDefined();
    if (validation?.type === "lobby:deckValidation") {
      expect(validation.payload.valid).toBe(false);
      expect(validation.payload.errors.length).toBeGreaterThan(0);
    }

    // Should NOT get gameCreated
    const created = msgs.find((m) => m.type === "lobby:gameCreated");
    expect(created).toBeUndefined();
  });

  it("should play a full game: create, join, pass priority over WebSocket", async () => {
    const ws1 = trackClient(await connectClient(TEST_PORT));
    const ws2 = trackClient(await connectClient(TEST_PORT));

    // Accumulate all messages per client
    const p1Msgs: ServerMessage[] = [];
    const p2Msgs: ServerMessage[] = [];
    ws1.on("message", (d) => p1Msgs.push(JSON.parse(d.toString())));
    ws2.on("message", (d) => p2Msgs.push(JSON.parse(d.toString())));

    // Player 1 creates game
    ws1.send(JSON.stringify({
      type: "lobby:createGame",
      payload: { format: "standard", maxPlayers: 2, decklist: makePlainsDeck() },
    }));
    await new Promise((r) => setTimeout(r, 200));

    const created = p1Msgs.find((m) => m.type === "lobby:gameCreated");
    expect(created).toBeDefined();
    const gameId = (created as { type: "lobby:gameCreated"; payload: { gameId: string } }).payload.gameId;

    // Player 2 joins — game auto-starts
    ws2.send(JSON.stringify({
      type: "lobby:joinGame",
      payload: { gameId, decklist: makePlainsDeck() },
    }));
    await new Promise((r) => setTimeout(r, 500));

    // Both should have received state updates
    const p1States = p1Msgs.filter((m) => m.type === "game:stateUpdate");
    const p2States = p2Msgs.filter((m) => m.type === "game:stateUpdate");
    expect(p1States.length).toBeGreaterThan(0);
    expect(p2States.length).toBeGreaterThan(0);

    // The priority player should have received legalActions
    const allMsgs = [...p1Msgs, ...p2Msgs];
    const legalActionsMsg = allMsgs.find((m) => m.type === "game:legalActions");
    expect(legalActionsMsg).toBeDefined();
    if (legalActionsMsg?.type === "game:legalActions") {
      expect(legalActionsMsg.payload.actions.some((a) => a.type === "passPriority")).toBe(true);
    }

    // Pass priority from p1 (first player = active player)
    p1Msgs.length = 0;
    p2Msgs.length = 0;
    ws1.send(JSON.stringify({
      type: "game:action",
      payload: { gameId, action: { type: "passPriority" } },
    }));
    await new Promise((r) => setTimeout(r, 500));

    // Should get responses (events, state updates, or legal actions for next player)
    const afterPass = [...p1Msgs, ...p2Msgs];
    expect(afterPass.length).toBeGreaterThan(0);

    // At least one player should have received a new state or events
    const hasState = afterPass.some((m) => m.type === "game:stateUpdate");
    const hasEvent = afterPass.some((m) => m.type === "game:event");
    const hasLegal = afterPass.some((m) => m.type === "game:legalActions");
    expect(hasState || hasEvent || hasLegal).toBe(true);
  });

  it("should return error for malformed JSON", async () => {
    const ws = trackClient(await connectClient(TEST_PORT));

    const msgs: ServerMessage[] = [];
    const done = new Promise<void>((resolve) => {
      ws.on("message", (data) => {
        msgs.push(JSON.parse(data.toString()));
        resolve();
      });
    });

    ws.send("not valid json{{{");
    await done;

    expect(msgs.length).toBe(1);
    expect(msgs[0].type).toBe("game:error");
    if (msgs[0].type === "game:error") {
      expect(msgs[0].payload.code).toBe("PARSE_ERROR");
    }
  });

  it("should return error for action on non-existent game", async () => {
    const ws = trackClient(await connectClient(TEST_PORT));

    const msgs = await sendAndCollect(
      ws,
      {
        type: "game:action",
        payload: { gameId: "no-such-game", action: { type: "passPriority" } },
      },
      (m) => m.some((msg) => msg.type === "game:error")
    );

    const err = msgs.find((m) => m.type === "game:error");
    expect(err).toBeDefined();
    if (err?.type === "game:error") {
      expect(err.payload.code).toBe("GAME_NOT_FOUND");
    }
  });
});
