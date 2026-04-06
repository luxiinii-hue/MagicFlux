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
import { performMulligan, putCardsOnBottom } from "@magic-flux/engine";
import { populateCardAbilities, getCardOverride, getRegisteredManaCost } from "@magic-flux/cards";
import { canPayCost } from "@magic-flux/engine";
import type { ManaColor } from "@magic-flux/types";
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

export type SessionStatus = "waiting" | "mulligan" | "active" | "finished";

interface MulliganState {
  /** How many times each player has mulliganed. */
  readonly mulliganCounts: Record<string, number>;
  /** Players who have decided to keep. */
  readonly keptPlayers: Set<string>;
  /** Players who still need to put cards on bottom. */
  readonly pendingBottomPlayers: Set<string>;
}

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
  private mulliganState: MulliganState | null = null;

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

  start(seed?: number, skipMulligan = false): void {
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

    this.state = populateCardAbilities(createGame(config));

    if (skipMulligan) {
      this.status = "active";
      this.runGameLoop();
    } else {
      this.status = "mulligan";
      this.mulliganState = {
        mulliganCounts: Object.fromEntries(this.playerSlots.map((s) => [s.playerId, 0])),
        keptPlayers: new Set(),
        pendingBottomPlayers: new Set(),
      };
      this.sendMulliganPrompts();
    }
  }

  // -------------------------------------------------------------------------
  // Mulligan phase
  // -------------------------------------------------------------------------

  private sendMulliganPrompts(): void {
    if (!this.state || !this.mulliganState) return;

    for (const slot of this.playerSlots) {
      if (!slot.connection || this.mulliganState.keptPlayers.has(slot.playerId)) continue;

      // Send current hand state
      this.sendStateToPlayer(slot.playerId);

      // Send mulligan prompt
      const count = this.mulliganState.mulliganCounts[slot.playerId] ?? 0;
      slot.connection.send({
        type: "game:prompt",
        payload: {
          promptId: `mulligan_${slot.playerId}`,
          promptType: "chooseMode" as any, // Reuse existing union — client identifies by promptId prefix
          description: count === 0
            ? "Opening hand — Keep or Mulligan?"
            : `Mulligan ${count} — Keep or Mulligan?`,
          options: { type: "mulligan", mulliganCount: count, handSize: 7 - count },
          minSelections: 1,
          maxSelections: 1,
        },
      });
    }
  }

  private sendBottomPrompt(playerId: string): void {
    if (!this.state || !this.mulliganState) return;
    const slot = this.playerSlots.find((s) => s.playerId === playerId);
    if (!slot?.connection) return;

    const count = this.mulliganState.mulliganCounts[playerId] ?? 0;
    this.sendStateToPlayer(playerId);

    slot.connection.send({
      type: "game:prompt",
      payload: {
        promptId: `bottom_${playerId}`,
        promptType: "choosePermanent" as any, // Client identifies by promptId prefix
        description: `Choose ${count} card${count > 1 ? "s" : ""} to put on the bottom of your library`,
        options: { type: "putOnBottom", count },
        minSelections: count,
        maxSelections: count,
      },
    });
  }

  handleMulliganResponse(playerId: string, decision: "keep" | "mulligan"): void {
    if (this.status !== "mulligan" || !this.state || !this.mulliganState) return;
    if (this.mulliganState.keptPlayers.has(playerId)) return;

    if (decision === "mulligan") {
      const count = (this.mulliganState.mulliganCounts[playerId] ?? 0) + 1;
      this.mulliganState = {
        ...this.mulliganState,
        mulliganCounts: { ...this.mulliganState.mulliganCounts, [playerId]: count },
      };

      // Perform the mulligan
      const result = performMulligan(this.state, playerId, count);
      this.state = result.state;

      // If they've mulliganed down to 1 card, auto-keep
      if (7 - count <= 1) {
        this.mulliganState.keptPlayers.add(playerId);
        // No cards to put on bottom when at 1 card (keep all)
        this.checkMulliganComplete();
      } else {
        // Send new hand and prompt again
        this.sendMulliganPrompts();
      }
    } else {
      // Keep
      this.mulliganState.keptPlayers.add(playerId);
      const count = this.mulliganState.mulliganCounts[playerId] ?? 0;

      if (count > 0) {
        // Need to put cards on bottom
        this.mulliganState.pendingBottomPlayers.add(playerId);
        this.sendBottomPrompt(playerId);
      }

      this.checkMulliganComplete();
    }
  }

  handlePutOnBottom(playerId: string, cardIds: readonly string[]): void {
    if (this.status !== "mulligan" || !this.state || !this.mulliganState) return;
    if (!this.mulliganState.pendingBottomPlayers.has(playerId)) return;

    const expected = this.mulliganState.mulliganCounts[playerId] ?? 0;
    if (cardIds.length !== expected) {
      this.sendError(playerId, "WRONG_COUNT", `Must put exactly ${expected} cards on bottom`);
      return;
    }

    const result = putCardsOnBottom(this.state, playerId, cardIds);
    this.state = result.state;
    this.mulliganState.pendingBottomPlayers.delete(playerId);
    this.checkMulliganComplete();
  }

  private checkMulliganComplete(): void {
    if (!this.mulliganState) return;

    const allKept = this.playerSlots.every((s) =>
      this.mulliganState!.keptPlayers.has(s.playerId),
    );
    const noPendingBottom = this.mulliganState.pendingBottomPlayers.size === 0;

    if (allKept && noPendingBottom) {
      // Mulligan phase complete — start the game
      this.mulliganState = null;
      this.status = "active";
      this.runGameLoop();
    }
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
    // makeChoice doesn't require priority — it responds to a pending prompt
    if (action.type === "makeChoice") {
      if (!this.state.pendingPrompt || this.state.pendingPrompt.playerId !== playerId) {
        this.sendError(playerId, "NO_PROMPT", "No pending prompt for you");
        return;
      }
    } else if (this.state.priorityPlayerId !== playerId && action.type !== "concede") {
      this.sendError(playerId, "NOT_YOUR_PRIORITY", "You do not have priority");
      return;
    }

    // For castSpell actions, deduct mana cost from player's pool before
    // forwarding to the engine. The engine doesn't have access to card cost
    // data (it's in the cards package), so the server handles payment.
    let stateForEngine = this.state;
    if (action.type === "castSpell") {
      const card = stateForEngine.cardInstances[action.cardInstanceId];
      if (card) {
        const cost = getRegisteredManaCost(card.cardDataId);
        if (cost && cost.symbols.length > 0) {
          const player = stateForEngine.players.find((p) => p.id === playerId);
          if (player && !canPayCost(player.manaPool, cost)) {
            this.sendError(playerId, "CANNOT_PAY", "Not enough mana to cast this spell");
            return;
          }
          // Deduct mana from pool
          stateForEngine = this.deductManaCost(stateForEngine, playerId, cost);
        }
      }
    }

    const result = executeAction(stateForEngine, action);

    if (!result.success) {
      this.sendError(playerId, result.error.code, result.error.message);
      return;
    }

    // Store events in pendingEvents so the game loop's trigger check can see them
    this.state = {
      ...result.state,
      pendingEvents: [...(result.state.pendingEvents ?? []), ...result.events],
    };
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
        // Add triggers to the stack and emit events
        let newState = this.state;
        const triggerEvents: GameEvent[] = [];
        for (const trigger of triggers) {
          newState = {
            ...newState,
            stack: [trigger.id, ...newState.stack],
            stackItems: { ...newState.stackItems, [trigger.id]: trigger },
          };
          triggerEvents.push({
            type: "abilityTriggered",
            cardInstanceId: trigger.sourceCardInstanceId,
            abilityId: trigger.ability.id,
            timestamp: Date.now(),
          } as GameEvent);
        }
        // Clear pending events
        this.state = { ...newState, pendingEvents: [] };
        this.broadcastEvents(triggerEvents);
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
        this.state = {
          ...result.state,
          pendingEvents: [...(result.state.pendingEvents ?? []), ...result.events],
        };
        this.broadcastEvents(result.events);
        continue;
      }

      // 4. Check for pending prompts (engine paused for player choice)
      if (this.state.pendingPrompt) {
        const prompt = this.state.pendingPrompt;
        this.broadcastState();
        const slot = this.playerSlots.find((s) => s.playerId === prompt.playerId);
        if (slot?.connection) {
          slot.connection.send({
            type: "game:prompt",
            payload: {
              promptId: prompt.promptId,
              promptType: prompt.promptType as any,
              description: prompt.description,
              options: prompt.options,
              minSelections: prompt.minSelections,
              maxSelections: prompt.maxSelections,
            },
          });
        }
        return; // Wait for player choice (makeChoice action)
      }

      // 5. We need player input — send state and legal actions
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
        this.state = {
          ...this.state,
          pendingEvents: [...(this.state.pendingEvents ?? []), ...result.events],
        };
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

  /** Send an arbitrary message to all connected players. */
  broadcastToAll(message: ServerMessage): void {
    for (const slot of this.playerSlots) {
      slot.connection?.send(message);
    }
  }

  /** Send a message to a specific player. */
  sendToPlayer(playerId: string, message: ServerMessage): void {
    const slot = this.playerSlots.find((s) => s.playerId === playerId);
    slot?.connection?.send(message);
  }

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

    const clientState = {
      ...filterStateForPlayer(this.state, playerId),
      gameId: this.gameId, // Use session ID, not engine's internal ID
    };
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

    const rawActions = getLegalActions(this.state, playerId);
    const player = this.state.players.find((p) => p.id === playerId);

    // Filter castSpell actions to only affordable spells using the mana cost registry
    const actions = rawActions.filter((action) => {
      if (action.type !== "castSpell" || !player) return true;
      const card = this.state.cardInstances[action.cardInstanceId];
      if (!card) return true;
      const cost = getRegisteredManaCost(card.cardDataId);
      if (!cost) return true; // Unknown cost — allow through (engine may enforce)
      return canPayCost(player.manaPool, cost);
    });

    // Build target requirements map for castSpell actions.
    const targetRequirements: Record<string, readonly import("@magic-flux/types").TargetRequirement[]> = {};
    for (const action of actions) {
      if (action.type === "castSpell") {
        const card = this.state.cardInstances[action.cardInstanceId];
        if (card) {
          const override = getCardOverride(card.cardDataId);
          if (override && override.spellTargets.length > 0) {
            targetRequirements[action.cardInstanceId] = override.spellTargets;
          }
        }
      }
    }

    const msg: LegalActionsMessage = {
      type: "game:legalActions",
      payload: { actions, targetRequirements } as LegalActionsMessage["payload"] & { targetRequirements: typeof targetRequirements },
    };
    slot.connection.send(msg);
  }

  /**
   * Deduct a ManaCost from a player's mana pool. Returns updated GameState.
   * Pays colored costs first, then generic from any remaining mana.
   */
  private deductManaCost(
    state: GameState,
    playerId: string,
    cost: import("@magic-flux/types").ManaCost,
  ): GameState {
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return state;

    const pool = { ...player.manaPool };

    // Pay colored and colorless symbols first
    for (const sym of cost.symbols) {
      if (sym.type === "colored") {
        pool[sym.color] = Math.max(0, pool[sym.color] - 1);
      } else if (sym.type === "colorless") {
        pool.C = Math.max(0, pool.C - 1);
      }
      // Generic handled below
    }

    // Pay generic costs from any remaining mana
    for (const sym of cost.symbols) {
      if (sym.type === "generic") {
        let remaining = sym.amount;
        for (const color of ["C", "W", "U", "B", "R", "G"] as const) {
          const deduct = Math.min(remaining, pool[color]);
          pool[color] -= deduct;
          remaining -= deduct;
          if (remaining <= 0) break;
        }
      }
    }

    const updatedPlayers = state.players.map((p) =>
      p.id === playerId ? { ...p, manaPool: pool } : p,
    );

    return { ...state, players: updatedPlayers };
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
