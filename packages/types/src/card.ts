/**
 * Card types for Magic: The Gathering.
 *
 * CardData is the static, immutable definition sourced from Scryfall (DEC-003).
 * CardInstance is a per-game object referencing a CardData ID plus dynamic state.
 */

import type { ManaColor, ManaCost, ManaPool } from "./mana.js";
import type { ZoneType } from "./zones.js";
import type { SpellAbility } from "./abilities.js";

// ---------------------------------------------------------------------------
// Card type-line components
// ---------------------------------------------------------------------------

/** Supertypes that can appear on a card's type line. */
export type Supertype = "Basic" | "Legendary" | "Snow" | "World";

/** The main card types. */
export type CardTypeName =
  | "Creature"
  | "Instant"
  | "Sorcery"
  | "Enchantment"
  | "Artifact"
  | "Planeswalker"
  | "Land"
  | "Battle"
  | "Tribal"
  | "Kindred";

/**
 * Card layout variants. Determines how faces are structured.
 */
export type CardLayout =
  | "normal"
  | "transform"
  | "modal_dfc"
  | "split"
  | "adventure"
  | "flip"
  | "meld"
  | "saga"
  | "class"
  | "prototype"
  | "token"
  | "planar"
  | "scheme"
  | "vanguard"
  | "emblem"
  | "augment"
  | "host"
  | "leveler"
  | "case"
  | "mutate";

/** Format legality status from Scryfall. */
export type FormatLegality = "legal" | "not_legal" | "banned" | "restricted";

// ---------------------------------------------------------------------------
// Card faces (multi-faced cards)
// ---------------------------------------------------------------------------

/**
 * A single face of a multi-faced card. Contains the face-specific subset of
 * card data. For single-faced cards, faces is null or a single-element array.
 */
export interface CardFace {
  readonly name: string;
  readonly manaCost: string | null;
  readonly typeLine: string;
  readonly oracleText: string;
  readonly power: string | null;
  readonly toughness: string | null;
  readonly loyalty: string | null;
  readonly defense: string | null;
  readonly colors: readonly ManaColor[];
  readonly imageUris: Readonly<Record<string, string>> | null;
}

// ---------------------------------------------------------------------------
// CardData -- static, immutable card definition from Scryfall
// ---------------------------------------------------------------------------

/**
 * The static, immutable definition of a card as sourced from Scryfall.
 * One CardData exists per unique printing, shared across all games.
 *
 * Per DEC-003: static data is shared across all games and loaded once.
 */
export interface CardData {
  /** Scryfall UUID. Primary key for all lookups. */
  readonly id: string;
  /** Scryfall oracle ID. Groups all printings of the same card. */
  readonly oracleId: string;
  /**
   * Card name. For double-faced cards, the front face name.
   * For split cards, both names joined with " // ".
   */
  readonly name: string;
  /** Mana cost string as printed (e.g., "{2}{W}{U}"). Null for lands etc. */
  readonly manaCost: string | null;
  /** Parsed ManaCost object. Null for cards with no mana cost. */
  readonly parsedManaCost: ManaCost | null;
  /** Converted mana cost / mana value. */
  readonly cmc: number;
  /** Full type line string (e.g., "Legendary Creature -- Human Wizard"). */
  readonly typeLine: string;
  /** Supertypes parsed from typeLine. */
  readonly supertypes: readonly Supertype[];
  /** Card types parsed from typeLine. */
  readonly cardTypes: readonly CardTypeName[];
  /** Subtypes parsed from typeLine (creature types, land types, etc.). */
  readonly subtypes: readonly string[];
  /** Rules text. For double-faced cards, front face text only. */
  readonly oracleText: string;
  /**
   * Power as printed. String because it can be "*" or "1+*".
   * Null for non-creatures.
   */
  readonly power: string | null;
  /**
   * Toughness as printed. String because it can be "*" or "1+*".
   * Null for non-creatures.
   */
  readonly toughness: string | null;
  /** Starting loyalty for planeswalkers. Null otherwise. */
  readonly loyalty: string | null;
  /** Starting defense for battles. Null otherwise. */
  readonly defense: string | null;
  /** The card's colors (not color identity). */
  readonly colors: readonly ManaColor[];
  /** Color identity -- includes mana symbols in rules text. Used for Commander. */
  readonly colorIdentity: readonly ManaColor[];
  /** Keyword strings from Scryfall (e.g., ["Flying", "Vigilance"]). */
  readonly keywords: readonly string[];
  /** Card layout variant. */
  readonly layout: CardLayout;
  /**
   * Face objects for multi-faced cards. Null or empty for single-faced cards.
   */
  readonly faces: readonly CardFace[] | null;
  /**
   * Map of image size to URL.
   * For multi-faced cards, each face has its own imageUris in the faces array.
   */
  readonly imageUris: Readonly<Record<string, string>> | null;
  /** Map of format name to legality. */
  readonly legalities: Readonly<Record<string, FormatLegality>>;
  /** True for token card data entries. */
  readonly isToken: boolean;
  /** Mana colors this card can produce. UI hint, not used for rules. */
  readonly producedMana: readonly ManaColor[] | null;
}

// ---------------------------------------------------------------------------
// CardInstance -- per-game mutable card state
// ---------------------------------------------------------------------------

/**
 * Choices made when casting a spell. Stored on the instance so resolution
 * can reference them.
 */
export interface CastingChoices {
  /** X value chosen by the caster. */
  readonly xValue: number | null;
  /** Whether kicker was paid. */
  readonly kickerPaid: boolean;
  /** Additional kicker cost paid (for multi-kicker or multiple kicker costs). */
  readonly additionalKickersPaid: readonly string[];
  /** Chosen mode(s) for modal spells. */
  readonly chosenModes: readonly number[];
  /** Alternative cost used (e.g., flashback, overload). Null for regular casting. */
  readonly alternativeCostUsed: string | null;
}

/**
 * A linked effect reference -- effects that link back to this card.
 * (e.g., "exile target card... return it at end of turn")
 */
export interface LinkedEffect {
  readonly effectId: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/**
 * A specific card in a specific game. References a CardData by ID and carries
 * all mutable game state.
 *
 * Per DEC-003: instance data is per-game and changes every action.
 * Per DEC-001: engine functions return new CardInstance objects rather than
 * mutating existing ones.
 */
export interface CardInstance {
  /** Unique identifier within this game. */
  readonly instanceId: string;
  /** Reference to the static CardData by Scryfall ID. */
  readonly cardDataId: string;
  /** Player ID who started the game with this card. Never changes. */
  readonly owner: string;
  /** Player ID who currently controls this card. Can differ from owner. */
  readonly controller: string;
  /** Zone where this card currently exists. */
  readonly zone: ZoneType;
  /** For per-player zones: which player's zone. Null for shared zones. */
  readonly zoneOwnerId: string | null;
  /** Whether this permanent is tapped. Only meaningful on the battlefield. */
  readonly tapped: boolean;
  /** Whether this card is flipped (flip cards). */
  readonly flipped: boolean;
  /** Whether this card is face-down (morph/manifest, face-down exile). */
  readonly faceDown: boolean;
  /** Whether this DFC is showing the back face. */
  readonly transformedOrBack: boolean;
  /** Whether this permanent is phased out. */
  readonly phasedOut: boolean;
  /**
   * True when a creature enters the battlefield and hasn't been under its
   * controller's control since the beginning of their most recent turn.
   * Reset at the start of the controller's untap step.
   */
  readonly summoningSickness: boolean;
  /** Damage marked on this permanent. Reset during cleanup step. */
  readonly damage: number;
  /** Map of counter type string to count (e.g., "+1/+1" -> 2). */
  readonly counters: Readonly<Record<string, number>>;
  /** instanceId of the permanent this is attached to. Null if not attached. */
  readonly attachedTo: string | null;
  /** instanceIds of permanents attached to this one (auras, equipment). */
  readonly attachments: readonly string[];
  /**
   * All abilities on this card, populated during instantiation by combining
   * keyword behaviors, parsed oracle abilities, and any overrides.
   */
  readonly abilities: readonly SpellAbility[];
  /** Current power after all modifications. Null for non-creatures. */
  readonly modifiedPower: number | null;
  /** Current toughness after all modifications. Null for non-creatures. */
  readonly modifiedToughness: number | null;
  /** Base power as set during instantiation (from CardData). Null for non-creatures. */
  readonly basePower: number | null;
  /** Base toughness as set during instantiation (from CardData). Null for non-creatures. */
  readonly baseToughness: number | null;
  /** Whether this permanent has the Legendary supertype. Used by Legend Rule SBA. */
  readonly isLegendary: boolean;
  /** Current loyalty for planeswalkers. Null otherwise. */
  readonly currentLoyalty: number | null;
  /** Choices made when this spell was cast. Null if not cast (e.g., tokens). */
  readonly castingChoices: CastingChoices | null;
  /** Effects that link back to this card. */
  readonly linkedEffects: Readonly<Record<string, LinkedEffect>>;
}

// ---------------------------------------------------------------------------
// TokenDefinition -- template for creating tokens
// ---------------------------------------------------------------------------

/**
 * Defines a token to be created by an effect.
 */
export interface TokenDefinition {
  readonly name: string;
  readonly colors: readonly ManaColor[];
  readonly cardTypes: readonly CardTypeName[];
  readonly subtypes: readonly string[];
  readonly power: number | null;
  readonly toughness: number | null;
  readonly abilities: readonly SpellAbility[];
  readonly keywords: readonly string[];
}

// ---------------------------------------------------------------------------
// Decklist types
// ---------------------------------------------------------------------------

/**
 * A single line in a decklist -- a card and how many copies.
 */
export interface DecklistEntry {
  readonly count: number;
  /**
   * Card name as it appears in Scryfall (exact match after normalization).
   * For double-faced cards, the front face name.
   */
  readonly cardName: string;
  /** Scryfall UUID. Populated after resolving name against card database. */
  readonly cardDataId: string | null;
  /** Set code for printing selection. Not rules-relevant. */
  readonly setCode: string | null;
  /** Collector number within the set. For exact printing selection. */
  readonly collectorNumber: string | null;
}

/**
 * A complete deck ready for play.
 */
export interface Decklist {
  readonly name: string;
  readonly format: string;
  readonly mainboard: readonly DecklistEntry[];
  readonly sideboard: readonly DecklistEntry[];
  /** Commander (Commander format only). Also appears in mainboard. */
  readonly commander: DecklistEntry | null;
  /** Companion, if any. */
  readonly companion: DecklistEntry | null;
}

/**
 * Result of validating a deck against a format's rules.
 */
export interface DeckValidationError {
  readonly message: string;
  readonly cardName?: string;
}

export interface DeckValidationWarning {
  readonly message: string;
}

export interface DeckValidationResult {
  readonly valid: boolean;
  readonly errors: readonly DeckValidationError[];
  readonly warnings: readonly DeckValidationWarning[];
}
