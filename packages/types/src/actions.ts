/**
 * Player action types for Magic: The Gathering.
 *
 * PlayerAction is a discriminated union of everything a player can do when
 * they have priority. The engine's executeAction function consumes these.
 */

import type { ResolvedTarget } from "./abilities.js";
import type { CastingChoices } from "./card.js";
import type { ManaPaymentPlan } from "./stack.js";

// ---------------------------------------------------------------------------
// Phase 1 actions (fully implemented)
// ---------------------------------------------------------------------------

/** Pass priority without doing anything. */
export interface PassPriorityAction {
  readonly type: "passPriority";
}

/**
 * Play a land from hand. Legal during your main phase when the stack is
 * empty and you haven't exceeded your land-per-turn limit.
 */
export interface PlayLandAction {
  readonly type: "playLand";
  readonly cardInstanceId: string;
}

// ---------------------------------------------------------------------------
// Phase 2 actions (spell casting)
// ---------------------------------------------------------------------------

/** Cast a spell from hand (or other legal zone). */
export interface CastSpellAction {
  readonly type: "castSpell";
  readonly cardInstanceId: string;
  readonly targets?: readonly ResolvedTarget[];
  readonly paymentPlan?: ManaPaymentPlan;
  readonly choices?: CastingChoices;
}

/** Activate an activated ability. */
export interface ActivateAbilityAction {
  readonly type: "activateAbility";
  readonly cardInstanceId: string;
  readonly abilityId: string;
  readonly targets?: readonly ResolvedTarget[];
  readonly paymentPlan?: ManaPaymentPlan;
}

// ---------------------------------------------------------------------------
// Phase 3 actions (combat)
// ---------------------------------------------------------------------------

/**
 * Declare which creatures attack which targets.
 * Map: attacker instanceId -> defending player ID or planeswalker instanceId.
 */
export interface DeclareAttackersAction {
  readonly type: "declareAttackers";
  readonly attackerAssignments: Readonly<Record<string, string>>;
}

/**
 * Declare which creatures block which attackers.
 * Map: blocker instanceId -> array of attacker instanceIds being blocked.
 */
export interface DeclareBlockersAction {
  readonly type: "declareBlockers";
  readonly blockerAssignments: Readonly<Record<string, readonly string[]>>;
}

/**
 * Choose damage assignment order for a multi-blocked creature.
 */
export interface AssignDamageOrderAction {
  readonly type: "assignDamageOrder";
  readonly attackerId: string;
  readonly blockerOrder: readonly string[];
}

/**
 * Assign specific combat damage amounts (needed for trample, etc.).
 * Outer map: attacker instanceId -> inner map: target (blocker or player) -> damage amount.
 */
export interface AssignCombatDamageAction {
  readonly type: "assignCombatDamage";
  readonly damageAssignments: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

// ---------------------------------------------------------------------------
// General actions (all phases)
// ---------------------------------------------------------------------------

/** Respond to a game prompt (choose targets, mode, cards to discard, etc.). */
export interface MakeChoiceAction {
  readonly type: "makeChoice";
  readonly choiceId: string;
  readonly selection: unknown;
}

/** Concede the game. Always legal. */
export interface ConcedeAction {
  readonly type: "concede";
}

// ---------------------------------------------------------------------------
// PlayerAction discriminated union
// ---------------------------------------------------------------------------

/**
 * Discriminated union of everything a player can do.
 * Use the `type` field to narrow to a specific variant.
 */
export type PlayerAction =
  // Phase 1
  | PassPriorityAction
  | PlayLandAction
  // Phase 2
  | CastSpellAction
  | ActivateAbilityAction
  // Phase 3
  | DeclareAttackersAction
  | DeclareBlockersAction
  | AssignDamageOrderAction
  | AssignCombatDamageAction
  // General
  | MakeChoiceAction
  | ConcedeAction;
