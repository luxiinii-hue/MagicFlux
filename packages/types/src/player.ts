/**
 * Player type for Magic: The Gathering.
 */

import type { ManaPool } from "./mana.js";

/**
 * A player in a game. Tracks life, mana, status flags, and format-specific
 * counters.
 */
export interface Player {
  /** Unique player identifier. */
  readonly id: string;
  /** Display name. */
  readonly name: string;
  /**
   * Current life total.
   * Starting life depends on format: 20 for Standard/Modern, 40 for Commander.
   */
  readonly life: number;
  /** Number of poison counters. 10+ causes loss via SBA. */
  readonly poisonCounters: number;
  /** Mana currently available. Empties at phase/step transitions. */
  readonly manaPool: ManaPool;
  /** True if eliminated (0 life, 10+ poison, empty library draw, commander damage, or conceded). */
  readonly hasLost: boolean;
  /** True if the player conceded. */
  readonly hasConceded: boolean;
  /**
   * Map of commander instanceId to total combat damage received from that
   * commander. Only tracked in Commander format. 21+ from a single commander
   * causes loss via SBA.
   */
  readonly commanderDamageReceived: Readonly<Record<string, number>>;
  /** instanceId of this player's commander, if applicable. */
  readonly commanderId: string | null;
  /** Number of times the commander has been cast from the command zone. Increases cost by {2} each time. */
  readonly commanderTax: number;
  /** Energy counters (for sets that use energy). */
  readonly energyCounters: number;
  /** Experience counters (Commander). */
  readonly experienceCounters: number;
  /** Number of lands played this turn. */
  readonly landsPlayedThisTurn: number;
  /** Maximum lands allowed per turn. Normally 1, can be increased by effects. */
  readonly maxLandsPerTurn: number;
  /**
   * Flag set when a player attempts to draw from an empty library.
   * The SBA check uses this to eliminate the player.
   */
  readonly drewFromEmptyLibrary: boolean;
}
