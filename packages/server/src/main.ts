/**
 * Server entry point — starts the Magic Flux WebSocket server.
 *
 * In production, also serves the built client as static files.
 * In development, the Vite dev server handles the client.
 *
 * Usage:
 *   npx tsx packages/server/src/main.ts
 *   PORT=8080 npx tsx packages/server/src/main.ts
 */

import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { createMagicFluxServer } from "./websocket/server.js";

const port = parseInt(process.env["PORT"] ?? "3001", 10);

// Auto-detect built client: check ../client/dist/ relative to this file
const clientDistDir = resolve(import.meta.dirname ?? ".", "../../client/dist");
const staticDir = existsSync(clientDistDir) ? clientDistDir : null;

if (staticDir) {
  console.log(`Serving client from ${staticDir}`);
} else {
  console.log("No client build found — WebSocket-only mode (use Vite dev server for client)");
}

const server = createMagicFluxServer({ port, staticDir });

server.start().then(() => {
  console.log(`Magic Flux server listening on ${staticDir ? "http" : "ws"}://localhost:${port}`);
  console.log("Press Ctrl+C to stop.");
});

process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  await server.stop();
  process.exit(0);
});
