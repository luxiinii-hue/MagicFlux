import { create } from 'zustand';
import type { ClientGameState, PlayerAction, GameEvent, TargetRequirement } from '@magic-flux/types';
import type { PromptData, GameConnection } from './connection';
import type { InteractionState, InteractionAction } from '../interaction/types';
import type { GameSettings } from './settings';
import { IDLE_STATE } from '../interaction/types';
import { interactionReducer } from '../interaction/state-machine';
import { loadSettings, saveSettings } from './settings';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'mock';

interface LogEntry {
  readonly event: GameEvent;
  readonly message: string;
}

interface GameStore {
  // Server state
  gameState: ClientGameState | null;
  legalActions: PlayerAction[];
  targetRequirements: Record<string, readonly TargetRequirement[]>;
  gameLog: LogEntry[];
  prompt: PromptData | null;
  connectionStatus: ConnectionStatus;
  viewingPlayerId: string | null;

  // Interaction state
  interaction: InteractionState;

  // Settings
  settings: GameSettings;

  // Connection ref
  connection: GameConnection | null;

  // Server state actions
  setGameState: (state: ClientGameState) => void;
  setLegalActions: (actions: PlayerAction[], targetRequirements?: Record<string, readonly TargetRequirement[]>) => void;
  addLogEntry: (event: GameEvent, message: string) => void;
  setPrompt: (prompt: PromptData | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setViewingPlayerId: (playerId: string) => void;
  setConnection: (conn: GameConnection) => void;

  // Interaction actions
  dispatchInteraction: (action: InteractionAction) => void;

  // Game actions
  sendAction: (action: PlayerAction) => void;
  sendPromptResponse: (promptId: string, selection: unknown) => void;

  // Settings actions
  updateSettings: (settings: GameSettings) => void;

  // Legacy compatibility (used by existing component tests)
  selectedCards: string[];
  interactionMode: string;
  selectCard: (instanceId: string) => void;
  deselectCard: (instanceId: string) => void;
  clearSelection: () => void;
  setInteractionMode: (mode: string) => void;
}

export const useGameStore = create<GameStore>()((set, get) => ({
  gameState: null,
  legalActions: [],
  targetRequirements: {},
  gameLog: [],
  prompt: null,
  connectionStatus: 'disconnected',
  viewingPlayerId: null,
  interaction: IDLE_STATE,
  settings: loadSettings(),
  connection: null,

  // Legacy defaults
  selectedCards: [],
  interactionMode: 'idle',

  setGameState: (gameState) => set({ gameState }),
  setLegalActions: (legalActions, targetRequirements) => set({
    legalActions,
    targetRequirements: targetRequirements ?? {},
  }),
  addLogEntry: (event, message) =>
    set((s) => ({ gameLog: [...s.gameLog, { event, message }] })),
  setPrompt: (prompt) => set({ prompt }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setViewingPlayerId: (viewingPlayerId) => set({ viewingPlayerId }),
  setConnection: (connection) => set({ connection }),

  dispatchInteraction: (action) =>
    set((s) => {
      const next = interactionReducer(s.interaction, action);
      return { interaction: next, interactionMode: next.mode };
    }),

  sendAction: (action) => {
    const { connection, gameState } = get();
    if (connection && gameState) {
      connection.sendAction(gameState.gameId, action);
    }
  },

  sendPromptResponse: (promptId, selection) => {
    const { connection, gameState } = get();
    if (connection?.sendPromptResponse && gameState) {
      connection.sendPromptResponse(gameState.gameId, promptId, selection);
      set({ prompt: null });
    }
  },

  updateSettings: (settings) => {
    saveSettings(settings);
    set({ settings });
  },

  // Legacy methods for backward compat with existing tests
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
  clearSelection: () => set({ selectedCards: [], interaction: IDLE_STATE, interactionMode: 'idle' }),
  setInteractionMode: (interactionMode) => set({ interactionMode }),
}));
