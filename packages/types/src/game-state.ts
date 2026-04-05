/**
 * Game state types for Magic: The Gathering.
 *
 * GameState is the complete, authoritative snapshot of a game at any point
 * in time. Per DEC-001: all engine functions are pure -- they take a GameState
 * and return a new GameState. No in-place mutation.
 */

import type { CardInstance, DecklistEntry } from "./card.js";
import type { Player } from "./player.js";
import type { Zone } from "./zones.js";
import type { TurnState, Phase, Step } from "./turn.js";
import type { GameEvent } from "./events.js";
import type { StackItem } from "./stack.js";
import type { CardFilter, ReplacementEffect } from "./abilities.js";

// ---------------------------------------------------------------------------
// GameConfig -- input to createGame
// ---------------------------------------------------------------------------

/** Player configuration for game creation. */
export interface PlayerConfig {
  readonly id: string;
  readonly name: string;
  readonly decklist: readonly DecklistEntry[];
  readonly commanderId?: string;
}

/** Format string. */
export type GameFormat = "standard" | "modern" | "commander";

/**
 * Configuration for creating a new game. Passed to engine's createGame.
 */
export interface GameConfig {
  readonly format: GameFormat;
  readonly players: readonly PlayerConfig[];
  /** Seed for the PRNG. Server generates if omitted. */
  readonly seed?: number;
}

// ---------------------------------------------------------------------------
// CombatState -- present only during combat phase
// ---------------------------------------------------------------------------

/** Information about a single attacking creature. */
export interface AttackerInfo {
  /** Player ID or planeswalker/battle instanceId being attacked. */
  readonly attackTarget: string;
  /** Whether this attacker has been blocked. */
  readonly blocked: boolean;
  /**
   * Ordered array of blocker instanceIds (in damage assignment order
   * chosen by the active player).
   */
  readonly blockers: readonly string[];
  /** Whether this creature already dealt first-strike damage this combat. */
  readonly dealtFirstStrikeDamage: boolean;
}

/** Information about a single blocking creature. */
export interface BlockerInfo {
  /**
   * Attacker instanceIds this creature is blocking.
   * Typically one, but some effects allow blocking multiple.
   */
  readonly blocking: readonly string[];
}

/**
 * Combat state. Present only during the combat phase, removed when combat ends.
 */
export interface CombatState {
  /** Map of attacker instanceId to AttackerInfo. */
  readonly attackers: Readonly<Record<string, AttackerInfo>>;
  /** Map of blocker instanceId to BlockerInfo. */
  readonly blockers: Readonly<Record<string, BlockerInfo>>;
  /**
   * Map of attacker instanceId to ordered array of blocker instanceIds.
   * Set by the active player after blockers are declared.
   */
  readonly damageAssignmentOrders: Readonly<Record<string, readonly string[]>>;
}

// ---------------------------------------------------------------------------
// ContinuousEffect -- active instance in game state
// ---------------------------------------------------------------------------

/**
 * An active continuous effect modifying the game state.
 * Created from static abilities and resolved spells with durations.
 */
export interface ContinuousEffect {
  readonly id: string;
  /** The permanent or spell that created this effect. */
  readonly sourceCardInstanceId: string;
  /** What the effect does. */
  readonly effect: Readonly<Record<string, unknown>>;
  /** Which cards/players this effect applies to. */
  readonly affectedFilter: CardFilter;
  /** When this effect ends. */
  readonly duration: "whileSourceOnBattlefield" | "endOfTurn" | "untilYourNextTurn" | "permanent";
  /** Layer this applies in (1-7, per CR 613). */
  readonly layer: number;
  /** Sub-layer for layer 7 effects (a-e). Null for other layers. */
  readonly subLayer: "a" | "b" | "c" | "d" | "e" | null;
  /** When this effect was created. Used for same-layer ordering. */
  readonly timestamp: number;
  /** Other effect IDs this depends on (CR 613.8 dependency system). */
  readonly dependsOn: readonly string[];
}

// ---------------------------------------------------------------------------
// PendingPrompt — engine paused waiting for player choice
// ---------------------------------------------------------------------------

/**
 * When the engine encounters an effect that requires player input during
 * resolution (search, Fact or Fiction, modal choices), it pauses and
 * returns the state with a PendingPrompt. The server sends this to the
 * player, who responds via makeChoice. The engine then continues.
 */
export interface PendingPrompt {
  /** Unique ID for this prompt instance. */
  readonly promptId: string;
  /** Which player must make the choice. */
  readonly playerId: string;
  /** What kind of choice is needed. */
  readonly promptType: "searchLibrary" | "chooseCard" | "chooseMode" | "orderCards" | "scry";
  /** Human-readable description. */
  readonly description: string;
  /** Cards/options to choose from (instanceIds or option indices). */
  readonly options: readonly string[];
  /** Minimum selections required. */
  readonly minSelections: number;
  /** Maximum selections allowed. */
  readonly maxSelections: number;
  /** The stack item ID being resolved (to resume resolution). */
  readonly sourceStackItemId: string;
  /** Index of the effect being resolved (to resume from correct point). */
  readonly effectIndex: number;
  /** The remaining effects after the current one (to continue resolution). */
  readonly remainingEffects: readonly unknown[];
  /** Whether the chosen card must be revealed to opponents (tutor reveal). */
  readonly reveal: boolean;
}

// ---------------------------------------------------------------------------
// Extra turn tracking
// ---------------------------------------------------------------------------

/** An extra turn queued up. Processed LIFO. */
export interface ExtraTurn {
  readonly playerId: string;
  readonly source: string;
}

// ---------------------------------------------------------------------------
// Per-turn flags
// ---------------------------------------------------------------------------

/**
 * Transient flags for the current turn, reset at turn boundaries.
 * Keyed by player ID.
 */
export interface TurnFlags {
  readonly landsPlayedThisTurn: Readonly<Record<string, number>>;
  readonly spellsCastThisTurn: Readonly<Record<string, number>>;
}

// ---------------------------------------------------------------------------
// GameState -- the authoritative snapshot
// ---------------------------------------------------------------------------

/**
 * The complete, authoritative snapshot of a game at any point in time.
 * Contains all information needed to continue the game from this point.
 *
 * Per DEC-001: immutable. Engine functions return new GameState objects.
 */
export interface GameState {
  /** Unique game identifier. */
  readonly gameId: string;
  /** Players in turn order. */
  readonly players: readonly Player[];
  /** Flat lookup of all cards in the game. Map of instanceId to CardInstance. */
  readonly cardInstances: Readonly<Record<string, CardInstance>>;
  /**
   * Map of zone key to Zone.
   * Keys: "battlefield", "exile", "stack", "commandZone",
   * "player:{playerId}:library", "player:{playerId}:hand",
   * "player:{playerId}:graveyard"
   */
  readonly zones: Readonly<Record<string, Zone>>;
  /** Current position in the turn. */
  readonly turnState: TurnState;
  /** The player whose turn it is. */
  readonly activePlayerId: string;
  /**
   * The player who currently has priority. Null during steps where no
   * player has priority (untap, cleanup normally).
   */
  readonly priorityPlayerId: string | null;
  /**
   * Consecutive priority passes without any player taking an action.
   * When this equals active player count, stack resolves or game advances.
   */
  readonly consecutivePasses: number;
  /** Ordered array of StackItem IDs, top of stack first. */
  readonly stack: readonly string[];
  /** Stack item data. Map of stack item ID to StackItem. */
  readonly stackItems: Readonly<Record<string, StackItem>>;
  /** Current turn number (1-indexed). */
  readonly turnNumber: number;
  /** Whether the game has ended. */
  readonly gameOver: boolean;
  /** Player IDs who won. Empty if game not over. */
  readonly winners: readonly string[];
  /** Player IDs who have lost (eliminated in multiplayer). */
  readonly losers: readonly string[];
  /**
   * Events generated but not yet processed for triggers.
   * Cleared after trigger processing.
   */
  readonly pendingEvents: readonly GameEvent[];
  /** Current state of the seeded PRNG. Advances with each random operation. */
  readonly rngState: number;
  /** Active continuous effects. */
  readonly continuousEffects: readonly ContinuousEffect[];
  /** Active replacement effects (CR 614). */
  readonly replacementEffects: readonly ReplacementEffect[];
  /** Present only during combat phase. */
  readonly combatState: CombatState | null;
  /** Game format. */
  readonly format: GameFormat;
  /** Queue of extra turns to be taken. Processed LIFO. */
  readonly extraTurns: readonly ExtraTurn[];
  /** Transient per-turn flags, reset at turn boundaries. */
  readonly turnFlags: TurnFlags;
  /**
   * Set when the engine pauses mid-resolution for player input.
   * Null when no prompt is pending.
   */
  readonly pendingPrompt: PendingPrompt | null;
}

// ---------------------------------------------------------------------------
// GameStatus -- high-level query result
// ---------------------------------------------------------------------------

/**
 * High-level game status returned by getGameStatus.
 */
export interface GameStatus {
  readonly isOver: boolean;
  readonly winners: readonly string[];
  readonly losers: readonly string[];
  readonly activePlayerId: string;
  readonly priorityPlayerId: string | null;
  readonly currentPhase: Phase;
  readonly currentStep: Step | null;
  readonly turnNumber: number;
}

// ---------------------------------------------------------------------------
// ActionResult -- return type from executeAction
// ---------------------------------------------------------------------------

/**
 * Error from the engine when a player action is illegal.
 */
export interface EngineError {
  /** Error code (e.g., "ILLEGAL_ACTION", "INSUFFICIENT_MANA", "INVALID_TARGET"). */
  readonly code: string;
  /** Human-readable description. */
  readonly message: string;
}

/**
 * Return type from executeAction. Discriminated union on `success`.
 */
export type ActionResult =
  | { readonly success: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly success: false; readonly error: EngineError };

// ---------------------------------------------------------------------------
// ClientGameState -- filtered view for a specific player
// ---------------------------------------------------------------------------

/**
 * Library zone as seen by a client. Contents hidden, only count visible.
 */
export interface ClientLibraryZone {
  readonly key: string;
  readonly type: "Library";
  readonly ownerId: string;
  readonly cardCount: number;
}

/**
 * Hand zone. Owner sees their cards; opponents see only count.
 */
export interface ClientHandZone {
  readonly key: string;
  readonly type: "Hand";
  readonly ownerId: string;
  /** Full card list for the owning player, null for opponents. */
  readonly cardInstanceIds: readonly string[] | null;
  readonly cardCount: number;
}

/**
 * A filtered view of GameState safe to send to a specific player.
 * Hidden information is removed per DEC-007.
 */
export interface ClientGameState {
  readonly gameId: string;
  readonly players: readonly Player[];
  /** Only cards the viewing player is allowed to see. */
  readonly cardInstances: Readonly<Record<string, CardInstance>>;
  readonly zones: Readonly<Record<string, Zone | ClientLibraryZone | ClientHandZone>>;
  readonly turnState: TurnState;
  readonly activePlayerId: string;
  readonly priorityPlayerId: string | null;
  readonly stack: readonly string[];
  readonly stackItems: Readonly<Record<string, StackItem>>;
  readonly turnNumber: number;
  readonly gameOver: boolean;
  readonly winners: readonly string[];
  readonly losers: readonly string[];
  readonly continuousEffects: readonly ContinuousEffect[];
  readonly combatState: CombatState | null;
  readonly format: GameFormat;
}

// ---------------------------------------------------------------------------
// Compile-time constants
// ---------------------------------------------------------------------------

/** Maximum hand size before cleanup discard. */
export const MAX_HAND_SIZE = 7;

/** Starting life for Standard and Modern formats. */
export const STARTING_LIFE_STANDARD = 20;

/** Starting life for Commander format. */
export const STARTING_LIFE_COMMANDER = 40;

/** Opening hand size. */
export const STARTING_HAND_SIZE = 7;

/** Poison counters needed to lose. */
export const LETHAL_POISON_COUNTERS = 10;

/** Commander damage from a single commander needed to lose. */
export const LETHAL_COMMANDER_DAMAGE = 21;

/** Default lands per turn. */
export const DEFAULT_LANDS_PER_TURN = 1;
