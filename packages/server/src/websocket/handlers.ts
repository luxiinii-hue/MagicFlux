/**
 * WebSocket message handlers.
 *
 * Routes incoming client messages to the appropriate lobby or session
 * methods. Each handler validates the message structure and dispatches.
 */

import type {
  ClientMessage,
  ServerMessage,
  CreateGameMessage,
  JoinGameMessage,
  LeaveGameMessage,
  GameActionMessage,
} from "./protocol.js";
import type { GameFormat, DecklistEntry } from "@magic-flux/types";
import type { Lobby } from "../lobby/lobby.js";
import type { PlayerConnection } from "../game-session/session.js";

const VALID_FORMATS: readonly string[] = ["standard", "modern", "commander"];

export interface ConnectedClient {
  readonly clientId: string;
  playerName: string;
  send(message: ServerMessage): void;
}

export function handleClientMessage(
  client: ConnectedClient,
  message: ClientMessage,
  lobby: Lobby
): void {
  switch (message.type) {
    case "lobby:createGame":
      handleCreateGame(client, message.payload, lobby);
      break;
    case "lobby:joinGame":
      handleJoinGame(client, message.payload, lobby);
      break;
    case "lobby:leaveGame":
      handleLeaveGame(client, message.payload, lobby);
      break;
    case "lobby:listGames":
      handleListGames(client, lobby);
      break;
    case "game:action":
      handleGameAction(client, message.payload, lobby);
      break;
    case "game:promptResponse":
      // TODO: implement prompt responses
      client.send({
        type: "game:error",
        payload: { code: "NOT_IMPLEMENTED", message: "Prompt responses not yet implemented" },
      });
      break;
    default:
      client.send({
        type: "game:error",
        payload: { code: "UNKNOWN_MESSAGE", message: `Unknown message type: ${(message as { type: string }).type}` },
      });
  }
}

function handleCreateGame(
  client: ConnectedClient,
  payload: CreateGameMessage["payload"],
  lobby: Lobby
): void {
  if (!VALID_FORMATS.includes(payload.format)) {
    client.send({
      type: "game:error",
      payload: { code: "INVALID_FORMAT", message: `Invalid format: ${payload.format}` },
    });
    return;
  }

  const connection: PlayerConnection = {
    playerId: client.clientId,
    playerName: client.playerName,
    send: (msg) => client.send(msg),
  };

  const session = lobby.createGame(
    payload.format as GameFormat,
    payload.maxPlayers,
    client.clientId,
    client.playerName,
    payload.decklist,
    connection
  );

  client.send({
    type: "lobby:gameCreated",
    payload: {
      gameId: session.gameId,
      format: session.format,
      creatorName: client.playerName,
      playerCount: session.getPlayerCount(),
      maxPlayers: session.maxPlayers,
    },
  });
}

function handleJoinGame(
  client: ConnectedClient,
  payload: JoinGameMessage["payload"],
  lobby: Lobby
): void {
  const connection: PlayerConnection = {
    playerId: client.clientId,
    playerName: client.playerName,
    send: (msg) => client.send(msg),
  };

  const session = lobby.joinGame(
    payload.gameId,
    client.clientId,
    client.playerName,
    payload.decklist,
    connection
  );

  if (!session) {
    client.send({
      type: "game:error",
      payload: { code: "JOIN_FAILED", message: `Cannot join game ${payload.gameId}` },
    });
    return;
  }

  // Notify all players
  const players = session.getPlayerIds().map((id) => ({
    id,
    name: id, // Simplified — would use actual names
  }));

  // If game is ready to start (enough players), auto-start
  if (session.canStart()) {
    session.start();

    // Notify players that game is starting
    // The session.start() call triggers state broadcast internally
    client.send({
      type: "lobby:gameStarting",
      payload: { gameId: session.gameId, players },
    });
  }
}

function handleLeaveGame(
  client: ConnectedClient,
  payload: { gameId: string },
  lobby: Lobby
): void {
  lobby.leaveGame(payload.gameId, client.clientId);
}

function handleListGames(client: ConnectedClient, lobby: Lobby): void {
  const games = lobby.listGames();
  client.send({
    type: "lobby:gameList",
    payload: { games },
  });
}

function handleGameAction(
  client: ConnectedClient,
  payload: GameActionMessage["payload"],
  lobby: Lobby
): void {
  const session = lobby.getSession(payload.gameId);
  if (!session) {
    client.send({
      type: "game:error",
      payload: { code: "GAME_NOT_FOUND", message: `Game ${payload.gameId} not found` },
    });
    return;
  }

  session.handleAction(client.clientId, payload.action);
}
