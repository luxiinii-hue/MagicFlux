/**
 * Type line parser.
 *
 * Parses Scryfall type_line strings like "Legendary Creature — Human Wizard"
 * into structured supertypes, card types, and subtypes arrays.
 */

import type { Supertype, CardTypeName } from "@magic-flux/types";

const SUPERTYPES: ReadonlySet<string> = new Set([
  "Basic", "Legendary", "Snow", "World",
]);

const CARD_TYPES: ReadonlySet<string> = new Set([
  "Creature", "Instant", "Sorcery", "Enchantment", "Artifact",
  "Planeswalker", "Land", "Battle", "Tribal", "Kindred",
]);

export interface ParsedTypeLine {
  readonly supertypes: Supertype[];
  readonly cardTypes: CardTypeName[];
  readonly subtypes: string[];
}

/**
 * Parse a type line string into structured components.
 *
 * Handles:
 * - "Instant" → no supertypes, cardTypes=["Instant"], no subtypes
 * - "Legendary Creature — Human Wizard" → supertypes=["Legendary"], etc.
 * - "Artifact Creature — Golem" → cardTypes=["Artifact", "Creature"]
 * - "Basic Land — Plains" → supertypes=["Basic"], cardTypes=["Land"]
 * - Split cards: "Instant // Instant" (both halves in one string)
 *
 * For double-faced cards, Scryfall gives the front face type_line by default.
 * Back face is in card_faces[1].type_line.
 */
export function parseTypeLine(typeLine: string): ParsedTypeLine {
  if (!typeLine) {
    return { supertypes: [], cardTypes: [], subtypes: [] };
  }

  // Split on the em dash (or en dash) separating types from subtypes.
  // Scryfall uses " — " (space-emdash-space) but we handle variations.
  const dashSplit = typeLine.split(/\s+[—–]\s+/);
  const leftSide = dashSplit[0].trim();
  const rightSide = dashSplit.length > 1 ? dashSplit.slice(1).join(" ").trim() : "";

  // For split cards like "Instant // Sorcery", process only the front half
  // for the main type line. Full split handling is at the CardData level.
  const typeWords = leftSide.split(/\s+/).filter(Boolean);

  const supertypes: Supertype[] = [];
  const cardTypes: CardTypeName[] = [];

  for (const word of typeWords) {
    // Skip the "//" separator in split card type lines
    if (word === "//") break;

    if (SUPERTYPES.has(word)) {
      supertypes.push(word as Supertype);
    } else if (CARD_TYPES.has(word)) {
      cardTypes.push(word as CardTypeName);
    }
    // Unknown words on the left side are ignored (shouldn't happen with
    // well-formed Scryfall data, but defensive)
  }

  const subtypes = rightSide
    ? rightSide.split(/\s+/).filter(Boolean)
    : [];

  return { supertypes, cardTypes, subtypes };
}
