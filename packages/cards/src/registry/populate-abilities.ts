/**
 * Populate abilities and card metadata on CardInstances in a GameState.
 *
 * The engine's createGame builds CardInstances with empty abilities arrays
 * and null basePower/baseToughness/isLegendary (it doesn't know about card
 * data). This function is called by the server after createGame to fill in:
 *   - Abilities via the three-tier system (overrides → keywords → oracle parser)
 *   - basePower / baseToughness from CardData.power/toughness strings
 *   - isLegendary from CardData.supertypes
 *   - modifiedPower / modifiedToughness (initialized to base values)
 *   - currentLoyalty from CardData.loyalty
 *
 * Requires the card database to be loaded (loadCardDatabase must have been
 * called before this function).
 */

import type { GameState, CardInstance, SpellAbility, CardData, Supertype } from "@magic-flux/types";
import { getCardData, getCardDataByName } from "./card-registry.js";
import { getCardOverride } from "../overrides/index.js";
import { generateKeywordAbilities } from "../keywords/index.js";
import { parseOracleText } from "../parser/oracle-parser.js";

/**
 * Resolve abilities for a single CardInstance using the three-tier system.
 */
function resolveAbilitiesForInstance(card: CardInstance): SpellAbility[] {
  // Tier 3 (highest priority): Manual override — check directly by cardDataId
  // (which is the card name). This works without the Scryfall database loaded.
  const override = getCardOverride(card.cardDataId);
  if (override) {
    return override.getAbilities().map((ability) => ({
      ...ability,
      sourceCardInstanceId: card.instanceId,
    }));
  }

  // For keyword/oracle parsing, we need CardData from the database
  const cardData = getCardData(card.cardDataId) ?? getCardDataByName(card.cardDataId);
  if (!cardData) {
    return [];
  }

  // Tier 1: Keyword registry
  const keywordAbilities = generateKeywordAbilities(cardData.keywords);

  // Tier 2: Oracle text parser
  const parsedAbilities = parseOracleText(cardData.oracleText, cardData);

  return [...keywordAbilities, ...parsedAbilities].map((ability) => ({
    ...ability,
    sourceCardInstanceId: card.instanceId,
  }));
}

/** Parse a P/T string ("4", "*", "1+*") into a number. Returns null for non-creatures. */
function parsePT(value: string | null): number | null {
  if (value === null) return null;
  if (value === "*") return 0; // CDA — actual value computed by layer system
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Populate abilities and card metadata on all CardInstances in a GameState.
 *
 * Call this after engine.createGame() to fill in abilities, base P/T,
 * isLegendary, and loyalty. Returns a new GameState (immutable).
 */
export function populateCardAbilities(state: GameState): GameState {
  const updatedInstances: Record<string, CardInstance> = {};

  for (const [instanceId, card] of Object.entries(state.cardInstances)) {
    // Look up CardData for this instance
    const cardData = getCardData(card.cardDataId) ?? getCardDataByName(card.cardDataId);

    // Resolve abilities
    const abilities = card.abilities.length > 0
      ? card.abilities  // Already populated (defensive)
      : resolveAbilitiesForInstance(card);

    // Compute base stats from CardData, falling back to override P/T when DB unavailable
    const override = getCardOverride(card.cardDataId);
    const basePower = cardData ? parsePT(cardData.power)
      : override?.power !== undefined ? parsePT(override.power)
      : card.basePower;
    const baseToughness = cardData ? parsePT(cardData.toughness)
      : override?.toughness !== undefined ? parsePT(override.toughness)
      : card.baseToughness;
    const isLegendary = cardData
      ? cardData.supertypes.includes("Legendary" as Supertype)
      : card.isLegendary;
    const currentLoyalty = cardData?.loyalty !== null && cardData?.loyalty !== undefined
      ? parseInt(cardData.loyalty, 10) || null
      : card.currentLoyalty;

    updatedInstances[instanceId] = {
      ...card,
      abilities,
      basePower,
      baseToughness,
      isLegendary,
      modifiedPower: basePower,  // Layer system will recalculate from base
      modifiedToughness: baseToughness,
      currentLoyalty,
    };
  }

  return { ...state, cardInstances: updatedInstances };
}
