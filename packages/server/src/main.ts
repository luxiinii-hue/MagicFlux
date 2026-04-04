/**
 * Server entry point — starts the Magic Flux WebSocket server.
 *
 * Usage:
 *   npx tsx packages/server/src/main.ts
 *   PORT=8080 npx tsx packages/server/src/main.ts
 */

import { createMagicFluxServer } from "./websocket/server.js";

const port = parseInt(process.env["PORT"] ?? "3001", 10);

const server = createMagicFluxServer({ port });

server.start().then(() => {
  console.log(`Magic Flux server listening on ws://localhost:${port}`);
  console.log("Press Ctrl+C to stop.");
});

process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  await server.stop();
  process.exit(0);
});
