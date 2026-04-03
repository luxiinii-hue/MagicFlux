import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../../src/state/game-store';
import { createMockGameState, createMockLegalActions } from '../../src/mocks/mock-state';

describe('useGameStore', () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState());
  });

  it('should start with null game state', () => {
    const state = useGameStore.getState();
    expect(state.gameState).toBeNull();
    expect(state.connectionStatus).toBe('disconnected');
    expect(state.legalActions).toEqual([]);
    expect(state.gameLog).toEqual([]);
    expect(state.selectedCards).toEqual([]);
    expect(state.interactionMode).toBe('idle');
  });

  it('should set game state', () => {
    const mockState = createMockGameState();
    useGameStore.getState().setGameState(mockState);
    expect(useGameStore.getState().gameState).toBe(mockState);
  });

  it('should set legal actions', () => {
    const actions = createMockLegalActions();
    useGameStore.getState().setLegalActions(actions);
    expect(useGameStore.getState().legalActions).toBe(actions);
  });

  it('should add log entries', () => {
    const event = { type: 'turnBegan' as const, turnNumber: 1, activePlayerId: 'p1', timestamp: 1 };
    useGameStore.getState().addLogEntry(event, 'Turn 1 begins');
    const log = useGameStore.getState().gameLog;
    expect(log).toHaveLength(1);
    expect(log[0].message).toBe('Turn 1 begins');
  });

  it('should select and deselect cards', () => {
    useGameStore.getState().selectCard('card-1');
    useGameStore.getState().selectCard('card-2');
    expect(useGameStore.getState().selectedCards).toEqual(['card-1', 'card-2']);

    useGameStore.getState().deselectCard('card-1');
    expect(useGameStore.getState().selectedCards).toEqual(['card-2']);
  });

  it('should not add duplicate selections', () => {
    useGameStore.getState().selectCard('card-1');
    useGameStore.getState().selectCard('card-1');
    expect(useGameStore.getState().selectedCards).toEqual(['card-1']);
  });

  it('should clear selection', () => {
    useGameStore.getState().selectCard('card-1');
    useGameStore.getState().clearSelection();
    expect(useGameStore.getState().selectedCards).toEqual([]);
    expect(useGameStore.getState().interactionMode).toBe('idle');
  });
});
