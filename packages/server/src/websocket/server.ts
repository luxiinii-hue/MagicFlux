/**
 * WebSocket server setup using `ws`.
 *
 * Creates an HTTP server and attaches a WebSocket server to it.
 * Manages client connections and routes messages through handlers.
 */

import { createServer, type Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "./protocol.js";
import { handleClientMessage, type ConnectedClient } from "./handlers.js";
import { Lobby } from "../lobby/lobby.js";

let clientIdCounter = 0;

export interface MagicFluxServerOptions {
  port?: number;
  lobby?: Lobby;
}

export interface MagicFluxServer {
  readonly httpServer: HttpServer;
  readonly wss: WebSocketServer;
  readonly lobby: Lobby;
  start(port?: number): Promise<void>;
  stop(): Promise<void>;
}

export function createMagicFluxServer(
  options: MagicFluxServerOptions = {}
): MagicFluxServer {
  const lobby = options.lobby ?? new Lobby();
  const httpServer = createServer();
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
