import type { ClientGameState, PlayerAction, GameEvent } from '@magic-flux/types';

export interface PromptData {
  readonly promptId: string;
  readonly promptType: string;
  readonly description: string;
  readonly options: unknown;
  readonly minSelections: number;
  readonly maxSelections: number;
}

export interface GameConnection {
  connect(): void;
  disconnect(): void;
  sendAction(gameId: string, action: PlayerAction): void;
  onStateUpdate(cb: (state: ClientGameState) => void): void;
  onLegalActions(cb: (actions: PlayerAction[], prompt?: string) => void): void;
  onEvent(cb: (event: GameEvent, message: string) => void): void;
  onPrompt(cb: (prompt: PromptData) => void): void;
  onError(cb: (code: string, message: string) => void): void;
}
