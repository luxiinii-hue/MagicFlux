/**
 * Mana cost string parser.
 *
 * Converts Scryfall mana cost strings like "{2}{W}{U}" into ManaCost objects
 * with typed ManaSymbol arrays and precomputed CMC.
 */

import type { ManaCost, ManaSymbol, ManaColor } from "@magic-flux/types";

const SYMBOL_REGEX = /\{([^}]+)\}/g;

const COLORS = new Set<string>(["W", "U", "B", "R", "G"]);

function isColor(s: string): s is ManaColor {
  return COLORS.has(s);
}

/**
 * Parse a single symbol body (the content between { and }) into a ManaSymbol.
 *
 * Examples:
 *   "3"   → generic(3)
 *   "W"   → colored(W)
 *   "C"   → colorless
 *   "X"   → X
 *   "S"   → snow
 *   "W/U" → hybrid(W, U)
 *   "2/W" → hybridGeneric(2, W)
 *   "W/P" → phyrexian(W)
 */
function parseSymbolBody(body: string): ManaSymbol {
  // X mana
  if (body === "X") {
    return { type: "X" };
  }

  // Snow mana
  if (body === "S") {
    return { type: "snow" };
  }

  // Colorless mana (specifically {C}, not generic)
  if (body === "C") {
    return { type: "colorless" };
  }

  // Single colored mana: W, U, B, R, G
  if (body.length === 1 && isColor(body)) {
    return { type: "colored", color: body };
  }

  // Generic mana: a number
  if (/^\d+$/.test(body)) {
    return { type: "generic", amount: parseInt(body, 10) };
  }

  // Slash-based symbols: hybrid, phyrexian, hybridGeneric
  if (body.includes("/")) {
    const [left, right] = body.split("/");

    // Phyrexian: {W/P}, {U/P}, etc.
    if (right === "P" && isColor(left)) {
      return { type: "phyrexian", color: left };
    }

    // Hybrid colored: {W/U}, {B/R}, etc.
    if (isColor(left) && isColor(right)) {
      return { type: "hybrid", colors: [left, right] };
    }

    // Hybrid generic: {2/W}, {2/U}, etc.
    if (/^\d+$/.test(left) && isColor(right)) {
      return { type: "hybridGeneric", amount: parseInt(left, 10), color: right };
    }
  }

  // Fallback: treat unknown as generic(0) with a warning
  console.warn(`cost-parser: unrecognized mana symbol "{${body}}", treating as generic(0)`);
  return { type: "generic", amount: 0 };
}

/** Compute the CMC contribution of a single symbol per MTG rules. */
function symbolCMC(sym: ManaSymbol): number {
  switch (sym.type) {
    case "generic":
      return sym.amount;
    case "colored":
    case "colorless":
    case "phyrexian":
    case "snow":
      return 1;
    case "hybrid":
      return 1;
    case "hybridGeneric":
      return sym.amount;
    case "X":
      return 0;
  }
}

/**
 * Parse a Scryfall mana cost string into a ManaCost object.
 *
 * @param manaCostString - e.g. "{2}{W}{U}", "{X}{R}{R}", "" or null
 * @returns ManaCost with symbols array and totalCMC
 */
export function parseManaCost(manaCostString: string | null | undefined): ManaCost {
  if (!manaCostString) {
    return { symbols: [], totalCMC: 0 };
  }

  const symbols: ManaSymbol[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  SYMBOL_REGEX.lastIndex = 0;
  while ((match = SYMBOL_REGEX.exec(manaCostString)) !== null) {
    symbols.push(parseSymbolBody(match[1]));
  }

  const totalCMC = symbols.reduce((sum, sym) => sum + symbolCMC(sym), 0);

  return { symbols, totalCMC };
}
