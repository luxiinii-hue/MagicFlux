/**
 * Game event types for Magic: The Gathering.
 *
 * Events represent observable game occurrences. They are emitted by engine
 * functions and consumed for:
 * 1. Trigger checking (engine)
 * 2. Game log (server)
 * 3. Client animations (client)
 *
 * Each event carries a monotonically increasing timestamp for ordering.
 */

import type { ManaPool } from "./mana.js";
import type { Phase, Step } from "./turn.js";
import type { ZoneType } from "./zones.js";

// ---------------------------------------------------------------------------
// GameEvent base fields
// ---------------------------------------------------------------------------

/** Fields common to every GameEvent variant. */
interface GameEventBase {
  /** Monotonically increasing counter within the game. */
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Phase 1 events (fully defined)
// ---------------------------------------------------------------------------

export interface CardEnteredZoneEvent extends GameEventBase {
  readonly type: "cardEnteredZone";
  readonly cardInstanceId: string;
  readonly toZone: ZoneType;
  /** Null for tokens being created. */
  readonly fromZone: ZoneType | null;
}

export interface CardLeftZoneEvent extends GameEventBase {
  readonly type: "cardLeftZone";
  readonly cardInstanceId: string;
  readonly fromZone: ZoneType;
  readonly toZone: ZoneType | null;
}

export interface LifeChangedEvent extends GameEventBase {
  readonly type: "lifeChanged";
  readonly playerId: string;
  readonly oldLife: number;
  readonly newLife: number;
  readonly reason: "damage" | "loseLife" | "gainLife" | "payLife";
}

export interface ManaAddedEvent extends GameEventBase {
  readonly type: "manaAdded";
  readonly playerId: string;
  readonly mana: ManaPool;
}

export interface PhaseChangedEvent extends GameEventBase {
  readonly type: "phaseChanged";
  readonly phase: Phase;
  readonly step: Step | null;
}

export interface TurnBeganEvent extends GameEventBase {
  readonly type: "turnBegan";
  readonly turnNumber: number;
  readonly activePlayerId: string;
}

// ---------------------------------------------------------------------------
// Phase 2 events (stack and spells)
// ---------------------------------------------------------------------------

export interface SpellCastEvent extends GameEventBase {
  readonly type: "spellCast";
  readonly cardInstanceId: string;
  readonly playerId: string;
}

export interface AbilityActivatedEvent extends GameEventBase {
  readonly type: "abilityActivated";
  readonly abilityId: string;
  readonly cardInstanceId: string;
  readonly playerId: string;
}

export interface AbilityTriggeredEvent extends GameEventBase {
  readonly type: "abilityTriggered";
  readonly abilityId: string;
  readonly cardInstanceId: string;
}

export interface StackItemResolvedEvent extends GameEventBase {
  readonly type: "stackItemResolved";
  readonly stackItemId: string;
}

export interface StackItemCounteredEvent extends GameEventBase {
  readonly type: "stackItemCountered";
  readonly stackItemId: string;
}

// ---------------------------------------------------------------------------
// Phase 3 events (combat and creatures)
// ---------------------------------------------------------------------------

export interface DamageDealtEvent extends GameEventBase {
  readonly type: "damageDealt";
  readonly sourceInstanceId: string;
  readonly targetRef: { readonly targetId: string; readonly targetType: "card" | "player" };
  readonly amount: number;
  readonly isCombatDamage: boolean;
  readonly isDeathtouch: boolean;
}

export interface CombatDamageDealtEvent extends GameEventBase {
  readonly type: "combatDamageDealt";
}

export interface AttackersDeclaredEvent extends GameEventBase {
  readonly type: "attackersDeclared";
  readonly attackerIds: readonly string[];
  /**
   * Map of attacker instanceId to defending player/planeswalker ID.
   * Using Record instead of Map for serialization compatibility.
   */
  readonly attackTargets: Readonly<Record<string, string>>;
}

export interface BlockersDeclaredEvent extends GameEventBase {
  readonly type: "blockersDeclared";
  /**
   * Map of blocker instanceId to array of attacker instanceIds being blocked.
   * Using Record instead of Map for serialization compatibility.
   */
  readonly blockerAssignments: Readonly<Record<string, readonly string[]>>;
}

export interface CardTappedEvent extends GameEventBase {
  readonly type: "cardTapped";
  readonly cardInstanceId: string;
}

export interface CardUntappedEvent extends GameEventBase {
  readonly type: "cardUntapped";
  readonly cardInstanceId: string;
}

export interface CardDestroyedEvent extends GameEventBase {
  readonly type: "cardDestroyed";
  readonly cardInstanceId: string;
}

export interface TokenCreatedEvent extends GameEventBase {
  readonly type: "tokenCreated";
  readonly cardInstanceId: string;
}

export interface CounterAddedEvent extends GameEventBase {
  readonly type: "counterAdded";
  readonly cardInstanceId: string;
  readonly counterType: string;
  readonly newCount: number;
}

export interface CounterRemovedEvent extends GameEventBase {
  readonly type: "counterRemoved";
  readonly cardInstanceId: string;
  readonly counterType: string;
  readonly newCount: number;
}

// ---------------------------------------------------------------------------
// Game-ending events
// ---------------------------------------------------------------------------

export interface PlayerLostEvent extends GameEventBase {
  readonly type: "playerLost";
  readonly playerId: string;
  readonly reason: string;
}

export interface GameOverEvent extends GameEventBase {
  readonly type: "gameOver";
  readonly winnerIds: readonly string[];
}

// ---------------------------------------------------------------------------
// GameEvent discriminated union
// ---------------------------------------------------------------------------

/**
 * Discriminated union of all game events.
 * Use the `type` field to narrow to a specific variant.
 */
export type GameEvent =
  // Phase 1 -- foundational
  | CardEnteredZoneEvent
  | CardLeftZoneEvent
  | LifeChangedEvent
  | ManaAddedEvent
  | PhaseChangedEvent
  | TurnBeganEvent
  // Phase 2 -- stack/spells
  | SpellCastEvent
  | AbilityActivatedEvent
  | AbilityTriggeredEvent
  | StackItemResolvedEvent
  | StackItemCounteredEvent
  // Phase 3 -- combat/creatures
  | DamageDealtEvent
  | CombatDamageDealtEvent
  | AttackersDeclaredEvent
  | BlockersDeclaredEvent
  | CardTappedEvent
  | CardUntappedEvent
  | CardDestroyedEvent
  | TokenCreatedEvent
  | CounterAddedEvent
  | CounterRemovedEvent
  // Game ending
  | PlayerLostEvent
  | GameOverEvent;

/** String literal union of all GameEvent type discriminants. */
export type GameEventType = GameEvent["type"];
