import { describe, it, expect } from 'vitest';
import { shouldAutoPass } from '../../src/interaction/auto-pass';
import type { ClientGameState, PlayerAction } from '@magic-flux/types';
import { Phase, Step } from '@magic-flux/types';

const baseState: ClientGameState = {
  gameId: 'test',
  players: [
    { id: 'p1', name: 'Alice', life: 20, poisonCounters: 0, manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, hasLost: false, hasConceded: false, commanderDamageReceived: {}, commanderId: null, commanderTax: 0, energyCounters: 0, experienceCounters: 0, landsPlayedThisTurn: 0, maxLandsPerTurn: 1, drewFromEmptyLibrary: false },
    { id: 'p2', name: 'Bob', life: 20, poisonCounters: 0, manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, hasLost: false, hasConceded: false, commanderDamageReceived: {}, commanderId: null, commanderTax: 0, energyCounters: 0, experienceCounters: 0, landsPlayedThisTurn: 0, maxLandsPerTurn: 1, drewFromEmptyLibrary: false },
  ],
  cardInstances: {},
  zones: {},
  turnState: { turnNumber: 1, activePlayerId: 'p1', phase: Phase.Beginning, step: Step.Upkeep, hasDeclaredAttackers: false, hasDeclaredBlockers: false, priorityPassedWithoutAction: [] },
  activePlayerId: 'p1',
  priorityPlayerId: 'p1',
  stack: [],
  stackItems: {},
  turnNumber: 1,
  gameOver: false,
  winners: [],
  losers: [],
  continuousEffects: [],
  combatState: null,
  format: 'standard',
};

function withPhase(phase: Phase, step: Step | null = null, activePlayer = 'p1'): ClientGameState {
  return {
    ...baseState,
    activePlayerId: activePlayer,
    turnState: { ...baseState.turnState, phase, step, activePlayerId: activePlayer },
  };
}

function withStack(items: string[]): ClientGameState {
  return { ...baseState, stack: items };
}

const passOnly: PlayerAction[] = [{ type: 'passPriority' }, { type: 'concede' }];
const withSpell: PlayerAction[] = [{ type: 'passPriority' }, { type: 'castSpell', cardInstanceId: 'c1' }];
const withLand: PlayerAction[] = [{ type: 'passPriority' }, { type: 'playLand', cardInstanceId: 'c2' }];
const withBlockers: PlayerAction[] = [{ type: 'passPriority' }, { type: 'declareBlockers', blockerAssignments: {} }];

describe('shouldAutoPass', () => {
  describe('only passPriority available', () => {
    it('should auto-pass when only passPriority and concede are available', () => {
      expect(shouldAutoPass(baseState, 'p1', passOnly)).toBe(true);
    });
  });

  describe('your turn', () => {
    it('should STOP at pre-combat main phase', () => {
      const state = withPhase(Phase.PreCombatMain);
      expect(shouldAutoPass(state, 'p1', withLand)).toBe(false);
    });

    it('should STOP at post-combat main phase', () => {
      const state = withPhase(Phase.PostCombatMain);
      expect(shouldAutoPass(state, 'p1', withSpell)).toBe(false);
    });

    it('should STOP at declare attackers step', () => {
      const state = withPhase(Phase.Combat, Step.DeclareAttackers);
      const actions: PlayerAction[] = [{ type: 'passPriority' }, { type: 'declareAttackers', attackerAssignments: {} }];
      expect(shouldAutoPass(state, 'p1', actions)).toBe(false);
    });

    it('should auto-pass during beginning phase upkeep with no plays', () => {
      const state = withPhase(Phase.Beginning, Step.Upkeep);
      expect(shouldAutoPass(state, 'p1', passOnly)).toBe(true);
    });

    it('should STOP during beginning phase upkeep with instant available', () => {
      const state = withPhase(Phase.Beginning, Step.Upkeep);
      expect(shouldAutoPass(state, 'p1', withSpell)).toBe(false);
    });

    it('should auto-pass during ending phase with no plays', () => {
      const state = withPhase(Phase.Ending, Step.EndStep);
      expect(shouldAutoPass(state, 'p1', passOnly)).toBe(true);
    });

    it('should STOP when stack has items on your turn', () => {
      const state = { ...withPhase(Phase.Beginning, Step.Upkeep), stack: ['s1'] };
      expect(shouldAutoPass(state, 'p1', withSpell)).toBe(false);
    });
  });

  describe("opponent's turn", () => {
    it('should auto-pass when no instant-speed plays available', () => {
      const state = withPhase(Phase.PreCombatMain, null, 'p2');
      expect(shouldAutoPass(state, 'p1', passOnly)).toBe(true);
    });

    it('should auto-pass when opponent has priority and you have no responses', () => {
      const state = withPhase(Phase.Beginning, Step.Draw, 'p2');
      expect(shouldAutoPass(state, 'p1', passOnly)).toBe(true);
    });

    it('should STOP at declare blockers when you have blockers', () => {
      const state = withPhase(Phase.Combat, Step.DeclareBlockers, 'p2');
      expect(shouldAutoPass(state, 'p1', withBlockers)).toBe(false);
    });

    it('should STOP when stack has items and you have instant-speed response', () => {
      const state = { ...withPhase(Phase.PreCombatMain, null, 'p2'), stack: ['s1'] };
      expect(shouldAutoPass(state, 'p1', withSpell)).toBe(false);
    });

    it('should auto-pass when stack has items but no instant-speed response', () => {
      const state = { ...withPhase(Phase.PreCombatMain, null, 'p2'), stack: ['s1'] };
      expect(shouldAutoPass(state, 'p1', passOnly)).toBe(true);
    });
  });
});
