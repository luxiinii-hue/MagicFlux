/**
 * Minimal Scryfall API client.
 *
 * Only the two endpoints needed for the bulk data pipeline:
 * 1. GET /bulk-data — metadata about available bulk downloads
 * 2. Stream download of the bulk data JSON file
 */

import { writeFile } from "node:fs/promises";
import type { ScryfallBulkDataEntry, ScryfallBulkDataResponse } from "./types.js";

const SCRYFALL_API = "https://api.scryfall.com";
const USER_AGENT = "MagicFlux/1.0";

/** Fetch bulk data metadata from Scryfall. */
export async function fetchBulkDataMetadata(): Promise<ScryfallBulkDataEntry[]> {
  const res = await fetch(`${SCRYFALL_API}/bulk-data`, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Scryfall /bulk-data returned ${res.status}: ${res.statusText}`);
  }

  const body = (await res.json()) as ScryfallBulkDataResponse;
  return [...body.data];
}

/**
 * Find the oracle_cards bulk data entry.
 * Throws if not found in the metadata response.
 */
export async function getOracleCardsBulkEntry(): Promise<ScryfallBulkDataEntry> {
  const entries = await fetchBulkDataMetadata();
  const oracle = entries.find((e) => e.type === "oracle_cards");
  if (!oracle) {
    throw new Error(
      "Scryfall bulk-data response missing oracle_cards entry. " +
      `Available types: ${entries.map((e) => e.type).join(", ")}`,
    );
  }
  return oracle;
}

/**
 * Download a bulk data file to a local path.
 *
 * Streams the response body to disk. Scryfall serves these gzip-encoded;
 * the fetch API handles decompression transparently.
 */
export async function downloadBulkData(
  downloadUri: string,
  destPath: string,
  onProgress?: (bytesReceived: number) => void,
): Promise<void> {
  const res = await fetch(downloadUri, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`Bulk data download failed: ${res.status} ${res.statusText}`);
  }

  if (!res.body) {
    throw new Error("Bulk data response has no body");
  }

  // Read full body — the Oracle Cards JSON is ~170MB uncompressed,
  // which fits in memory. For a streaming approach we'd use a JSON
  // stream parser, but the simpler path is fine for this size.
  const chunks: Uint8Array[] = [];
  let bytesReceived = 0;

  for await (const chunk of res.body) {
    const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk as ArrayBuffer);
    chunks.push(bytes);
    bytesReceived += bytes.byteLength;
    onProgress?.(bytesReceived);
  }

  const fullBuffer = Buffer.concat(chunks);
  await writeFile(destPath, fullBuffer);
}
