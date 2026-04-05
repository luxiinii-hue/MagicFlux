/**
 * Populate abilities on CardInstances in a GameState.
 *
 * The engine's createGame builds CardInstances with empty abilities arrays
 * (it doesn't know about card behaviors). This function is called by the
 * server after createGame to fill in abilities using the three-tier system:
 *   1. Manual overrides (highest priority)
 *   2. Keyword registry (from Scryfall keywords array)
 *   3. Oracle text parser (from oracle text patterns)
 *
 * Requires the card database to be loaded (loadCardDatabase must have been
 * called before this function).
 */

import type { GameState, CardInstance, SpellAbility } from "@magic-flux/types";
import { getCardData, getCardDataByName } from "./card-registry.js";
import { getCardOverride } from "../overrides/index.js";
import { generateKeywordAbilities } from "../keywords/index.js";
import { parseOracleText } from "../parser/oracle-parser.js";

/**
 * Resolve abilities for a single CardInstance using the three-tier system.
 *
 * @param card - The CardInstance to resolve abilities for
 * @returns SpellAbility array with sourceCardInstanceId stamped
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

/**
 * Populate abilities on all CardInstances in a GameState.
 *
 * Call this after engine.createGame() to fill in card abilities.
 * Returns a new GameState with abilities populated (immutable — does not
 * mutate the input).
 *
 * @param state - GameState from engine.createGame()
 * @returns New GameState with abilities populated on all CardInstances
 */
export function populateCardAbilities(state: GameState): GameState {
  const updatedInstances: Record<string, CardInstance> = {};

  for (const [instanceId, card] of Object.entries(state.cardInstances)) {
    if (card.abilities.length > 0) {
      // Already has abilities (shouldn't happen from createGame, but defensive)
      updatedInstances[instanceId] = card;
      continue;
    }

    const abilities = resolveAbilitiesForInstance(card);
    if (abilities.length > 0) {
      updatedInstances[instanceId] = { ...card, abilities };
    } else {
      updatedInstances[instanceId] = card;
    }
  }

  return { ...state, cardInstances: updatedInstances };
}
