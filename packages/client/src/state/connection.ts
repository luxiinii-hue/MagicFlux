import type {
  ClientGameState, PlayerAction, GameEvent, DecklistEntry,
  PromptMessage,
} from '@magic-flux/types';

export type PromptData = PromptMessage['payload'];

export interface GameConnection {
  connect(): void;
  disconnect(): void;
  sendAction(gameId: string, action: PlayerAction): void;
  sendPromptResponse?(gameId: string, promptId: string, selection: unknown): void;
  onStateUpdate(cb: (state: ClientGameState) => void): void;
  onLegalActions(cb: (actions: readonly PlayerAction[], prompt?: string, targetRequirements?: Record<string, unknown>) => void): void;
  onEvent(cb: (event: GameEvent, message: string) => void): void;
  onPrompt(cb: (prompt: PromptData) => void): void;
  onError(cb: (code: string, message: string) => void): void;
  onGameOver?(cb: (winners: readonly string[], losers: readonly string[], reason: string) => void): void;
}

export interface LobbyConnection {
  createGame(format: string, maxPlayers: number, decklist: readonly DecklistEntry[]): void;
  joinGame(gameId: string, decklist: readonly DecklistEntry[]): void;
  leaveGame(gameId: string): void;
  listGames(): void;
  onGameCreated(cb: (gameId: string, format: string) => void): void;
  onGameStarting(cb: (gameId: string, players: readonly { id: string; name: string }[]) => void): void;
  onGameList(cb: (games: readonly { gameId: string; format: string; playerCount: number; maxPlayers: number }[]) => void): void;
  onDeckValidation(cb: (valid: boolean, errors: readonly { message: string }[]) => void): void;
}
