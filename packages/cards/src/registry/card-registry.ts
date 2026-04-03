/**
 * Card registry — in-memory card database with lookup and search.
 *
 * After loadCardDatabase() is called, all queries are synchronous
 * lookups into in-memory Maps.
 */

import type {
  CardData,
  CardInstance,
  CardTypeName,
  FormatLegality,
  ManaColor,
  ZoneType,
  SpellAbility,
} from "@magic-flux/types";
import { loadBulkCardData } from "../scryfall/bulk-loader.js";
import { getCardOverride } from "../overrides/index.js";
import { generateKeywordAbilities } from "../keywords/index.js";
import { parseOracleText } from "../parser/oracle-parser.js";

// ---------------------------------------------------------------------------
// In-memory indexes
// ---------------------------------------------------------------------------

let byId: Map<string, CardData> = new Map();
let byOracleId: Map<string, CardData> = new Map();
let byName: Map<string, CardData> = new Map();
let loaded = false;

/**
 * Build indexes from a list of CardData.
 * Exported for testing — production code uses loadCardDatabase().
 */
export function buildIndexes(cards: CardData[]): void {
  byId = new Map();
  byOracleId = new Map();
  byName = new Map();

  for (const card of cards) {
    byId.set(card.id, card);
    byOracleId.set(card.oracleId, card);

    // Primary name index (lowercase)
    const lowerName = card.name.toLowerCase();
    byName.set(lowerName, card);

    // For split/DFC cards like "Fire // Ice", also index each half
    if (card.name.includes(" // ")) {
      const parts = card.name.split(" // ");
      for (const part of parts) {
        const lowerPart = part.trim().toLowerCase();
        // Don't overwrite if a real card already has this name
        if (!byName.has(lowerPart)) {
          byName.set(lowerPart, card);
        }
      }
    }
  }

  loaded = true;
}

/**
 * Load the card database from Scryfall bulk data.
 *
 * Downloads fresh data if the local cache is stale, then builds
 * in-memory indexes. Must be called once at server startup.
 */
export async function loadCardDatabase(): Promise<void> {
  const cards = await loadBulkCardData();
  buildIndexes(cards);
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/** Get a card by Scryfall UUID. */
export function getCardData(cardDataId: string): CardData | undefined {
  return byId.get(cardDataId);
}

/** Get a card by exact name (case-insensitive). */
export function getCardDataByName(name: string): CardData | undefined {
  return byName.get(name.toLowerCase());
}

/** Get a card by oracle ID. */
export function getCardDataByOracleId(oracleId: string): CardData | undefined {
  return byOracleId.get(oracleId);
}

/** Number of cards currently loaded. */
export function getLoadedCardCount(): number {
  return byId.size;
}

/** Whether the database has been loaded. */
export function isLoaded(): boolean {
  return loaded;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface CardQuery {
  /** Partial name match (case-insensitive substring). */
  readonly name?: string;
  /** Filter by card types (card must have at least one). */
  readonly types?: readonly CardTypeName[];
  /** Filter by colors (card must have at least one). */
  readonly colors?: readonly ManaColor[];
  /** Filter by format legality. */
  readonly format?: string;
  /** Filter by keywords (card must have all listed). */
  readonly keywords?: readonly string[];
  /** Filter by exact CMC. */
  readonly cmc?: number;
  /** Filter by set code. */
  readonly set?: string;
  /** Exclude tokens from results. Default true. */
  readonly excludeTokens?: boolean;
  /** Maximum results to return. Default 50. */
  readonly limit?: number;
}

/**
 * Search the card database with filters.
 *
 * All filters are AND-ed: a card must match every specified filter.
 */
export function searchCards(query: CardQuery): CardData[] {
  const limit = query.limit ?? 50;
  const excludeTokens = query.excludeTokens ?? true;
  const results: CardData[] = [];

  for (const card of byId.values()) {
    if (results.length >= limit) break;

    if (excludeTokens && card.isToken) continue;

    if (query.name !== undefined) {
      if (!card.name.toLowerCase().includes(query.name.toLowerCase())) continue;
    }

    if (query.types !== undefined) {
      const hasType = query.types.some((t) => card.cardTypes.includes(t));
      if (!hasType) continue;
    }

    if (query.colors !== undefined) {
      const hasColor = query.colors.some((c) => card.colors.includes(c));
      if (!hasColor) continue;
    }

    if (query.format !== undefined) {
      const legality = card.legalities[query.format];
      if (legality !== "legal" && legality !== "restricted") continue;
    }

    if (query.keywords !== undefined) {
      const hasAll = query.keywords.every((k) =>
        card.keywords.some((ck) => ck.toLowerCase() === k.toLowerCase()),
      );
      if (!hasAll) continue;
    }

    if (query.cmc !== undefined) {
      if (card.cmc !== query.cmc) continue;
    }

    results.push(card);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Format legality
// ---------------------------------------------------------------------------

/**
 * Check whether a card is legal in a given format.
 * Returns true for "legal" and "restricted" status.
 */
export function isLegalInFormat(cardDataId: string, format: string): boolean {
  const card = byId.get(cardDataId);
  if (!card) return false;
  const status = card.legalities[format];
  return status === "legal" || status === "restricted";
}

// ---------------------------------------------------------------------------
// Card instantiation
// ---------------------------------------------------------------------------

/**
 * Create a CardInstance from CardData for use in a game.
 *
 * Populates abilities using the three-tier system:
 * 1. Check for manual overrides (highest priority, replaces all other abilities)
 * 2. (TODO Phase 3) Keywords from cardData.keywords via keyword registry
 * 3. (TODO Phase 3) Oracle text parser
 *
 * For Phase 2, only manual overrides produce abilities. Cards without an
 * override get an empty abilities array.
 */
export function instantiateCard(
  cardData: CardData,
  owner: string,
  instanceId: string,
  zone: ZoneType,
  zoneOwnerId: string | null,
): CardInstance {
  const basePower = cardData.power !== null && cardData.power !== "*"
    ? parseInt(cardData.power, 10)
    : cardData.power === "*" ? 0 : null;

  const baseToughness = cardData.toughness !== null && cardData.toughness !== "*"
    ? parseInt(cardData.toughness, 10)
    : cardData.toughness === "*" ? 0 : null;

  const baseLoyalty = cardData.loyalty !== null
    ? parseInt(cardData.loyalty, 10)
    : null;

  // Resolve abilities from the override registry
  const abilities = resolveAbilities(cardData, instanceId);

  return {
    instanceId,
    cardDataId: cardData.id,
    owner,
    controller: owner,
    zone,
    zoneOwnerId,
    tapped: false,
    flipped: false,
    faceDown: false,
    transformedOrBack: false,
    phasedOut: false,
    summoningSickness: false,
    damage: 0,
    counters: {},
    attachedTo: null,
    attachments: [],
    abilities,
    modifiedPower: basePower,
    modifiedToughness: baseToughness,
    currentLoyalty: baseLoyalty,
    castingChoices: null,
    linkedEffects: {},
  };
}

/**
 * Resolve a card's abilities using the three-tier system.
 *
 * Phase 2: only manual overrides. Overrides replace all auto-derived abilities.
 * Phase 3+: keywords + oracle parser as fallbacks when no override exists.
 */
function resolveAbilities(cardData: CardData, instanceId: string): SpellAbility[] {
  // Tier 3 (highest priority): Manual override
  const override = getCardOverride(cardData.name);
  if (override) {
    const abilities = override.getAbilities();
    // Stamp sourceCardInstanceId onto each ability
    return abilities.map((ability) => ({
      ...ability,
      sourceCardInstanceId: instanceId,
    }));
  }

  // Tier 1: Keyword registry — generate abilities from Scryfall keywords array
  const keywordAbilities = generateKeywordAbilities(cardData.keywords);

  // Tier 2: Oracle text parser — parse oracle text into structured abilities
  const parsedAbilities = parseOracleText(cardData.oracleText, cardData);

  const allAbilities = [...keywordAbilities, ...parsedAbilities];

  // Stamp sourceCardInstanceId onto all generated abilities
  return allAbilities.map((ability) => ({
    ...ability,
    sourceCardInstanceId: instanceId,
  }));
}
