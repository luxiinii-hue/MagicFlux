/**
 * WebSocket server setup using `ws`.
 *
 * Creates an HTTP server and attaches a WebSocket server to it.
 * Manages client connections and routes messages through handlers.
 */

import { createServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { existsSync } from "node:fs";
import type { ClientMessage, ServerMessage } from "./protocol.js";
import { handleClientMessage, type ConnectedClient } from "./handlers.js";
import { Lobby } from "../lobby/lobby.js";

let clientIdCounter = 0;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
};

export interface MagicFluxServerOptions {
  port?: number;
  lobby?: Lobby;
  /** Directory to serve static files from (built client). Null to disable. */
  staticDir?: string | null;
}

export interface MagicFluxServer {
  readonly httpServer: HttpServer;
  readonly wss: WebSocketServer;
  readonly lobby: Lobby;
  start(port?: number): Promise<void>;
  stop(): Promise<void>;
}

async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  staticDir: string,
): Promise<void> {
  const url = req.url ?? "/";
  const pathname = url.split("?")[0];
  let filePath = join(staticDir, pathname === "/" ? "index.html" : pathname);

  // SPA fallback: if file doesn't exist and it's not an asset, serve index.html
  if (!existsSync(filePath)) {
    const ext = extname(filePath);
    if (!ext || ext === ".html") {
      filePath = join(staticDir, "index.html");
    } else {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
  }

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch {
    res.writeHead(500);
    res.end("Internal server error");
  }
}

export function createMagicFluxServer(
  options: MagicFluxServerOptions = {}
): MagicFluxServer {
  const lobby = options.lobby ?? new Lobby();
  const staticDir = options.staticDir ?? null;

  const httpServer = createServer((req, res) => {
    if (staticDir) {
      serveStatic(req, res, staticDir);
    } else {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Magic Flux server — connect via WebSocket");
    }
  });

  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws: WebSocket) => {
    const clientId = `client_${++clientIdCounter}`;

    const client: ConnectedClient = {
      clientId,
      playerName: clientId, // Default; could be set via an auth message
      send(message: ServerMessage) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
        }
      },
    };

    console.log(
      JSON.stringify({ event: "client_connected", clientId, timestamp: new Date().toISOString() })
    );

    ws.on("message", (data: Buffer | string) => {
      try {
        const raw = typeof data === "string" ? data : data.toString("utf-8");
        const message = JSON.parse(raw) as ClientMessage;
        handleClientMessage(client, message, lobby);
      } catch (err) {
        client.send({
          type: "game:error",
          payload: {
            code: "PARSE_ERROR",
            message: "Failed to parse message as JSON",
          },
        });
      }
    });

    ws.on("close", () => {
      console.log(
        JSON.stringify({ event: "client_disconnected", clientId, timestamp: new Date().toISOString() })
      );
    });

    ws.on("error", (err: Error) => {
      console.error(
        JSON.stringify({ event: "ws_error", clientId, error: err.message, timestamp: new Date().toISOString() })
      );
    });
  });

  return {
    httpServer,
    wss,
    lobby,
    start(port = options.port ?? 3001): Promise<void> {
      return new Promise((resolve) => {
        httpServer.listen(port, () => {
          console.log(
            JSON.stringify({ event: "server_started", port, timestamp: new Date().toISOString() })
          );
          resolve();
        });
      });
    },
    stop(): Promise<void> {
      return new Promise((resolve, reject) => {
        // Close all WebSocket connections
        for (const ws of wss.clients) {
          ws.close();
        }
        wss.close(() => {
          httpServer.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
    },
  };
}
