/**
 * Mana types for Magic: The Gathering.
 *
 * ManaColor represents the six mana types that can exist in a mana pool.
 * Generic mana is NOT a color -- it is a cost concept only (ManaCost/ManaSymbol).
 */

/** The six mana types: White, Blue, Black, Red, Green, Colorless. */
export type ManaColor = "W" | "U" | "B" | "R" | "G" | "C";

/**
 * A mana pool tracks the mana currently available to a player.
 * All values are non-negative integers.
 * Empties at each phase/step transition unless effects prevent it.
 */
export interface ManaPool {
  readonly W: number;
  readonly U: number;
  readonly B: number;
  readonly R: number;
  readonly G: number;
  readonly C: number;
}

/**
 * A single symbol in a mana cost. Discriminated union on `type`.
 *
 * Generic mana ({3}) means "any color or colorless can pay this."
 * Colorless mana ({C}) specifically requires colorless mana.
 */
export type ManaSymbol =
  | { readonly type: "generic"; readonly amount: number }
  | { readonly type: "colored"; readonly color: ManaColor }
  | { readonly type: "hybrid"; readonly colors: readonly [ManaColor, ManaColor] }
  | { readonly type: "hybridGeneric"; readonly amount: number; readonly color: ManaColor }
  | { readonly type: "phyrexian"; readonly color: ManaColor }
  | { readonly type: "snow" }
  | { readonly type: "X" }
  | { readonly type: "colorless" };

/**
 * The full mana cost to cast a spell or activate an ability.
 * Symbols are ordered left-to-right as printed on the card.
 */
export interface ManaCost {
  readonly symbols: readonly ManaSymbol[];
  /** Converted mana cost / mana value. Precomputed for efficiency. */
  readonly totalCMC: number;
}
