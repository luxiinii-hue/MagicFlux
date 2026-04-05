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
import type { GameFormat, DecklistEntry, Decklist, DeckValidationResult } from "@magic-flux/types";
import type { Lobby } from "../lobby/lobby.js";
import type { PlayerConnection } from "../game-session/session.js";
import { validateDecklist } from "@magic-flux/cards";

const VALID_FORMATS: readonly string[] = ["standard", "modern", "commander"];

/**
 * Wraps a flat DecklistEntry[] into a Decklist for validation.
 * Treats the entire list as mainboard (client-side parsing of
 * sideboard/commander sections is a future enhancement).
 */
function entriesToDecklist(
  entries: readonly DecklistEntry[],
  format: string
): Decklist {
  return {
    name: "",
    format,
    mainboard: entries,
    sideboard: [],
    commander: null,
    companion: null,
  };
}

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
      handlePromptResponse(client, message.payload, lobby);
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
  // Update player name if provided
  if ((payload as any).playerName) {
    client.playerName = (payload as any).playerName;
  }

  if (!VALID_FORMATS.includes(payload.format)) {
    client.send({
      type: "game:error",
      payload: { code: "INVALID_FORMAT", message: `Invalid format: ${payload.format}` },
    });
    return;
  }

  // Validate decklist
  const decklist = entriesToDecklist(payload.decklist, payload.format);
  const validation = validateDecklist(decklist, payload.format);
  client.send({
    type: "lobby:deckValidation",
    payload: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    },
  });
  if (!validation.valid) {
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
  // Update player name if provided
  if ((payload as any).playerName) {
    client.playerName = (payload as any).playerName;
  }

  // Look up the game to get its format for validation
  const existingSession = lobby.getSession(payload.gameId);
  if (!existingSession) {
    client.send({
      type: "game:error",
      payload: { code: "GAME_NOT_FOUND", message: `Game ${payload.gameId} not found` },
    });
    return;
  }

  // Validate decklist against the game's format
  const decklist = entriesToDecklist(payload.decklist, existingSession.format);
  const validation = validateDecklist(decklist, existingSession.format);
  client.send({
    type: "lobby:deckValidation",
    payload: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    },
  });
  if (!validation.valid) {
    return;
  }

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

  // If game is ready to start (enough players), auto-start
  if (session.canStart()) {
    const allPlayers = session.getPlayerIds().map((id) => ({
      id,
      name: id,
    }));

    // Notify ALL players BEFORE starting — clients wire game callbacks
    // on this message, so state updates from start() will reach them.
    // Send individually with "you first" ordering so clients can identify
    // their own player via players[0].
    for (const pid of session.getPlayerIds()) {
      const reordered = [
        allPlayers.find((p) => p.id === pid)!,
        ...allPlayers.filter((p) => p.id !== pid),
      ];
      session.sendToPlayer(pid, {
        type: "lobby:gameStarting",
        payload: { gameId: session.gameId, players: reordered },
      });
    }

    // Now start — state updates will reach already-wired clients
    try {
      session.start();
    } catch (err) {
      console.error(JSON.stringify({
        event: "session_start_error",
        gameId: session.gameId,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString(),
      }));
      // Notify players of the failure
      session.broadcastToAll({
        type: "game:error",
        payload: { code: "START_FAILED", message: "Failed to start game — engine error" },
      });
    }
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

function handlePromptResponse(
  client: ConnectedClient,
  payload: { gameId: string; promptId: string; selection: unknown },
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

  // Route mulligan prompts (server-managed)
  if (payload.promptId.startsWith("mulligan_")) {
    const decision = payload.selection as "keep" | "mulligan";
    session.handleMulliganResponse(client.clientId, decision);
  } else if (payload.promptId.startsWith("bottom_")) {
    const cardIds = payload.selection as string[];
    session.handlePutOnBottom(client.clientId, cardIds);
  } else {
    // Engine-managed prompts — forward as makeChoice action
    session.handleAction(client.clientId, {
      type: "makeChoice",
      choiceId: payload.promptId,
      selection: payload.selection,
    });
  }
}
