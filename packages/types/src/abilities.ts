/**
 * Ability and effect types for Magic: The Gathering.
 *
 * SpellAbility is the core executable unit -- every card has at least one.
 * Effect is a discriminated union of atomic game-state changes.
 */

import type { ManaColor, ManaCost, ManaPool } from "./mana.js";
import type { ZoneType } from "./zones.js";
import type { TokenDefinition, CardTypeName } from "./card.js";
import type { GameEventType } from "./events.js";

// ---------------------------------------------------------------------------
// AbilityType discriminant
// ---------------------------------------------------------------------------

/**
 * Discriminant for SpellAbility variants.
 * - "spell": casting the card itself (hand -> stack)
 * - "activated": [Cost]: [Effect], player chooses to activate
 * - "triggered": When/Whenever/At [condition], [effect]
 * - "static": continuous effect, always on while source is in relevant zone
 * - "mana": activated ability that produces mana, resolves immediately (no stack)
 */
export type AbilityType = "spell" | "activated" | "triggered" | "static" | "mana";

/** Timing restriction for activated abilities. */
export type AbilityTiming = "instant" | "sorcery";

// ---------------------------------------------------------------------------
// ActivationCost
// ---------------------------------------------------------------------------

/** Filter describing what to sacrifice or discard. */
export interface CostFilter {
  readonly cardTypes?: readonly CardTypeName[];
  readonly subtypes?: readonly string[];
  readonly self?: boolean;
  readonly description: string;
}

/**
 * Total cost to cast a spell or activate an ability.
 * Multiple cost components can be combined.
 */
export interface ActivationCost {
  /** Mana portion of the cost. */
  readonly manaCost: ManaCost | null;
  /** Requires tapping the source permanent. */
  readonly tapSelf: boolean;
  /** Requires untapping the source permanent (untap symbol). */
  readonly untapSelf: boolean;
  /** What must be sacrificed, if anything. */
  readonly sacrifice: CostFilter | null;
  /** What must be discarded, if anything. */
  readonly discard: CostFilter | null;
  /** Life to pay, if any. */
  readonly payLife: number | null;
  /** Exile this card as part of the cost. */
  readonly exileSelf: boolean;
  /** Exile cards from graveyard (Delve, etc.). */
  readonly exileFromGraveyard: { readonly count: number; readonly filter: CostFilter | null } | null;
  /** Remove counters from a permanent as part of the cost. */
  readonly removeCounters: { readonly counterType: string; readonly count: number } | null;
  /** Arbitrary additional costs not covered above. */
  readonly additionalCosts: readonly AdditionalCost[];
}

/** An arbitrary additional cost component. */
export interface AdditionalCost {
  readonly type: string;
  readonly description: string;
  readonly data: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// TargetRequirement and ResolvedTarget
// ---------------------------------------------------------------------------

/** What kinds of things can be targeted. */
export type TargetType =
  | "creature"
  | "player"
  | "planeswalker"
  | "permanent"
  | "spell"
  | "card-in-graveyard"
  | "card-in-hand"
  | "card-in-library"
  | "enchantment"
  | "artifact"
  | "land"
  | "battle";

/** How many targets are required. */
export type TargetCount =
  | { readonly exactly: number }
  | { readonly upTo: number }
  | { readonly atLeast: number; readonly atMost: number };

/** Whose things can be targeted. */
export type TargetController = "any" | "you" | "opponent";

/**
 * Describes what constitutes a legal target for a spell or ability.
 * Targets must be legal both when chosen and when the ability resolves.
 */
export interface TargetRequirement {
  /** Unique within the spell/ability. Referenced by effects via TargetRef. */
  readonly id: string;
  /** Human-readable description (e.g., "target creature"). */
  readonly description: string;
  /** How many targets are needed. */
  readonly count: TargetCount;
  /** What types of things can be targeted. */
  readonly targetTypes: readonly TargetType[];
  /** Additional filter conditions (e.g., "nonblack creature"). */
  readonly filter: CardFilter | null;
  /** Whose things can be targeted. */
  readonly controller: TargetController;
}

/**
 * A chosen target with its resolved ID. Created when a spell/ability goes
 * on the stack with its targets selected.
 */
export interface ResolvedTarget {
  /** References the TargetRequirement.id this target fulfills. */
  readonly requirementId: string;
  /** instanceId (for permanent/card targets) or playerId (for player targets). */
  readonly targetId: string;
  /** Whether this target is a card or a player. */
  readonly targetType: "card" | "player";
}

// ---------------------------------------------------------------------------
// Effect -- discriminated union of atomic game-state changes
// ---------------------------------------------------------------------------

/**
 * Reference to a target in an effect. Resolved at stack resolution time
 * using the chosen targets from the StackItem.
 */
export interface TargetRef {
  /** References a TargetRequirement.id from the parent ability. */
  readonly targetRequirementId: string;
  /** Which index within that target's resolved list (for multi-target). */
  readonly index?: number;
}

/** Reference to a player in an effect. */
export type PlayerRef =
  | { readonly type: "controller" }
  | { readonly type: "owner" }
  | { readonly type: "targetPlayer"; readonly targetRef: TargetRef }
  | { readonly type: "activePlayer" }
  | { readonly type: "specific"; readonly playerId: string };

/** Reference to a stack item (for counter effects). */
export interface StackItemRef {
  readonly targetRequirementId: string;
}

/**
 * Either a static number or a dynamic computation.
 */
export type NumberOrExpression =
  | number
  | { readonly countOf: CardSelector }
  | { readonly variable: "X" };

/**
 * Duration of a continuous modification.
 * - "instant": happens once during resolution
 * - "endOfTurn": cleaned up in cleanup step
 * - "untilYourNextTurn": lasts until start of controller's next turn
 * - "permanent": lasts indefinitely
 */
export type Duration = "instant" | "endOfTurn" | "untilYourNextTurn" | "permanent";

/**
 * A discriminated union describing what happens when an ability resolves.
 * Effects are the atomic units of game-state change.
 */
export type Effect =
  | { readonly type: "dealDamage"; readonly amount: NumberOrExpression; readonly to: TargetRef }
  | { readonly type: "destroy"; readonly target: TargetRef }
  | { readonly type: "exile"; readonly target: TargetRef; readonly faceDown?: boolean }
  | { readonly type: "bounce"; readonly target: TargetRef; readonly to: ZoneType }
  | { readonly type: "drawCards"; readonly count: NumberOrExpression; readonly player: PlayerRef }
  | { readonly type: "discardCards"; readonly count: NumberOrExpression; readonly player: PlayerRef; readonly filter?: CardFilter }
  | { readonly type: "gainLife"; readonly amount: NumberOrExpression; readonly player: PlayerRef }
  | { readonly type: "loseLife"; readonly amount: NumberOrExpression; readonly player: PlayerRef }
  | { readonly type: "addMana"; readonly mana: ManaPool; readonly player: PlayerRef }
  | { readonly type: "createToken"; readonly token: TokenDefinition; readonly count: NumberOrExpression; readonly controller: PlayerRef }
  | { readonly type: "addCounters"; readonly counterType: string; readonly count: NumberOrExpression; readonly target: TargetRef }
  | { readonly type: "removeCounters"; readonly counterType: string; readonly count: NumberOrExpression; readonly target: TargetRef }
  | { readonly type: "modifyPT"; readonly power: number; readonly toughness: number; readonly target: TargetRef; readonly duration: Duration }
  | { readonly type: "grantAbility"; readonly ability: SpellAbility; readonly target: TargetRef; readonly duration: Duration }
  | { readonly type: "tap"; readonly target: TargetRef }
  | { readonly type: "untap"; readonly target: TargetRef }
  | { readonly type: "counter"; readonly target: StackItemRef }
  | { readonly type: "search"; readonly zone: ZoneType; readonly filter: CardFilter; readonly player: PlayerRef; readonly then: Effect }
  | { readonly type: "sacrifice"; readonly filter: CardFilter; readonly player: PlayerRef; readonly count: NumberOrExpression }
  | { readonly type: "preventDamage"; readonly amount: NumberOrExpression; readonly target: TargetRef; readonly duration: Duration }
  | { readonly type: "copy"; readonly target: TargetRef }
  | { readonly type: "composite"; readonly effects: readonly Effect[] }
  | { readonly type: "conditional"; readonly condition: Condition; readonly thenEffects: readonly Effect[]; readonly elseEffects?: readonly Effect[] }
  | { readonly type: "forEach"; readonly selector: CardSelector; readonly effect: Effect }
  | { readonly type: "playerChoice"; readonly choices: readonly Effect[]; readonly player: PlayerRef }
  | { readonly type: "custom"; readonly resolveFunction: string };

// ---------------------------------------------------------------------------
// TriggerCondition
// ---------------------------------------------------------------------------

/**
 * Describes when a triggered ability fires.
 */
export interface TriggerCondition {
  /** Which GameEvent type(s) trigger this. */
  readonly eventType: string | readonly string[];
  /** Additional conditions on the event. */
  readonly filter: CardFilter | null;
  /** True if this triggers on the source card's own events. */
  readonly self: boolean;
  /** "You may" triggers vs. mandatory triggers. */
  readonly optional: boolean;
  /**
   * Checked both at trigger time and resolution time.
   * If false at either point, the ability doesn't trigger / fizzles.
   */
  readonly interveningIf: Condition | null;
}

// ---------------------------------------------------------------------------
// SpellAbility -- the core executable unit
// ---------------------------------------------------------------------------

/** Common fields shared by all SpellAbility variants. */
interface SpellAbilityBase {
  /** Unique identifier within the card's ability list. */
  readonly id: string;
  /** The card this ability belongs to. */
  readonly sourceCardInstanceId: string | null;
  /** What happens when this ability resolves. */
  readonly effects: readonly Effect[];
  /**
   * Which zones this ability functions from. Most abilities only work on
   * the battlefield. Triggered abilities might function from the graveyard.
   */
  readonly zones: readonly ZoneType[];
}

/** Casting the card itself. */
export interface SpellAbilitySpell extends SpellAbilityBase {
  readonly type: "spell";
}

/** [Cost]: [Effect], player chooses to activate. */
export interface SpellAbilityActivated extends SpellAbilityBase {
  readonly type: "activated";
  readonly cost: ActivationCost;
  readonly timing: AbilityTiming;
  readonly targets: readonly TargetRequirement[];
  /** Optional activation restrictions. */
  readonly activationRestrictions: readonly string[];
}

/** When/Whenever/At [condition], [effect]. Fires automatically. */
export interface SpellAbilityTriggered extends SpellAbilityBase {
  readonly type: "triggered";
  readonly triggerCondition: TriggerCondition;
  readonly targets: readonly TargetRequirement[];
}

/** Continuous effect, always on while source is in the relevant zone. */
export interface SpellAbilityStatic extends SpellAbilityBase {
  readonly type: "static";
  readonly continuousEffect: ContinuousEffectDefinition;
  readonly condition: Condition | null;
  readonly layer: number;
}

/** Activated ability that produces mana. Resolves immediately (no stack). */
export interface SpellAbilityMana extends SpellAbilityBase {
  readonly type: "mana";
  readonly cost: ActivationCost;
}

/**
 * Discriminated union of all ability types.
 * Every card has at least one SpellAbility (its implicit "cast me" ability).
 */
export type SpellAbility =
  | SpellAbilitySpell
  | SpellAbilityActivated
  | SpellAbilityTriggered
  | SpellAbilityStatic
  | SpellAbilityMana;

// ---------------------------------------------------------------------------
// ContinuousEffect definitions
// ---------------------------------------------------------------------------

/**
 * Describes a continuous effect as defined on a static ability.
 * This is the definition; ContinuousEffect in game-state.ts is the active instance.
 */
export interface ContinuousEffectDefinition {
  readonly effectType: string;
  readonly affectedFilter: CardFilter;
  readonly modification: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// ReplacementEffect — CR 614 "instead" semantics
// ---------------------------------------------------------------------------

/** How long a replacement effect lasts. */
export type ReplacementEffectDuration =
  | "whileSourceOnBattlefield"
  | "endOfTurn"
  | "permanent";

/**
 * What a replacement effect does instead of the original event.
 * Discriminated union on `type`.
 */
export type ReplacementAction =
  | { readonly type: "changeZone"; readonly fromZone: ZoneType; readonly toZone: ZoneType }
  | { readonly type: "preventDamage"; readonly amount: NumberOrExpression }
  | { readonly type: "modifyAmount"; readonly multiplier?: number; readonly addition?: number }
  | { readonly type: "addEffect"; readonly effect: Effect }
  | { readonly type: "custom"; readonly resolveFunction: string };

/**
 * A replacement effect per MTG Comprehensive Rules 614.
 *
 * Replacement effects modify an event as it happens ("instead" semantics).
 * They are checked before the event occurs and, if matched, the replacement
 * is applied in place of the original event. Each replacement can only
 * apply once per event (CR 614.5) unless appliedOnce is false.
 */
export interface ReplacementEffect {
  readonly id: string;
  readonly sourceCardInstanceId: string;
  readonly eventType: GameEventType | readonly GameEventType[];
  readonly filter: CardFilter | null;
  readonly replacementAction: ReplacementAction;
  readonly condition: Condition | null;
  readonly self: boolean;
  readonly duration: ReplacementEffectDuration;
  readonly appliedOnce: boolean;
}

// ---------------------------------------------------------------------------
// Selectors, Filters, and Conditions
// ---------------------------------------------------------------------------

/** Numeric comparison operator. */
export type ComparisonOp = "eq" | "lt" | "lte" | "gt" | "gte" | "neq";

/** Numeric comparison. */
export interface Comparison {
  readonly op: ComparisonOp;
  readonly value: number;
}

/**
 * Used throughout effects to identify which cards are affected.
 */
export interface CardSelector {
  readonly zone?: ZoneType | readonly ZoneType[];
  readonly controller?: "you" | "opponent" | "any" | string;
  readonly cardTypes?: readonly CardTypeName[];
  readonly subtypes?: readonly string[];
  readonly colors?: readonly ManaColor[];
  readonly name?: string;
  readonly power?: Comparison;
  readonly toughness?: Comparison;
  readonly cmc?: Comparison;
  readonly keywords?: readonly string[];
  readonly custom?: string;
}

/**
 * Similar to CardSelector but used in TargetRequirements, excluding zone
 * (context-dependent).
 */
export interface CardFilter {
  readonly cardTypes?: readonly CardTypeName[];
  readonly subtypes?: readonly string[];
  readonly supertypes?: readonly string[];
  readonly colors?: readonly ManaColor[];
  readonly colorsNot?: readonly ManaColor[];
  readonly name?: string;
  readonly power?: Comparison;
  readonly toughness?: Comparison;
  readonly cmc?: Comparison;
  readonly keywords?: readonly string[];
  readonly self?: boolean;
  readonly custom?: string;
}

/**
 * A boolean predicate on game state. Discriminated union.
 * Used in triggered ability conditions and conditional effects.
 */
export type Condition =
  | { readonly type: "controlsPermanent"; readonly filter: CardFilter }
  | { readonly type: "lifeAtOrBelow"; readonly amount: number; readonly player: PlayerRef }
  | { readonly type: "cardInZone"; readonly filter: CardFilter; readonly zone: ZoneType }
  | { readonly type: "opponentCount"; readonly comparison: Comparison; readonly count: number }
  | { readonly type: "and"; readonly conditions: readonly Condition[] }
  | { readonly type: "or"; readonly conditions: readonly Condition[] }
  | { readonly type: "not"; readonly condition: Condition }
  | { readonly type: "custom"; readonly predicateFunction: string };
