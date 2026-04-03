/**
 * Raw Scryfall API card object shape.
 *
 * This is the wire format (snake_case) as returned by the Scryfall bulk data
 * Oracle Cards JSON. We only define the fields we actually use — Scryfall
 * returns many more (prices, purchase URIs, etc.) that we discard.
 */

/** A single face of a multi-faced card in Scryfall's format. */
export interface ScryfallCardFace {
  readonly name: string;
  readonly mana_cost?: string;
  readonly type_line?: string;
  readonly oracle_text?: string;
  readonly power?: string;
  readonly toughness?: string;
  readonly loyalty?: string;
  readonly defense?: string;
  readonly colors?: readonly string[];
  readonly image_uris?: Readonly<Record<string, string>>;
}

/**
 * Scryfall card object from the Oracle Cards bulk data.
 *
 * Only the fields we map to CardData are defined. The raw JSON contains
 * many additional fields (prices, purchase_uris, artist, etc.) that we
 * ignore — they pass through JSON.parse but are never accessed.
 */
export interface ScryfallCard {
  readonly id: string;
  readonly oracle_id: string;
  readonly name: string;
  readonly lang: string;
  readonly layout: string;
  readonly mana_cost?: string;
  readonly cmc: number;
  readonly type_line: string;
  readonly oracle_text?: string;
  readonly power?: string;
  readonly toughness?: string;
  readonly loyalty?: string;
  readonly defense?: string;
  readonly colors?: readonly string[];
  readonly color_identity: readonly string[];
  readonly keywords: readonly string[];
  readonly image_uris?: Readonly<Record<string, string>>;
  readonly legalities: Readonly<Record<string, string>>;
  readonly produced_mana?: readonly string[];
  readonly card_faces?: readonly ScryfallCardFace[];
  readonly set: string;
  readonly set_name: string;
  readonly collector_number: string;
}

/** Metadata for a Scryfall bulk data download. */
export interface ScryfallBulkDataEntry {
  readonly id: string;
  readonly type: string;
  readonly updated_at: string;
  readonly uri: string;
  readonly name: string;
  readonly description: string;
  readonly size: number;
  readonly download_uri: string;
  readonly content_type: string;
  readonly content_encoding: string;
}

/** Response from GET /bulk-data. */
export interface ScryfallBulkDataResponse {
  readonly object: "list";
  readonly data: readonly ScryfallBulkDataEntry[];
}
