/**
 * @magic-flux/cards -- Card data pipeline and behavior system.
 *
 * Loads card data from Scryfall, parses oracle text into structured abilities,
 * registers keyword behaviors, and instantiates card instances for gameplay.
 */

// Card registry (includes loadCardDatabase which wraps the Scryfall pipeline)
export {
  loadCardDatabase,
  getCardData,
  getCardDataByName,
  searchCards,
  isLegalInFormat,
  instantiateCard,
  getLoadedCardCount,
} from "./registry/card-registry.js";

// Parsers
export { parseManaCost } from "./parser/cost-parser.js";
export { parseTypeLine } from "./parser/type-line-parser.js";
export { parseOracleText } from "./parser/oracle-parser.js";
export {
  parseDecklistText,
  exportDecklistText,
  validateDecklist,
} from "./parser/decklist-parser.js";

// Override system
export {
  getCardOverride,
  hasCardOverride,
  getOverrideNames,
} from "./overrides/index.js";

// Keyword system
export {
  getKeywordDefinition,
  getKeywordBehavior,
  hasKeyword,
  getImplementedKeywords,
  generateKeywordAbilities,
} from "./keywords/index.js";

// Types re-exported for convenience
export type { CardQuery } from "./registry/card-registry.js";
export type { CardOverrideEntry } from "./overrides/index.js";
export type { KeywordDefinition, KeywordType } from "./keywords/index.js";
export type { ParseDecklistResult } from "./parser/decklist-parser.js";
export type { ScryfallCard } from "./scryfall/types.js";
