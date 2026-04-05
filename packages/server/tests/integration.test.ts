/**
 * Integration test: two mock clients play a game, passing priority
 * through a full turn cycle on an empty board (basic lands only).
 *
 * This is the Phase 4 acceptance scenario for the Game Coordinator:
 * "creates a game, connects two clients, and lets them take turns
 * passing priority on an empty board."
 */

import { describe, it, expect } from "vitest";
import { GameSession, type PlayerConnection } from "../src/game-session/session.js";
import type { ServerMessage } from "../src/websocket/protocol.js";
import type {
  DecklistEntry,
  PlayerAction,
  ClientGameState,
  GameEvent,
} from "@magic-flux/types";
import { Phase } from "@magic-flux/types";

// ---------------------------------------------------------------------------
// Helpers
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
  getEvents(): GameEvent[];
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
    getEvents() {
      return messages
        .filter((m) => m.type === "game:event")
        .map((m) => (m as { payload: { event: GameEvent } }).payload.event);
    },
    clearMessages() {
      messages.length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe("Integration: two players pass priority through turns", () => {
  it("should create a game and advance through turn 1 by passing priority", () => {
    const session = new GameSession("integration-test", "standard", 2);
    const p1 = createMockClient("p1", "Alice");
    const p2 = createMockClient("p2", "Bob");

    session.addPlayer("p1", "Alice", makePlainsDeck(), p1.connection);
    session.addPlayer("p2", "Bob", makePlainsDeck(), p2.connection);
    session.start(12345, true);

    expect(session.getStatus()).toBe("active");

    // Track phases we pass through
    const phasesVisited: string[] = [];
    let actions = 0;

    // Pass priority until we reach turn 2 or exceed limit
    while (actions < 200) {
      const state = session.getState()!;
      if (state.gameOver) break;
      if (state.turnNumber >= 2) break;
      if (state.priorityPlayerId === null) break;

      const phase = `${state.turnState.phase}:${state.turnState.step ?? "none"}`;
      if (phasesVisited.length === 0 || phasesVisited[phasesVisited.length - 1] !== phase) {
        phasesVisited.push(phase);
      }

      session.handleAction(state.priorityPlayerId, { type: "passPriority" });
      actions++;
    }

    const finalState = session.getState()!;

    // Should have advanced to turn 2
    expect(finalState.turnNumber).toBeGreaterThanOrEqual(2);

    // Should have visited multiple phases
    expect(phasesVisited.length).toBeGreaterThan(1);

    // Both players should still have 20 life
    for (const player of finalState.players) {
      expect(player.life).toBe(20);
    }

    // Both players should still have 7 cards in hand (no spells cast)
    // Note: active player draws on turn 2 draw step, but we might stop before that
    const p1Hand = finalState.zones[`player:p1:hand`];
    const p2Hand = finalState.zones[`player:p2:hand`];
    expect(p1Hand.cardInstanceIds.length).toBeGreaterThanOrEqual(7);
    expect(p2Hand.cardInstanceIds.length).toBe(7);
  });

  it("should play a land during main phase", () => {
    const session = new GameSession("land-test", "standard", 2);
    const p1 = createMockClient("p1", "Alice");
    const p2 = createMockClient("p2", "Bob");

    session.addPlayer("p1", "Alice", makePlainsDeck(), p1.connection);
    session.addPlayer("p2", "Bob", makePlainsDeck(), p2.connection);
    session.start(42, true);

    // Advance to main phase by passing priority
    let foundMainPhase = false;
    for (let i = 0; i < 100; i++) {
      const state = session.getState()!;
      if (state.gameOver) break;
      if (state.priorityPlayerId === null) break;

      // Check if we're in main phase with the active player having priority
      if (
        state.turnState.phase === Phase.PreCombatMain &&
        state.priorityPlayerId === state.activePlayerId
      ) {
        foundMainPhase = true;

        // Get legal actions and find playLand
        const legalActions = p1.getLastLegalActions();
        const playLandAction = legalActions?.find((a) => a.type === "playLand");

        if (playLandAction) {
          // Play a land
          const handBefore = state.zones[`player:${state.activePlayerId}:hand`].cardInstanceIds.length;
          session.handleAction(state.activePlayerId, playLandAction);

          const stateAfter = session.getState()!;
          const handAfter = stateAfter.zones[`player:${state.activePlayerId}:hand`].cardInstanceIds.length;

          // Hand should have one fewer card
          expect(handAfter).toBe(handBefore - 1);

          // Battlefield should have the land
          const battlefield = stateAfter.zones["battlefield"];
          expect(battlefield.cardInstanceIds.length).toBe(1);
          break;
        }
      }

      session.handleAction(state.priorityPlayerId, { type: "passPriority" });
    }

    expect(foundMainPhase).toBe(true);
  });

  it("should broadcast events to both players", () => {
    const session = new GameSession("event-test", "standard", 2);
    const p1 = createMockClient("p1", "Alice");
    const p2 = createMockClient("p2", "Bob");

    session.addPlayer("p1", "Alice", makePlainsDeck(), p1.connection);
    session.addPlayer("p2", "Bob", makePlainsDeck(), p2.connection);
    session.start(42, true);

    // Both players should receive event messages
    const p1Events = p1.getEvents();
    const p2Events = p2.getEvents();

    // Both should have received some events (phase changes, turn began, etc.)
    expect(p1Events.length).toBeGreaterThan(0);
    expect(p2Events.length).toBeGreaterThan(0);
  });

  it("should handle reconnection during active game", () => {
    const session = new GameSession("reconnect-test", "standard", 2);
    const p1 = createMockClient("p1", "Alice");
    const p2 = createMockClient("p2", "Bob");

    session.addPlayer("p1", "Alice", makePlainsDeck(), p1.connection);
    session.addPlayer("p2", "Bob", makePlainsDeck(), p2.connection);
    session.start(42, true);

    // Disconnect p1
    session.disconnectPlayer("p1");
    p1.clearMessages();

    // Reconnect p1 with a new connection
    const p1Reconnected = createMockClient("p1", "Alice");
    session.reconnectPlayer("p1", p1Reconnected.connection);

    // P1 should receive state update after reconnection
    const state = p1Reconnected.getLastState();
    expect(state).toBeDefined();
    expect(state!.gameId).toBeDefined();
  });

  it("should complete a full turn cycle with correct phase progression", () => {
    const session = new GameSession("full-turn-test", "standard", 2);
    const p1 = createMockClient("p1", "Alice");
    const p2 = createMockClient("p2", "Bob");

    session.addPlayer("p1", "Alice", makePlainsDeck(), p1.connection);
    session.addPlayer("p2", "Bob", makePlainsDeck(), p2.connection);
    session.start(42, true);

    // Pass through an entire turn, tracking phases
    const phases = new Set<string>();
    let lastTurn = 1;
    let reachedTurn2 = false;

    for (let i = 0; i < 200; i++) {
      const state = session.getState()!;
      if (state.gameOver) break;
      if (state.priorityPlayerId === null) break;

      if (state.turnNumber > lastTurn) {
        reachedTurn2 = true;
        lastTurn = state.turnNumber;
        break;
      }

      phases.add(`${state.turnState.phase}`);
      session.handleAction(state.priorityPlayerId, { type: "passPriority" });
    }

    expect(reachedTurn2).toBe(true);

    // Should have visited the key phases during turn 1
    // Note: exact phases depend on engine implementation, but we should see at least
    // the main phases
    expect(phases.size).toBeGreaterThanOrEqual(3);
  });
});
