import { describe, it, expect } from 'vitest';
import type { PlayerAction, ClientGameState, CardInstance, Zone } from '@magic-flux/types';
import { ZoneType } from '@magic-flux/types';
import {
  isCastableCard,
  isPlayableLand,
  isTargetingComplete,
  getEligibleAttackerIds,
  getEligibleBlockerIds,
} from '../../src/interaction/targeting';
import { createMockCardInstance } from '../../src/mocks/mock-cards';
import { SERRA_ANGEL_DATA, GRIZZLY_BEARS_DATA, PLAINS_DATA } from '../../src/mocks/mock-cards';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBattlefieldState(
  cards: CardInstance[],
): ClientGameState {
  const cardInstances: Record<string, CardInstance> = {};
  const cardInstanceIds: string[] = [];
  for (const card of cards) {
    cardInstances[card.instanceId] = card;
    cardInstanceIds.push(card.instanceId);
  }

  const battlefield: Zone = {
    key: 'battlefield',
    type: ZoneType.Battlefield,
    ownerId: null,
    cardInstanceIds,
    visibility: 'public',
  };

  return {
    gameId: 'test-game',
    players: [],
    cardInstances,
    zones: { battlefield },
    turnState: {
      turnNumber: 1,
      activePlayerId: 'p1',
      phase: 'PreCombatMain' as never,
      step: null,
      hasDeclaredAttackers: false,
      hasDeclaredBlockers: false,
      priorityPassedWithoutAction: [],
    },
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
}

// ---------------------------------------------------------------------------
// isCastableCard
// ---------------------------------------------------------------------------

describe('isCastableCard', () => {
  it('should return true when a castSpell action exists for the card', () => {
    const actions: PlayerAction[] = [
      { type: 'passPriority' },
      { type: 'castSpell', cardInstanceId: 'bolt-1' },
    ];
    expect(isCastableCard('bolt-1', actions)).toBe(true);
  });

  it('should return false when no castSpell action matches', () => {
    const actions: PlayerAction[] = [
      { type: 'passPriority' },
      { type: 'castSpell', cardInstanceId: 'bolt-1' },
    ];
    expect(isCastableCard('angel-1', actions)).toBe(false);
  });

  it('should return false when there are no castSpell actions at all', () => {
    const actions: PlayerAction[] = [
      { type: 'passPriority' },
      { type: 'playLand', cardInstanceId: 'plains-1' },
    ];
    expect(isCastableCard('plains-1', actions)).toBe(false);
  });

  it('should return false for an empty action list', () => {
    expect(isCastableCard('bolt-1', [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isPlayableLand
// ---------------------------------------------------------------------------

describe('isPlayableLand', () => {
  it('should return true when a playLand action exists for the card', () => {
    const actions: PlayerAction[] = [
      { type: 'passPriority' },
      { type: 'playLand', cardInstanceId: 'plains-1' },
    ];
    expect(isPlayableLand('plains-1', actions)).toBe(true);
  });

  it('should return false when no playLand action matches', () => {
    const actions: PlayerAction[] = [
      { type: 'playLand', cardInstanceId: 'plains-1' },
    ];
    expect(isPlayableLand('mountain-1', actions)).toBe(false);
  });

  it('should return false when there are no playLand actions', () => {
    const actions: PlayerAction[] = [
      { type: 'passPriority' },
      { type: 'castSpell', cardInstanceId: 'bolt-1' },
    ];
    expect(isPlayableLand('bolt-1', actions)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isTargetingComplete
// ---------------------------------------------------------------------------

describe('isTargetingComplete', () => {
  it('should return true when selected count equals required count', () => {
    expect(isTargetingComplete(2, 2)).toBe(true);
  });

  it('should return true when selected count exceeds required count', () => {
    expect(isTargetingComplete(3, 1)).toBe(true);
  });

  it('should return false when selected count is less than required', () => {
    expect(isTargetingComplete(0, 1)).toBe(false);
  });

  it('should return true for 0 selected / 0 required', () => {
    expect(isTargetingComplete(0, 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getEligibleAttackerIds
// ---------------------------------------------------------------------------

describe('getEligibleAttackerIds', () => {
  it('should return untapped, non-summoning-sick creatures controlled by the player', () => {
    const angel = createMockCardInstance(
      SERRA_ANGEL_DATA.id, 'angel-1', 'p1', ZoneType.Battlefield,
      { modifiedPower: 4, modifiedToughness: 4, summoningSickness: false },
    );
    const bears = createMockCardInstance(
      GRIZZLY_BEARS_DATA.id, 'bears-1', 'p1', ZoneType.Battlefield,
      { modifiedPower: 2, modifiedToughness: 2, summoningSickness: false },
    );
    const state = makeBattlefieldState([angel, bears]);
    expect(getEligibleAttackerIds(state, 'p1')).toEqual(['angel-1', 'bears-1']);
  });

  it('should exclude tapped creatures', () => {
    const tappedAngel = createMockCardInstance(
      SERRA_ANGEL_DATA.id, 'angel-tapped', 'p1', ZoneType.Battlefield,
      { modifiedPower: 4, modifiedToughness: 4, tapped: true, summoningSickness: false },
    );
    const freshBears = createMockCardInstance(
      GRIZZLY_BEARS_DATA.id, 'bears-ok', 'p1', ZoneType.Battlefield,
      { modifiedPower: 2, modifiedToughness: 2, summoningSickness: false },
    );
    const state = makeBattlefieldState([tappedAngel, freshBears]);
    expect(getEligibleAttackerIds(state, 'p1')).toEqual(['bears-ok']);
  });

  it('should exclude summoning-sick creatures', () => {
    const sickBears = createMockCardInstance(
      GRIZZLY_BEARS_DATA.id, 'bears-sick', 'p1', ZoneType.Battlefield,
      { modifiedPower: 2, modifiedToughness: 2, summoningSickness: true },
    );
    const state = makeBattlefieldState([sickBears]);
    expect(getEligibleAttackerIds(state, 'p1')).toEqual([]);
  });

  it('should exclude non-creatures (modifiedPower is null)', () => {
    const land = createMockCardInstance(
      PLAINS_DATA.id, 'plains-1', 'p1', ZoneType.Battlefield,
    );
    const state = makeBattlefieldState([land]);
    expect(getEligibleAttackerIds(state, 'p1')).toEqual([]);
  });

  it('should exclude creatures controlled by a different player', () => {
    const enemyBears = createMockCardInstance(
      GRIZZLY_BEARS_DATA.id, 'enemy-bears', 'p2', ZoneType.Battlefield,
      { modifiedPower: 2, modifiedToughness: 2, summoningSickness: false },
    );
    const state = makeBattlefieldState([enemyBears]);
    expect(getEligibleAttackerIds(state, 'p1')).toEqual([]);
  });

  it('should return empty array when battlefield has no cards', () => {
    const state = makeBattlefieldState([]);
    expect(getEligibleAttackerIds(state, 'p1')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getEligibleBlockerIds
// ---------------------------------------------------------------------------

describe('getEligibleBlockerIds', () => {
  it('should return untapped creatures controlled by the player', () => {
    const angel = createMockCardInstance(
      SERRA_ANGEL_DATA.id, 'angel-1', 'p1', ZoneType.Battlefield,
      { modifiedPower: 4, modifiedToughness: 4 },
    );
    const state = makeBattlefieldState([angel]);
    expect(getEligibleBlockerIds(state, 'p1')).toEqual(['angel-1']);
  });

  it('should include summoning-sick creatures (they can block)', () => {
    const sickBears = createMockCardInstance(
      GRIZZLY_BEARS_DATA.id, 'bears-sick', 'p1', ZoneType.Battlefield,
      { modifiedPower: 2, modifiedToughness: 2, summoningSickness: true },
    );
    const state = makeBattlefieldState([sickBears]);
    expect(getEligibleBlockerIds(state, 'p1')).toEqual(['bears-sick']);
  });

  it('should exclude tapped creatures from blocking', () => {
    const tapped = createMockCardInstance(
      GRIZZLY_BEARS_DATA.id, 'bears-tapped', 'p1', ZoneType.Battlefield,
      { modifiedPower: 2, modifiedToughness: 2, tapped: true },
    );
    const state = makeBattlefieldState([tapped]);
    expect(getEligibleBlockerIds(state, 'p1')).toEqual([]);
  });
});
