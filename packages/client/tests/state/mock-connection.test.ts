import { describe, it, expect, beforeEach } from 'vitest';
import { MockConnection } from '../../src/state/mock-connection';
import type { ClientGameState, PlayerAction, GameEvent } from '@magic-flux/types';

describe('MockConnection', () => {
  let conn: MockConnection;
  let stateUpdates: ClientGameState[];
  let events: { event: GameEvent; message: string }[];
  let legalActionsList: PlayerAction[][];

  beforeEach(() => {
    conn = new MockConnection();
    stateUpdates = [];
    events = [];
    legalActionsList = [];
    conn.onStateUpdate((s) => stateUpdates.push(s));
    conn.onEvent((e, m) => events.push({ event: e, message: m }));
    conn.onLegalActions((a) => legalActionsList.push(a));
    conn.onPrompt(() => {});
    conn.onError(() => {});
    conn.connect();
  });

  function latestState(): ClientGameState {
    return stateUpdates[stateUpdates.length - 1];
  }

  function latestActions(): PlayerAction[] {
    return legalActionsList[legalActionsList.length - 1];
  }

  it('should emit initial state on connect', () => {
    expect(stateUpdates.length).toBeGreaterThanOrEqual(1);
    const state = latestState();
    expect(state.players).toHaveLength(2);
    expect(state.turnNumber).toBe(1);
    expect(state.activePlayerId).toBe('player-1');
    expect(state.priorityPlayerId).toBe('player-1');
  });

  it('should provide legal actions including passPriority', () => {
    const actions = latestActions();
    expect(actions.some((a) => a.type === 'passPriority')).toBe(true);
  });

  it('should provide playLand actions for lands in hand', () => {
    const actions = latestActions();
    const playLands = actions.filter((a) => a.type === 'playLand');
    expect(playLands.length).toBeGreaterThanOrEqual(1);
  });

  it('should provide mana ability actions for untapped lands', () => {
    const actions = latestActions();
    const abilities = actions.filter((a) => a.type === 'activateAbility');
    expect(abilities.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle playLand action', () => {
    const actions = latestActions();
    const playLand = actions.find((a) => a.type === 'playLand');
    if (!playLand || playLand.type !== 'playLand') return;

    conn.sendAction('mock-game', playLand);

    const state = latestState();
    const bf = state.zones['battlefield'];
    expect(bf && 'cardInstanceIds' in bf && bf.cardInstanceIds?.includes(playLand.cardInstanceId)).toBe(true);

    // Should not be able to play another land this turn
    const newActions = latestActions();
    expect(newActions.filter((a) => a.type === 'playLand')).toHaveLength(0);
  });

  it('should handle activateAbility (tap land for mana)', () => {
    const actions = latestActions();
    const ability = actions.find((a) => a.type === 'activateAbility');
    if (!ability || ability.type !== 'activateAbility') return;

    conn.sendAction('mock-game', ability);

    const state = latestState();
    const p1 = state.players.find((p) => p.id === 'player-1');
    const totalMana = p1 ? p1.manaPool.W + p1.manaPool.U + p1.manaPool.B + p1.manaPool.R + p1.manaPool.G + p1.manaPool.C : 0;
    expect(totalMana).toBe(1);

    // The tapped land should no longer show up in abilities
    const card = state.cardInstances[ability.cardInstanceId];
    expect(card?.tapped).toBe(true);
  });

  it('should handle passPriority (advance phase)', () => {
    const initialPhase = latestState().turnState.phase;
    conn.sendAction('mock-game', { type: 'passPriority' });

    const state = latestState();
    // Phase should have advanced (or turn changed)
    expect(
      state.turnState.phase !== initialPhase ||
      state.turnNumber > 1
    ).toBe(true);
  });

  it('should start both players at 20 life', () => {
    const state = latestState();
    expect(state.players[0].life).toBe(20);
    expect(state.players[1].life).toBe(20);
  });
});
