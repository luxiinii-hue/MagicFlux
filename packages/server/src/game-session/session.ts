/**
 * Game session — manages a single game's lifecycle.
 *
 * Orchestrates engine calls according to the game loop pseudocode in
 * api-contracts.md. The session is event-driven: it advances the game
 * state whenever a player action arrives, then waits for the next action.
 */

import type {
  GameState,
  GameConfig,
  GameEvent,
  PlayerAction,
  ClientGameState,
  GameFormat,
  DecklistEntry,
} from "@magic-flux/types";
import {
  createGame,
  getGameStatus,
  executeAction,
  getLegalActions,
  processStateBasedActions,
  checkTriggeredAbilities,
  advancePhase,
} from "@magic-flux/engine";
import { filterStateForPlayer } from "./state-filter.js";
import { formatEventLog } from "./event-log.js";
import type {
  ServerMessage,
  StateUpdateMessage,
  LegalActionsMessage,
  GameEventMessage,
  GameErrorMessage,
  GameOverMessage,
} from "../websocket/protocol.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlayerConnection {
  readonly playerId: string;
  readonly playerName: string;
  send(message: ServerMessage): void;
}

export type SessionStatus = "waiting" | "active" | "finished";

interface PlayerSlot {
  readonly playerId: string;
  readonly playerName: string;
  readonly decklist: readonly DecklistEntry[];
  connection: PlayerConnection | null;
}

// ---------------------------------------------------------------------------
// GameSession
// ---------------------------------------------------------------------------

export class GameSession {
  readonly gameId: string;
  readonly format: GameFormat;
  readonly maxPlayers: number;

  private state: GameState | null = null;
  private readonly playerSlots: PlayerSlot[] = [];
  private status: SessionStatus = "waiting";

  constructor(gameId: string, format: GameFormat, maxPlayers: number) {
    this.gameId = gameId;
    this.format = format;
    this.maxPlayers = maxPlayers;
  }

  getStatus(): SessionStatus {
    return this.status;
  }

  getPlayerCount(): number {
    return this.playerSlots.length;
  }

  getPlayerIds(): string[] {
    return this.playerSlots.map((s) => s.playerId);
  }

  hasPlayer(playerId: string): boolean {
    return this.playerSlots.some((s) => s.playerId === playerId);
  }

  getCreatorName(): string {
    return this.playerSlots[0]?.playerName ?? "";
  }

  // -------------------------------------------------------------------------
  // Player management
  // -------------------------------------------------------------------------

  addPlayer(
    playerId: string,
    playerName: string,
    decklist: readonly DecklistEntry[],
    connection: PlayerConnection
  ): boolean {
    if (this.status !== "waiting") return false;
    if (this.playerSlots.length >= this.maxPlayers) return false;
    if (this.hasPlayer(playerId)) return false;

    this.playerSlots.push({
      playerId,
      playerName,
      decklist,
      connection,
    });
    return true;
  }

  removePlayer(playerId: string): boolean {
    if (this.status !== "waiting") return false;
    const idx = this.playerSlots.findIndex((s) => s.playerId === playerId);
    if (idx === -1) return false;
    this.playerSlots.splice(idx, 1);
    return true;
  }

  reconnectPlayer(playerId: string, connection: PlayerConnection): boolean {
    const slot = this.playerSlots.find((s) => s.playerId === playerId);
    if (!slot) return false;
    slot.connection = connection;

    // If game is active, send current state
    if (this.state) {
      this.sendStateToPlayer(playerId);
      this.sendLegalActionsIfPriority(playerId);
    }
    return true;
  }

  disconnectPlayer(playerId: string): void {
    const slot = this.playerSlots.find((s) => s.playerId === playerId);
    if (slot) {
      slot.connection = null;
    }
  }

  // -------------------------------------------------------------------------
  // Game lifecycle
  // -------------------------------------------------------------------------

  canStart(): boolean {
    return (
      this.status === "waiting" &&
      this.playerSlots.length >= 2 &&
      this.playerSlots.length <= this.maxPlayers
    );
  }

  start(seed?: number): void {
    if (!this.canStart()) {
      throw new Error("Cannot start game: not enough players or wrong status");
    }

    const config: GameConfig = {
      format: this.format,
      players: this.playerSlots.map((slot) => ({
        id: slot.playerId,
        name: slot.playerName,
        decklist: slot.decklist,
      })),
      seed,
    };

    this.state = createGame(config);
    this.status = "active";

    // Run the initial game loop step (advance past untap, grant priority)
    this.runGameLoop();
  }

  // -------------------------------------------------------------------------
  // Action handling
  // -------------------------------------------------------------------------

  handleAction(playerId: string, action: PlayerAction): void {
    if (this.status !== "active" || !this.state) {
      this.sendError(playerId, "GAME_NOT_ACTIVE", "Game is not active");
      return;
    }

    // Validate it's this player's turn to act
    if (this.state.priorityPlayerId !== playerId && action.type !== "concede") {
      this.sendError(playerId, "NOT_YOUR_PRIORITY", "You do not have priority");
      return;
    }

    const result = executeAction(this.state, action);

    if (!result.success) {
      this.sendError(playerId, result.error.code, result.error.message);
      return;
    }

    this.state = result.state;
    this.broadcastEvents(result.events);

    // Continue the game loop
    this.runGameLoop();
  }

  // -------------------------------------------------------------------------
  // Game loop (per api-contracts.md)
  // -------------------------------------------------------------------------

  private runGameLoop(): void {
    if (!this.state) return;

    // Loop until we need player input or game ends
    let iterations = 0;
    const MAX_ITERATIONS = 1000; // Safety valve

    while (iterations++ < MAX_ITERATIONS) {
      // Check for game over
      const status = getGameStatus(this.state);
      if (status.isOver) {
        this.status = "finished";
        this.broadcastGameOver();
        return;
      }

      // 1. State-based actions (loop until stable)
      const sbaResult = this.processSBAs();
      if (sbaResult.stateChanged) {
        continue; // Re-check after SBAs
      }

      // 2. Check triggered abilities
      const triggers = checkTriggeredAbilities(
        this.state,
        this.state.pendingEvents
      );
      if (triggers.length > 0) {
        // Add triggers to the stack
        let newState = this.state;
        for (const trigger of triggers) {
          newState = {
            ...newState,
            stack: [trigger.id, ...newState.stack],
            stackItems: { ...newState.stackItems, [trigger.id]: trigger },
          };
        }
        // Clear pending events
        this.state = { ...newState, pendingEvents: [] };
        continue; // Re-check SBAs
      }

      // Clear any remaining pending events
      if (this.state.pendingEvents.length > 0) {
        this.state = { ...this.state, pendingEvents: [] };
      }

      // 3. Check priority
      if (this.state.priorityPlayerId === null) {
        // No priority (untap, cleanup) — advance phase
        const result = advancePhase(this.state);
        this.state = result.state;
        this.broadcastEvents(result.events);
        continue;
      }

      // 4. We need player input — send state and legal actions
      this.broadcastState();
      this.sendLegalActionsIfPriority(this.state.priorityPlayerId);
      return; // Wait for player action
    }

    // Safety: should never hit this
    console.error(`[GameSession ${this.gameId}] Game loop exceeded ${MAX_ITERATIONS} iterations`);
  }

  private processSBAs(): { stateChanged: boolean } {
    if (!this.state) return { stateChanged: false };

    let anyPerformed = false;
    let result;

    do {
      result = processStateBasedActions(this.state);
      this.state = result.state;
      if (result.events.length > 0) {
        this.broadcastEvents(result.events);
      }
      if (result.actionsPerformed) {
        anyPerformed = true;
      }
    } while (result.actionsPerformed);

    return { stateChanged: anyPerformed };
  }

  // -------------------------------------------------------------------------
  // Broadcasting
  // -------------------------------------------------------------------------

  private broadcastState(): void {
    for (const slot of this.playerSlots) {
      if (slot.connection) {
        this.sendStateToPlayer(slot.playerId);
      }
    }
  }

  private sendStateToPlayer(playerId: string): void {
    if (!this.state) return;
    const slot = this.playerSlots.find((s) => s.playerId === playerId);
    if (!slot?.connection) return;

    const clientState = filterStateForPlayer(this.state, playerId);
    const msg: StateUpdateMessage = {
      type: "game:stateUpdate",
      payload: { gameState: clientState },
    };
    slot.connection.send(msg);
  }

  private sendLegalActionsIfPriority(playerId: string): void {
    if (!this.state || this.state.priorityPlayerId !== playerId) return;

    const slot = this.playerSlots.find((s) => s.playerId === playerId);
    if (!slot?.connection) return;

    const actions = getLegalActions(this.state, playerId);
    const msg: LegalActionsMessage = {
      type: "game:legalActions",
      payload: { actions },
    };
    slot.connection.send(msg);
  }

  private broadcastEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      const logMessage = formatEventLog(event);
      const msg: GameEventMessage = {
        type: "game:event",
        payload: { event, logMessage },
      };
      for (const slot of this.playerSlots) {
        slot.connection?.send(msg);
      }
    }
  }

  private broadcastGameOver(): void {
    if (!this.state) return;

    const status = getGameStatus(this.state);
    const msg: GameOverMessage = {
      type: "game:over",
      payload: {
        winners: [...status.winners],
        losers: [...status.losers],
        reason: status.isOver ? "Game ended" : "Unknown",
      },
    };
    for (const slot of this.playerSlots) {
      slot.connection?.send(msg);
    }

    // Also send final state
    this.broadcastState();
  }

  private sendError(playerId: string, code: string, message: string): void {
    const slot = this.playerSlots.find((s) => s.playerId === playerId);
    if (!slot?.connection) return;

    const msg: GameErrorMessage = {
      type: "game:error",
      payload: { code, message },
    };
    slot.connection.send(msg);
  }

  // -------------------------------------------------------------------------
  // State access (for testing/inspection)
  // -------------------------------------------------------------------------

  getState(): GameState | null {
    return this.state;
  }

  getFilteredState(playerId: string): ClientGameState | null {
    if (!this.state) return null;
    return filterStateForPlayer(this.state, playerId);
  }
}
