/**
 * Scryfall bulk data loader.
 *
 * Downloads the Oracle Cards JSON, caches it locally in data/, and
 * transforms all cards into CardData objects for the in-memory registry.
 */

import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { CardData } from "@magic-flux/types";
import { getOracleCardsBulkEntry, downloadBulkData } from "./client.js";
import { transformScryfallCard } from "./transformer.js";
import type { ScryfallCard } from "./types.js";

/** Metadata about the local cache, stored alongside the data file. */
interface CacheMeta {
  readonly updatedAt: string;
  readonly downloadedAt: string;
  readonly cardCount: number;
}

/**
 * Resolve the data directory path.
 *
 * When running from `packages/cards/`, the data dir is at the monorepo
 * root: `../../data/`. We use a function so tests can override it.
 */
function getDataDir(): string {
  // Default: relative to the cards package
  return join(dirname(new URL(import.meta.url).pathname), "..", "..", "..", "..", "data");
}

function getDataFilePath(): string {
  return join(getDataDir(), "oracle-cards.json");
}

function getMetaFilePath(): string {
  return join(getDataDir(), "cache-meta.json");
}

/** Read cache metadata, or null if no cache exists. */
async function readCacheMeta(): Promise<CacheMeta | null> {
  try {
    const raw = await readFile(getMetaFilePath(), "utf-8");
    return JSON.parse(raw) as CacheMeta;
  } catch {
    return null;
  }
}

/** Check if the local data file exists. */
async function dataFileExists(): Promise<boolean> {
  try {
    await stat(getDataFilePath());
    return true;
  } catch {
    return false;
  }
}

/**
 * Load all card data from Scryfall bulk data.
 *
 * 1. Checks Scryfall for the latest oracle_cards metadata
 * 2. If local cache is fresh, loads from disk
 * 3. Otherwise downloads fresh data
 * 4. Parses JSON and transforms each card into CardData
 *
 * @returns Array of all CardData objects
 */
export async function loadBulkCardData(): Promise<CardData[]> {
  const bulkEntry = await getOracleCardsBulkEntry();
  const meta = await readCacheMeta();
  const hasLocalFile = await dataFileExists();

  const isFresh = meta !== null
    && hasLocalFile
    && meta.updatedAt === bulkEntry.updated_at;

  if (!isFresh) {
    console.log(
      `Downloading Scryfall Oracle Cards data (${(bulkEntry.size / 1_000_000).toFixed(0)} MB)...`,
    );

    await mkdir(getDataDir(), { recursive: true });

    await downloadBulkData(bulkEntry.download_uri, getDataFilePath(), (bytes) => {
      if (bytes % 10_000_000 < 100_000) {
        console.log(`  ${(bytes / 1_000_000).toFixed(0)} MB downloaded...`);
      }
    });

    const newMeta: CacheMeta = {
      updatedAt: bulkEntry.updated_at,
      downloadedAt: new Date().toISOString(),
      cardCount: 0, // updated after parse
    };
    await writeFile(getMetaFilePath(), JSON.stringify(newMeta, null, 2));

    console.log("Download complete. Parsing...");
  } else {
    console.log("Using cached Scryfall data.");
  }

  // Parse the JSON
  const rawJson = await readFile(getDataFilePath(), "utf-8");
  const rawCards = JSON.parse(rawJson) as ScryfallCard[];

  // Transform to CardData
  const cards = rawCards.map(transformScryfallCard);

  // Update meta with actual card count
  if (!isFresh) {
    const updatedMeta: CacheMeta = {
      updatedAt: bulkEntry.updated_at,
      downloadedAt: new Date().toISOString(),
      cardCount: cards.length,
    };
    await writeFile(getMetaFilePath(), JSON.stringify(updatedMeta, null, 2));
  }

  console.log(`Loaded ${cards.length} cards from Scryfall data.`);
  return cards;
}

/**
 * Load CardData from a local JSON file without checking Scryfall.
 * Used for offline development or when the data file is pre-cached.
 */
export async function loadBulkCardDataFromFile(filePath: string): Promise<CardData[]> {
  const rawJson = await readFile(filePath, "utf-8");
  const rawCards = JSON.parse(rawJson) as ScryfallCard[];
  return rawCards.map(transformScryfallCard);
}
