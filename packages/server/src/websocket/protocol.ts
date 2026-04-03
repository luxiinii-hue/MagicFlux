/**
 * WebSocket message protocol types.
 *
 * Defines the typed message format for server↔client communication.
 * All messages are JSON with { type, payload } structure.
 */

import type {
  ClientGameState,
  PlayerAction,
  GameEvent,
  DecklistEntry,
} from "@magic-flux/types";

// ---------------------------------------------------------------------------
// Server → Client messages
// ---------------------------------------------------------------------------

export interface StateUpdateMessage {
  readonly type: "game:stateUpdate";
  readonly payload: {
    readonly gameState: ClientGameState;
  };
}

export interface LegalActionsMessage {
  readonly type: "game:legalActions";
  readonly payload: {
    readonly actions: readonly PlayerAction[];
    readonly prompt?: string;
  };
}

export interface PromptMessage {
  readonly type: "game:prompt";
  readonly payload: {
    readonly promptId: string;
    readonly promptType:
      | "chooseTargets"
      | "assignDamage"
      | "chooseMode"
      | "discardToHandSize"
      | "orderTriggers"
      | "choosePermanent"
      | "choosePlayer";
    readonly description: string;
    readonly options: unknown;
    readonly minSelections: number;
    readonly maxSelections: number;
  };
}

export interface GameEventMessage {
  readonly type: "game:event";
  readonly payload: {
    readonly event: GameEvent;
    readonly logMessage: string;
  };
}

export interface GameErrorMessage {
  readonly type: "game:error";
  readonly payload: {
    readonly code: string;
    readonly message: string;
  };
}

export interface GameOverMessage {
  readonly type: "game:over";
  readonly payload: {
    readonly winners: readonly string[];
    readonly losers: readonly string[];
    readonly reason: string;
  };
}

export interface GameCreatedMessage {
  readonly type: "lobby:gameCreated";
  readonly payload: {
    readonly gameId: string;
    readonly format: string;
    readonly creatorName: string;
    readonly playerCount: number;
    readonly maxPlayers: number;
  };
}

export interface GameStartingMessage {
  readonly type: "lobby:gameStarting";
  readonly payload: {
    readonly gameId: string;
    readonly players: readonly { readonly id: string; readonly name: string }[];
  };
}

export interface LobbyGameListMessage {
  readonly type: "lobby:gameList";
  readonly payload: {
    readonly games: readonly {
      readonly gameId: string;
      readonly format: string;
      readonly creatorName: string;
      readonly playerCount: number;
      readonly maxPlayers: number;
    }[];
  };
}

export type ServerMessage =
  | StateUpdateMessage
  | LegalActionsMessage
  | PromptMessage
  | GameEventMessage
  | GameErrorMessage
  | GameOverMessage
  | GameCreatedMessage
  | GameStartingMessage
  | LobbyGameListMessage;

// ---------------------------------------------------------------------------
// Client → Server messages
// ---------------------------------------------------------------------------

export interface GameActionMessage {
  readonly type: "game:action";
  readonly payload: {
    readonly gameId: string;
    readonly action: PlayerAction;
  };
}

export interface PromptResponseMessage {
  readonly type: "game:promptResponse";
  readonly payload: {
    readonly gameId: string;
    readonly promptId: string;
    readonly selection: unknown;
  };
}

export interface CreateGameMessage {
  readonly type: "lobby:createGame";
  readonly payload: {
    readonly format: string;
    readonly maxPlayers: number;
    readonly decklist: readonly DecklistEntry[];
  };
}

export interface JoinGameMessage {
  readonly type: "lobby:joinGame";
  readonly payload: {
    readonly gameId: string;
    readonly decklist: readonly DecklistEntry[];
  };
}

export interface LeaveGameMessage {
  readonly type: "lobby:leaveGame";
  readonly payload: {
    readonly gameId: string;
  };
}

export interface ListGamesMessage {
  readonly type: "lobby:listGames";
  readonly payload: Record<string, never>;
}

export type ClientMessage =
  | GameActionMessage
  | PromptResponseMessage
  | CreateGameMessage
  | JoinGameMessage
  | LeaveGameMessage
  | ListGamesMessage;
