import { describe, it, expect } from 'vitest';
import type { CombatState } from '@magic-flux/types';
import {
  buildAttackerAssignments,
  buildBlockerAssignments,
  getAttackerIds,
  getDefendingPlayerId,
} from '../../src/interaction/combat-ui';

describe('buildAttackerAssignments', () => {
  it('should map all attackers to the defending player', () => {
    const result = buildAttackerAssignments(
      ['angel-1', 'elf-1', 'goblin-3'],
      'player-2',
    );
    expect(result).toEqual({
      'angel-1': 'player-2',
      'elf-1': 'player-2',
      'goblin-3': 'player-2',
    });
  });

  it('should return an empty object for no attackers', () => {
    const result = buildAttackerAssignments([], 'player-2');
    expect(result).toEqual({});
  });
});

describe('buildBlockerAssignments', () => {
  it('should convert single-attacker assignments correctly', () => {
    const result = buildBlockerAssignments({
      'wall-1': 'goblin-1',
      'bear-2': 'angel-1',
    });
    expect(result).toEqual({
      'wall-1': ['goblin-1'],
      'bear-2': ['angel-1'],
    });
  });

  it('should handle multiple blockers on the same attacker', () => {
    const result = buildBlockerAssignments({
      'wall-1': 'dragon-1',
      'knight-2': 'dragon-1',
      'bear-3': 'dragon-1',
    });
    expect(result).toEqual({
      'wall-1': ['dragon-1'],
      'knight-2': ['dragon-1'],
      'bear-3': ['dragon-1'],
    });
  });
});

describe('getAttackerIds', () => {
  it('should extract keys from combat state', () => {
    const combatState: CombatState = {
      attackers: {
        'angel-1': { attackTarget: 'player-2', blocked: false, blockers: [], dealtFirstStrikeDamage: false },
        'elf-1': { attackTarget: 'player-2', blocked: true, blockers: ['wall-1'], dealtFirstStrikeDamage: false },
      },
      blockers: {
        'wall-1': { blocking: ['elf-1'] },
      },
      damageAssignmentOrders: {},
    };
    const result = getAttackerIds(combatState);
    expect(result).toEqual(['angel-1', 'elf-1']);
  });

  it('should return an empty array for null', () => {
    const result = getAttackerIds(null);
    expect(result).toEqual([]);
  });
});

describe('getDefendingPlayerId', () => {
  it('should return the non-active player', () => {
    const players = [{ id: 'player-1' }, { id: 'player-2' }];
    const result = getDefendingPlayerId(players, 'player-1');
    expect(result).toBe('player-2');
  });

  it('should fall back to activePlayerId if no opponent found', () => {
    const result = getDefendingPlayerId([], 'player-1');
    expect(result).toBe('player-1');
  });
});
