/**
 * Zone types for Magic: The Gathering.
 *
 * Zones are named regions where cards can exist. Some zones are per-player
 * (Library, Hand, Graveyard) and some are shared (Battlefield, Exile, Stack,
 * CommandZone).
 */

/** All game zone types per MTG Comprehensive Rules. */
export enum ZoneType {
  Library = "Library",
  Hand = "Hand",
  Battlefield = "Battlefield",
  Graveyard = "Graveyard",
  Exile = "Exile",
  Stack = "Stack",
  CommandZone = "CommandZone",
}

/** Visibility of a zone's contents. */
export type ZoneVisibility = "hidden" | "owner" | "public";

/**
 * A zone is a named region where cards can exist.
 *
 * Zone keys follow a structured format:
 * - Shared zones: "battlefield", "exile", "stack", "commandZone"
 * - Per-player zones: "player:{playerId}:library", "player:{playerId}:hand",
 *   "player:{playerId}:graveyard"
 *
 * Card order matters for Library (top to bottom) and Graveyard (most recent
 * on top). For Battlefield, order is irrelevant to rules but maintained for
 * UI consistency. Stack order is managed by GameState.stack, not this array.
 */
export interface Zone {
  /** Zone key matching the GameState zones map. */
  readonly key: string;
  readonly type: ZoneType;
  /** Player ID for per-player zones. Null for shared zones. */
  readonly ownerId: string | null;
  /** Ordered array of instanceIds. Order semantics depend on zone type. */
  readonly cardInstanceIds: readonly string[];
  /** Who can see the cards in this zone. */
  readonly visibility: ZoneVisibility;
}
