/**
 * Re-exports WebSocket message protocol types from @magic-flux/types.
 *
 * These types were promoted to the shared types package so both
 * server and client can import them for type-safe integration.
 */

export type {
  // Server → Client
  StateUpdateMessage,
  LegalActionsMessage,
  PromptMessage,
  GameEventMessage,
  GameErrorMessage,
  GameOverMessage,
  GameCreatedMessage,
  GameStartingMessage,
  LobbyGameListMessage,
  DeckValidationMessage,
  ServerMessage,
  // Client → Server
  GameActionMessage,
  PromptResponseMessage,
  CreateGameMessage,
  JoinGameMessage,
  LeaveGameMessage,
  ListGamesMessage,
  ClientMessage,
} from "@magic-flux/types";
