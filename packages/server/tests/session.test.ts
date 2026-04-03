import { describe, it, expect } from "vitest";
import { GameSession, type PlayerConnection } from "../src/game-session/session.js";
import type { ServerMessage } from "../src/websocket/protocol.js";
import type { DecklistEntry, PlayerAction, ClientGameState } from "@magic-flux/types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makePlainsDeck(): DecklistEntry[] {
  return Array.from({ length: 60 }, () => ({
    cardName: "Plains",
    cardDataId: "plains",
    count: 1,
    setCode: null,
    collectorNumber: null,
  }));
}

interface MockClient {
  readonly playerId: string;
  readonly messages: ServerMessage[];
  readonly connection: PlayerConnection;
  getLastState(): ClientGameState | undefined;
  getLastLegalActions(): PlayerAction[] | undefined;
  clearMessages(): void;
}

function createMockClient(playerId: string, playerName: string): MockClient {
  const messages: ServerMessage[] = [];
  const connection: PlayerConnection = {
    playerId,
    playerName,
    send(message: ServerMessage) {
      messages.push(message);
    },
  };

  return {
    playerId,
    messages,
    connection,
    getLastState() {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].type === "game:stateUpdate") {
          return (messages[i] as { payload: { gameState: ClientGameState } }).payload.gameState;
        }
      }
      return undefined;
    },
    getLastLegalActions() {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].type === "game:legalActions") {
          return (messages[i] as { payload: { actions: PlayerAction[] } }).payload.actions as PlayerAction[];
        }
      }
      return undefined;
    },
    clearMessages() {
      messages.length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GameSession", () => {
  it("should create a session with correct initial state", () => {
    const session = new GameSession("test-game", "standard", 2);
    expect(session.gameId).toBe("test-game");
    expect(session.format).toBe("standard");
    expect(session.getStatus()).toBe("waiting");
    expect(session.getPlayerCount()).toBe(0);
  });

  it("should add and remove players before game starts", () => {
    const session = new GameSession("test-game", "standard", 2);
    const client = createMockClient("p1", "Player 1");

    expect(session.addPlayer("p1", "Player 1", makePlainsDeck(), client.connection)).toBe(true);
    expect(session.getPlayerCount()).toBe(1);
    expect(session.hasPlayer("p1")).toBe(true);

    expect(session.removePlayer("p1")).toBe(true);
    expect(session.getPlayerCount()).toBe(0);
  });

  it("should not add more players than maxPlayers", () => {
    const session = new GameSession("test-game", "standard", 2);
    const c1 = createMockClient("p1", "Player 1");
    const c2 = createMockClient("p2", "Player 2");
    const c3 = createMockClient("p3", "Player 3");

    session.addPlayer("p1", "Player 1", makePlainsDeck(), c1.connection);
    session.addPlayer("p2", "Player 2", makePlainsDeck(), c2.connection);
    expect(session.addPlayer("p3", "Player 3", makePlainsDeck(), c3.connection)).toBe(false);
  });

  it("should not allow duplicate player IDs", () => {
    const session = new GameSession("test-game", "standard", 2);
    const c1 = createMockClient("p1", "Player 1");

    session.addPlayer("p1", "Player 1", makePlainsDeck(), c1.connection);
    expect(session.addPlayer("p1", "Player 1 Dup", makePlainsDeck(), c1.connection)).toBe(false);
  });

  it("should start a game with two players", () => {
    const session = new GameSession("test-game", "standard", 2);
    const c1 = createMockClient("p1", "Player 1");
    const c2 = createMockClient("p2", "Player 2");

    session.addPlayer("p1", "Player 1", makePlainsDeck(), c1.connection);
    session.addPlayer("p2", "Player 2", makePlainsDeck(), c2.connection);

    expect(session.canStart()).toBe(true);
    session.start(42);
    expect(session.getStatus()).toBe("active");

    const state = session.getState();
    expect(state).not.toBeNull();
    expect(state!.players).toHaveLength(2);
    expect(state!.turnNumber).toBe(1);
  });

  it("should send state and legal actions to the priority player after start", () => {
    const session = new GameSession("test-game", "standard", 2);
    const c1 = createMockClient("p1", "Player 1");
    const c2 = createMockClient("p2", "Player 2");

    session.addPlayer("p1", "Player 1", makePlainsDeck(), c1.connection);
    session.addPlayer("p2", "Player 2", makePlainsDeck(), c2.connection);
    session.start(42);

    // P1 is the active player, should get state update and legal actions
    const state = c1.getLastState();
    expect(state).toBeDefined();

    const legalActions = c1.getLastLegalActions();
    expect(legalActions).toBeDefined();
    expect(legalActions!.length).toBeGreaterThan(0);
    // At minimum, passPriority should be available
    expect(legalActions!.some((a) => a.type === "passPriority")).toBe(true);
  });

  it("should reject actions from non-priority players", () => {
    const session = new GameSession("test-game", "standard", 2);
    const c1 = createMockClient("p1", "Player 1");
    const c2 = createMockClient("p2", "Player 2");

    session.addPlayer("p1", "Player 1", makePlainsDeck(), c1.connection);
    session.addPlayer("p2", "Player 2", makePlainsDeck(), c2.connection);
    session.start(42);

    // P2 should not be able to act (P1 has priority)
    c2.clearMessages();
    session.handleAction("p2", { type: "passPriority" });

    const errors = c2.messages.filter((m) => m.type === "game:error");
    expect(errors.length).toBe(1);
  });

  it("should filter state per player (own hand visible, opponent hand hidden)", () => {
    const session = new GameSession("test-game", "standard", 2);
    const c1 = createMockClient("p1", "Player 1");
    const c2 = createMockClient("p2", "Player 2");

    session.addPlayer("p1", "Player 1", makePlainsDeck(), c1.connection);
    session.addPlayer("p2", "Player 2", makePlainsDeck(), c2.connection);
    session.start(42);

    const p1State = c1.getLastState()!;
    const p1Hand = p1State.zones["player:p1:hand"];
    // Own hand visible
    if ("cardInstanceIds" in p1Hand) {
      expect(p1Hand.cardInstanceIds).not.toBeNull();
    }

    // Opponent hand hidden
    const p2HandFromP1 = p1State.zones["player:p2:hand"];
    if ("cardInstanceIds" in p2HandFromP1) {
      expect(p2HandFromP1.cardInstanceIds).toBeNull();
    }
  });

  it("should advance through phases when all players pass priority", () => {
    const session = new GameSession("test-game", "standard", 2);
    const c1 = createMockClient("p1", "Player 1");
    const c2 = createMockClient("p2", "Player 2");

    session.addPlayer("p1", "Player 1", makePlainsDeck(), c1.connection);
    session.addPlayer("p2", "Player 2", makePlainsDeck(), c2.connection);
    session.start(42);

    // Get initial state
    const initialState = session.getState()!;
    const initialPhase = initialState.turnState.phase;

    // Both players pass priority repeatedly to advance through phases
    let lastPhase = initialPhase;
    let phaseChanges = 0;

    for (let i = 0; i < 50; i++) {
      const state = session.getState()!;
      if (state.gameOver) break;
      if (state.priorityPlayerId === null) break;

      const currentPhase = state.turnState.phase;
      if (currentPhase !== lastPhase) {
        phaseChanges++;
        lastPhase = currentPhase;
      }

      session.handleAction(state.priorityPlayerId, { type: "passPriority" });
    }

    // Should have advanced through at least a few phases
    expect(phaseChanges).toBeGreaterThan(0);
  });

  it("should handle concede action", () => {
    const session = new GameSession("test-game", "standard", 2);
    const c1 = createMockClient("p1", "Player 1");
    const c2 = createMockClient("p2", "Player 2");

    session.addPlayer("p1", "Player 1", makePlainsDeck(), c1.connection);
    session.addPlayer("p2", "Player 2", makePlainsDeck(), c2.connection);
    session.start(42);

    // P1 concedes (concede is always legal regardless of priority)
    session.handleAction("p1", { type: "concede" });

    const state = session.getState()!;
    expect(state.gameOver).toBe(true);
  });
});
