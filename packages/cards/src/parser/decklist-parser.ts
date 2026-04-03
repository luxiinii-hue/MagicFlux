/**
 * Decklist text parser.
 *
 * Parses the standard plain-text decklist format used by Moxfield, MTGA,
 * Archidekt, and most deckbuilding tools.
 *
 * Format:
 *   [count] [card name]
 *   [count] [card name] ([set code]) [collector number]
 *
 * Section headers: Sideboard, Commander, Companion, Deck (case-insensitive)
 * Comments: lines starting with //
 * Blank lines: ignored
 * Default section: mainboard
 */

import type { Decklist, DecklistEntry } from "@magic-flux/types";
import { getCardDataByName } from "../registry/card-registry.js";

// ---------------------------------------------------------------------------
// Line parsing
// ---------------------------------------------------------------------------

/** Regex for a deck entry line: count, card name, optional (set) collector# */
const ENTRY_REGEX = /^(\d+)\s+(.+?)(?:\s+\((\w+)\)\s+(\S+))?\s*$/;

const SECTION_HEADERS = new Set([
  "deck", "mainboard", "sideboard", "commander", "companion",
]);

type Section = "mainboard" | "sideboard" | "commander" | "companion";

function parseSection(header: string): Section {
  const lower = header.toLowerCase().trim();
  if (lower === "deck" || lower === "mainboard") return "mainboard";
  if (lower === "sideboard") return "sideboard";
  if (lower === "commander") return "commander";
  if (lower === "companion") return "companion";
  return "mainboard";
}

function isSectionHeader(line: string): boolean {
  return SECTION_HEADERS.has(line.toLowerCase().trim());
}

// ---------------------------------------------------------------------------
// Fuzzy name matching
// ---------------------------------------------------------------------------

/**
 * Levenshtein distance between two strings.
 * Used for fuzzy card name matching when exact match fails.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/**
 * Try to resolve a card name against the card database.
 *
 * 1. Exact match (case-insensitive)
 * 2. Fuzzy match (Levenshtein distance <= 2)
 *
 * Returns { cardDataId, resolvedName } or null if unresolvable.
 */
function resolveCardName(
  rawName: string,
): { cardDataId: string; resolvedName: string } | null {
  // Exact match
  const exact = getCardDataByName(rawName);
  if (exact) {
    return { cardDataId: exact.id, resolvedName: exact.name };
  }

  // Fuzzy match is expensive over 30K+ cards — skip if the database isn't loaded
  // For now, return null. The caller adds to unresolvedCards.
  // A full fuzzy search would iterate byName keys, which we avoid for performance.
  // Instead, try simple normalization: strip accents, normalize hyphens/apostrophes
  const normalized = rawName
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/['']/g, "'") // normalize apostrophes
    .replace(/[–—]/g, "-"); // normalize dashes

  if (normalized !== rawName) {
    const normMatch = getCardDataByName(normalized);
    if (normMatch) {
      return { cardDataId: normMatch.id, resolvedName: normMatch.name };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ParseDecklistResult {
  readonly decklist: Decklist;
  readonly unresolvedCards: readonly string[];
}

/**
 * Parse a plain-text decklist into a Decklist object.
 *
 * Resolves card names against the loaded card database. Cards that can't
 * be matched go into unresolvedCards.
 *
 * @param text - The raw decklist text (Moxfield/MTGA/Archidekt export)
 * @param deckName - Name for the deck (defaults to "Imported Deck")
 * @param format - Target format (defaults to "standard")
 */
export function parseDecklistText(
  text: string,
  deckName: string = "Imported Deck",
  format: string = "standard",
): ParseDecklistResult {
  const mainboard: DecklistEntry[] = [];
  const sideboard: DecklistEntry[] = [];
  let commander: DecklistEntry | null = null;
  let companion: DecklistEntry | null = null;
  const unresolvedCards: string[] = [];

  let currentSection: Section = "mainboard";

  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith("//")) continue;

    // Check for section header
    if (isSectionHeader(line)) {
      currentSection = parseSection(line);
      continue;
    }

    // Try to parse as a deck entry
    const match = line.match(ENTRY_REGEX);
    if (!match) {
      // Could be a section header variant like "Sideboard:" — try stripping colon
      const stripped = line.replace(/:$/, "").trim();
      if (isSectionHeader(stripped)) {
        currentSection = parseSection(stripped);
        continue;
      }
      // Unrecognized line — skip
      continue;
    }

    const count = parseInt(match[1], 10);
    const rawCardName = match[2].trim();
    const setCode = match[3] ?? null;
    const collectorNumber = match[4] ?? null;

    // Resolve card name against database
    const resolved = resolveCardName(rawCardName);

    const entry: DecklistEntry = {
      count,
      cardName: resolved ? resolved.resolvedName : rawCardName,
      cardDataId: resolved?.cardDataId ?? null,
      setCode,
      collectorNumber,
    };

    if (!resolved) {
      unresolvedCards.push(rawCardName);
    }

    switch (currentSection) {
      case "mainboard":
        mainboard.push(entry);
        break;
      case "sideboard":
        sideboard.push(entry);
        break;
      case "commander":
        commander = entry;
        // Commander also goes in mainboard per Decklist type docs
        mainboard.push(entry);
        break;
      case "companion":
        companion = entry;
        break;
    }
  }

  return {
    decklist: {
      name: deckName,
      format,
      mainboard,
      sideboard,
      commander,
      companion,
    },
    unresolvedCards,
  };
}

/**
 * Export a Decklist back to plain-text format.
 *
 * Deterministic output: mainboard sorted alphabetically, then sideboard,
 * then commander section if present. Round-trippable with parseDecklistText.
 */
export function exportDecklistText(decklist: Decklist): string {
  const lines: string[] = [];

  // Sort mainboard alphabetically by card name (exclude commander if present)
  const mainEntries = decklist.commander
    ? decklist.mainboard.filter((e) => e.cardName !== decklist.commander!.cardName)
    : [...decklist.mainboard];
  mainEntries.sort((a, b) => a.cardName.localeCompare(b.cardName));

  for (const entry of mainEntries) {
    lines.push(formatEntry(entry));
  }

  if (decklist.sideboard.length > 0) {
    lines.push("");
    lines.push("Sideboard");
    const sideEntries = [...decklist.sideboard].sort((a, b) =>
      a.cardName.localeCompare(b.cardName),
    );
    for (const entry of sideEntries) {
      lines.push(formatEntry(entry));
    }
  }

  if (decklist.commander) {
    lines.push("");
    lines.push("Commander");
    lines.push(formatEntry(decklist.commander));
  }

  if (decklist.companion) {
    lines.push("");
    lines.push("Companion");
    lines.push(formatEntry(decklist.companion));
  }

  return lines.join("\n");
}

function formatEntry(entry: DecklistEntry): string {
  let line = `${entry.count} ${entry.cardName}`;
  if (entry.setCode) {
    line += ` (${entry.setCode})`;
    if (entry.collectorNumber) {
      line += ` ${entry.collectorNumber}`;
    }
  }
  return line;
}

// ---------------------------------------------------------------------------
// Deck validation
// ---------------------------------------------------------------------------

const BASIC_LAND_NAMES = new Set([
  "plains", "island", "swamp", "mountain", "forest",
  "snow-covered plains", "snow-covered island", "snow-covered swamp",
  "snow-covered mountain", "snow-covered forest",
  "wastes",
]);

function isBasicLand(name: string): boolean {
  return BASIC_LAND_NAMES.has(name.toLowerCase());
}

/**
 * Validate a decklist against format rules.
 *
 * - Standard/Modern: 60+ mainboard, 0-15 sideboard, max 4 copies non-basic
 * - Commander: exactly 100 total (including commander), singleton, color identity
 */
export function validateDecklist(
  decklist: Decklist,
  format: string,
): import("@magic-flux/types").DeckValidationResult {
  const errors: import("@magic-flux/types").DeckValidationError[] = [];
  const warnings: import("@magic-flux/types").DeckValidationWarning[] = [];

  if (format === "commander") {
    return validateCommander(decklist, errors, warnings);
  }

  // Standard / Modern validation
  const mainTotal = decklist.mainboard.reduce((sum, e) => sum + e.count, 0);
  const sideTotal = decklist.sideboard.reduce((sum, e) => sum + e.count, 0);

  if (mainTotal < 60) {
    errors.push({ message: `Mainboard has ${mainTotal} cards, minimum is 60` });
  }

  if (sideTotal > 15) {
    errors.push({ message: `Sideboard has ${sideTotal} cards, maximum is 15` });
  }

  // Check copy limits (max 4 of any non-basic-land card across main + side)
  const cardCounts = new Map<string, number>();
  for (const entry of [...decklist.mainboard, ...decklist.sideboard]) {
    const name = entry.cardName.toLowerCase();
    if (isBasicLand(name)) continue;
    cardCounts.set(name, (cardCounts.get(name) ?? 0) + entry.count);
  }

  for (const [name, count] of cardCounts) {
    if (count > 4) {
      errors.push({
        message: `${count} copies of "${name}" exceeds the 4-copy limit`,
        cardName: name,
      });
    }
  }

  // Check format legality for resolved cards
  for (const entry of [...decklist.mainboard, ...decklist.sideboard]) {
    if (!entry.cardDataId) continue;
    const card = getCardDataByName(entry.cardName);
    if (!card) continue;
    const legality = card.legalities[format];
    if (legality === "banned") {
      errors.push({
        message: `"${entry.cardName}" is banned in ${format}`,
        cardName: entry.cardName,
      });
    } else if (legality === "not_legal") {
      errors.push({
        message: `"${entry.cardName}" is not legal in ${format}`,
        cardName: entry.cardName,
      });
    } else if (legality === "restricted") {
      const totalCopies = cardCounts.get(entry.cardName.toLowerCase()) ?? entry.count;
      if (totalCopies > 1) {
        errors.push({
          message: `"${entry.cardName}" is restricted to 1 copy in ${format}`,
          cardName: entry.cardName,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateCommander(
  decklist: Decklist,
  errors: import("@magic-flux/types").DeckValidationError[],
  warnings: import("@magic-flux/types").DeckValidationWarning[],
): import("@magic-flux/types").DeckValidationResult {
  const mainTotal = decklist.mainboard.reduce((sum, e) => sum + e.count, 0);

  if (mainTotal !== 100) {
    errors.push({
      message: `Commander deck must be exactly 100 cards (including commander), found ${mainTotal}`,
    });
  }

  if (!decklist.commander) {
    errors.push({ message: "Commander deck must have a commander designated" });
  }

  // Singleton: max 1 copy of each non-basic-land card
  for (const entry of decklist.mainboard) {
    if (isBasicLand(entry.cardName)) continue;
    if (entry.count > 1) {
      errors.push({
        message: `${entry.count} copies of "${entry.cardName}" — Commander is singleton (max 1)`,
        cardName: entry.cardName,
      });
    }
  }

  // Color identity: all cards must be within commander's color identity
  if (decklist.commander?.cardDataId) {
    const commanderCard = getCardDataByName(decklist.commander.cardName);
    if (commanderCard) {
      const identity = new Set(commanderCard.colorIdentity);

      for (const entry of decklist.mainboard) {
        const card = getCardDataByName(entry.cardName);
        if (!card) continue;
        for (const color of card.colorIdentity) {
          if (!identity.has(color)) {
            errors.push({
              message: `"${entry.cardName}" has color identity ${card.colorIdentity.join("")} which is outside commander's identity ${commanderCard.colorIdentity.join("")}`,
              cardName: entry.cardName,
            });
            break;
          }
        }
      }
    }
  }

  // Format legality
  for (const entry of decklist.mainboard) {
    const card = getCardDataByName(entry.cardName);
    if (!card) continue;
    const legality = card.legalities.commander;
    if (legality === "banned") {
      errors.push({
        message: `"${entry.cardName}" is banned in Commander`,
        cardName: entry.cardName,
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
