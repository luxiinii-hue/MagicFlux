/**
 * Keyword system entry point.
 *
 * Importing this module registers all keyword definitions with the registry.
 * Must be imported before any calls to generateKeywordAbilities.
 */

// Import side-effect modules to register keywords
import "./static-keywords.js";
import "./triggered-keywords.js";
import "./activated-keywords.js";
import "./phase5-keywords.js";

// Re-export the registry API
export {
  getKeywordDefinition,
  getKeywordDefinition as getKeywordBehavior,
  hasKeyword,
  getImplementedKeywords,
  generateKeywordAbilities,
} from "./registry.js";

export type { KeywordDefinition, KeywordType } from "./registry.js";
