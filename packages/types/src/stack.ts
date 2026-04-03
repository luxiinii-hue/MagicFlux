/**
 * Stack types for Magic: The Gathering.
 *
 * The stack is the zone where spells and abilities wait to resolve (LIFO).
 * StackItem represents one entry. ManaPaymentPlan specifies how costs are paid.
 */

import type { ManaColor } from "./mana.js";
import type { SpellAbility, ResolvedTarget } from "./abilities.js";
import type { CastingChoices } from "./card.js";

// ---------------------------------------------------------------------------
// StackItem
// ---------------------------------------------------------------------------

/**
 * A spell or ability on the stack waiting to resolve.
 */
export interface StackItem {
  /** Unique identifier for this stack entry. */
  readonly id: string;
  /** The card that produced this stack item. */
  readonly sourceCardInstanceId: string;
  /** The ability being resolved. */
  readonly ability: SpellAbility;
  /** Player ID of the controller (caster/activator). */
  readonly controller: string;
  /** Chosen targets with their resolved IDs. */
  readonly targets: readonly ResolvedTarget[];
  /** True if this is a spell (card being cast), false if it's an ability. */
  readonly isSpell: boolean;
  /** True if this is a copy (e.g., from Storm or Fork). */
  readonly isCopy: boolean;
  /**
   * Choices made during casting: X value, kicker paid, chosen mode for
   * modal spells, etc.
   */
  readonly choices: CastingChoices | null;
}

// ---------------------------------------------------------------------------
// ManaPaymentPlan
// ---------------------------------------------------------------------------

/** A single mana ability to activate during payment. */
export interface ManaAbilityActivation {
  readonly cardInstanceId: string;
  readonly abilityId: string;
}

/**
 * When casting a spell or activating an ability, this specifies how to pay
 * the mana cost. Includes which mana from the pool covers which symbols,
 * which mana abilities to activate during payment, and which Phyrexian
 * costs are paid with life.
 */
export interface ManaPaymentPlan {
  /**
   * Map of ManaCost symbol index to the ManaColor used from the pool.
   * For generic mana, this specifies which color satisfies it.
   */
  readonly poolPayments: Readonly<Record<number, ManaColor>>;
  /** Mana abilities to activate as part of paying costs. */
  readonly manaAbilitiesToActivate: readonly ManaAbilityActivation[];
  /** Symbol indices where the player chose to pay 2 life instead (Phyrexian mana). */
  readonly phyrexianLifePayments: readonly number[];
}

// ---------------------------------------------------------------------------
// DamageAssignment (for combat)
// ---------------------------------------------------------------------------

/**
 * A single damage assignment in combat.
 * Returned by calculateCombatDamage for the server to apply.
 */
export interface DamageAssignment {
  /** Creature dealing damage. */
  readonly sourceInstanceId: string;
  /** instanceId (creature/planeswalker) or playerId. */
  readonly targetId: string;
  /** Damage amount. */
  readonly amount: number;
  /** Whether this is first-strike damage. */
  readonly isFirstStrike: boolean;
}
