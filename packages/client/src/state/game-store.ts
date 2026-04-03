import { create } from 'zustand';
import type { ClientGameState, PlayerAction, GameEvent } from '@magic-flux/types';
import type { PromptData } from './connection';

type InteractionMode = 'idle' | 'targeting' | 'declareAttackers' | 'declareBlockers';
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'mock';

interface LogEntry {
  readonly event: GameEvent;
  readonly message: string;
}

interface GameStore {
  // Server state
  gameState: ClientGameState | null;
  legalActions: PlayerAction[];
  gameLog: LogEntry[];
  prompt: PromptData | null;
  connectionStatus: ConnectionStatus;

  // UI state
  selectedCards: string[];
  interactionMode: InteractionMode;
  viewingPlayerId: string | null;

  // Actions
  setGameState: (state: ClientGameState) => void;
  setLegalActions: (actions: PlayerAction[]) => void;
  addLogEntry: (event: GameEvent, message: string) => void;
  setPrompt: (prompt: PromptData | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  selectCard: (instanceId: string) => void;
  deselectCard: (instanceId: string) => void;
  clearSelection: () => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setViewingPlayerId: (playerId: string) => void;
}

export const useGameStore = create<GameStore>()((set) => ({
  gameState: null,
  legalActions: [],
  gameLog: [],
  prompt: null,
  connectionStatus: 'disconnected',
  selectedCards: [],
  interactionMode: 'idle',
  viewingPlayerId: null,

  setGameState: (gameState) => set({ gameState }),
  setLegalActions: (legalActions) => set({ legalActions }),
  addLogEntry: (event, message) =>
    set((s) => ({ gameLog: [...s.gameLog, { event, message }] })),
  setPrompt: (prompt) => set({ prompt }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  selectCard: (instanceId) =>
    set((s) => ({
      selectedCards: s.selectedCards.includes(instanceId)
        ? s.selectedCards
        : [...s.selectedCards, instanceId],
    })),
  deselectCard: (instanceId) =>
    set((s) => ({
      selectedCards: s.selectedCards.filter((id) => id !== instanceId),
    })),
  clearSelection: () => set({ selectedCards: [], interactionMode: 'idle' }),
  setInteractionMode: (interactionMode) => set({ interactionMode }),
  setViewingPlayerId: (viewingPlayerId) => set({ viewingPlayerId }),
}));
