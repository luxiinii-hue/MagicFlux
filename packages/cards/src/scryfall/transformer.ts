/**
 * Transforms raw Scryfall card objects into our CardData type.
 *
 * This is a pure mapping function — no I/O, no side effects.
 * Runs once during card database loading for each card in the bulk data.
 */

import type {
  CardData,
  CardFace,
  CardLayout,
  FormatLegality,
  ManaColor,
  Supertype,
  CardTypeName,
} from "@magic-flux/types";
import type { ScryfallCard, ScryfallCardFace } from "./types.js";
import { parseManaCost } from "../parser/cost-parser.js";
import { parseTypeLine } from "../parser/type-line-parser.js";

const VALID_COLORS = new Set(["W", "U", "B", "R", "G", "C"]);
const VALID_LEGALITIES = new Set(["legal", "not_legal", "banned", "restricted"]);
const VALID_LAYOUTS = new Set([
  "normal", "transform", "modal_dfc", "split", "adventure", "flip",
  "meld", "saga", "class", "prototype", "token", "planar", "scheme",
  "vanguard", "emblem", "augment", "host", "leveler", "case", "mutate",
]);

function mapColors(colors: readonly string[] | undefined): ManaColor[] {
  if (!colors) return [];
  return colors.filter((c) => VALID_COLORS.has(c)) as ManaColor[];
}

function mapLegality(value: string): FormatLegality {
  if (VALID_LEGALITIES.has(value)) return value as FormatLegality;
  return "not_legal";
}

function mapLegalities(raw: Readonly<Record<string, string>>): Record<string, FormatLegality> {
  const result: Record<string, FormatLegality> = {};
  for (const [format, status] of Object.entries(raw)) {
    result[format] = mapLegality(status);
  }
  return result;
}

function mapLayout(raw: string): CardLayout {
  if (VALID_LAYOUTS.has(raw)) return raw as CardLayout;
  return "normal";
}

function mapCardFace(face: ScryfallCardFace): CardFace {
  return {
    name: face.name,
    manaCost: face.mana_cost ?? null,
    typeLine: face.type_line ?? "",
    oracleText: face.oracle_text ?? "",
    power: face.power ?? null,
    toughness: face.toughness ?? null,
    loyalty: face.loyalty ?? null,
    defense: face.defense ?? null,
    colors: mapColors(face.colors),
    imageUris: face.image_uris ?? null,
  };
}

/**
 * Transform a single Scryfall card object into our CardData format.
 *
 * For multi-faced cards (transform, modal_dfc, split, adventure, flip),
 * the top-level fields represent the "primary" face. Individual face data
 * is in the `faces` array.
 */
export function transformScryfallCard(raw: ScryfallCard): CardData {
  const typeLine = raw.type_line ?? "";
  const parsed = parseTypeLine(typeLine);
  const manaCostStr = raw.mana_cost ?? null;
  const isToken = raw.layout === "token" || raw.layout === "emblem";

  return {
    id: raw.id,
    oracleId: raw.oracle_id,
    name: raw.name,
    manaCost: manaCostStr,
    parsedManaCost: parseManaCost(manaCostStr),
    cmc: raw.cmc,
    typeLine,
    supertypes: parsed.supertypes as readonly Supertype[],
    cardTypes: parsed.cardTypes as readonly CardTypeName[],
    subtypes: parsed.subtypes,
    oracleText: raw.oracle_text ?? "",
    power: raw.power ?? null,
    toughness: raw.toughness ?? null,
    loyalty: raw.loyalty ?? null,
    defense: raw.defense ?? null,
    colors: mapColors(raw.colors),
    colorIdentity: mapColors(raw.color_identity),
    keywords: [...raw.keywords],
    layout: mapLayout(raw.layout),
    faces: raw.card_faces ? raw.card_faces.map(mapCardFace) : null,
    imageUris: raw.image_uris ?? null,
    legalities: mapLegalities(raw.legalities),
    isToken,
    producedMana: raw.produced_mana ? mapColors(raw.produced_mana) : null,
  };
}
