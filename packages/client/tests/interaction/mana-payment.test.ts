import { describe, it, expect } from 'vitest';
import { ZoneType } from '@magic-flux/types';
import type { CardInstance, ManaCost, ManaPool, ManaColor } from '@magic-flux/types';
import { computeAutoPayment, getLandColor } from '../../src/interaction/mana-payment';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_POOL: ManaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

function makeLand(id: string, color: ManaColor, tapped = false): CardInstance {
  return {
    instanceId: id,
    cardDataId: `card-${color}`,
    owner: 'p1',
    controller: 'p1',
    zone: ZoneType.Battlefield,
    zoneOwnerId: null,
    tapped,
    flipped: false,
    faceDown: false,
    transformedOrBack: false,
    phasedOut: false,
    summoningSickness: false,
    damage: 0,
    counters: {},
    attachedTo: null,
    attachments: [],
    abilities: [],
    modifiedPower: null,
    modifiedToughness: null,
    currentLoyalty: null,
    castingChoices: null,
    linkedEffects: {},
  };
}

const CARD_DATA_MAP: Readonly<Record<string, { subtypes: readonly string[] }>> = {
  'card-W': { subtypes: ['Plains'] },
  'card-U': { subtypes: ['Island'] },
  'card-B': { subtypes: ['Swamp'] },
  'card-R': { subtypes: ['Mountain'] },
  'card-G': { subtypes: ['Forest'] },
};

function coloredSymbol(color: ManaColor): { readonly type: 'colored'; readonly color: ManaColor } {
  return { type: 'colored', color };
}

function genericSymbol(amount: number): { readonly type: 'generic'; readonly amount: number } {
  return { type: 'generic', amount };
}

function makeCost(symbols: ManaCost['symbols'], totalCMC?: number): ManaCost {
  const cmc =
    totalCMC ??
    symbols.reduce((sum, s) => {
      if (s.type === 'generic') return sum + s.amount;
      if (s.type === 'colored' || s.type === 'colorless') return sum + 1;
      return sum;
    }, 0);
  return { symbols, totalCMC: cmc };
}

// ---------------------------------------------------------------------------
// getLandColor
// ---------------------------------------------------------------------------

describe('getLandColor', () => {
  it('returns the correct color for each basic land subtype', () => {
    expect(getLandColor('card-W', CARD_DATA_MAP)).toBe('W');
    expect(getLandColor('card-U', CARD_DATA_MAP)).toBe('U');
    expect(getLandColor('card-B', CARD_DATA_MAP)).toBe('B');
    expect(getLandColor('card-R', CARD_DATA_MAP)).toBe('R');
    expect(getLandColor('card-G', CARD_DATA_MAP)).toBe('G');
  });

  it('returns null when cardDataMap is undefined', () => {
    expect(getLandColor('card-W')).toBeNull();
  });

  it('returns null when cardDataId is not in the map', () => {
    expect(getLandColor('unknown', CARD_DATA_MAP)).toBeNull();
  });

  it('returns null when subtypes contain no basic land type', () => {
    const map = { 'card-X': { subtypes: ['Gate'] } };
    expect(getLandColor('card-X', map)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeAutoPayment
// ---------------------------------------------------------------------------

describe('computeAutoPayment', () => {
  it('should pay a single colored cost from a matching land', () => {
    const cost = makeCost([coloredSymbol('W')]);
    const lands = [makeLand('plains-1', 'W')];

    const result = computeAutoPayment(cost, EMPTY_POOL, lands, CARD_DATA_MAP);

    expect(result).not.toBeNull();
    expect(result!.landsToTap).toEqual(['plains-1']);
    expect(result!.poolManaUsed).toEqual(EMPTY_POOL);
  });

  it('should use pool mana before tapping lands', () => {
    const cost = makeCost([coloredSymbol('U')]);
    const pool: ManaPool = { W: 0, U: 1, B: 0, R: 0, G: 0, C: 0 };
    const lands = [makeLand('island-1', 'U')];

    const result = computeAutoPayment(cost, pool, lands, CARD_DATA_MAP);

    expect(result).not.toBeNull();
    expect(result!.landsToTap).toEqual([]);
    expect(result!.poolManaUsed).toEqual({ W: 0, U: 1, B: 0, R: 0, G: 0, C: 0 });
  });

  it('should pay generic cost from any land', () => {
    const cost = makeCost([genericSymbol(1)]);
    const lands = [makeLand('mountain-1', 'R')];

    const result = computeAutoPayment(cost, EMPTY_POOL, lands, CARD_DATA_MAP);

    expect(result).not.toBeNull();
    expect(result!.landsToTap).toEqual(['mountain-1']);
    expect(result!.poolManaUsed).toEqual(EMPTY_POOL);
  });

  it('should skip already-tapped lands', () => {
    const cost = makeCost([coloredSymbol('G')]);
    const lands = [
      makeLand('forest-1', 'G', true),
      makeLand('forest-2', 'G', false),
    ];

    const result = computeAutoPayment(cost, EMPTY_POOL, lands, CARD_DATA_MAP);

    expect(result).not.toBeNull();
    expect(result!.landsToTap).toEqual(['forest-2']);
  });

  it('should return null if cost cannot be paid (wrong color available)', () => {
    const cost = makeCost([coloredSymbol('B')]);
    const lands = [makeLand('plains-1', 'W')];

    const result = computeAutoPayment(cost, EMPTY_POOL, lands, CARD_DATA_MAP);

    expect(result).toBeNull();
  });

  it('should return null if insufficient total mana', () => {
    const cost = makeCost([genericSymbol(3)]);
    const lands = [makeLand('plains-1', 'W'), makeLand('plains-2', 'W')];

    const result = computeAutoPayment(cost, EMPTY_POOL, lands, CARD_DATA_MAP);

    expect(result).toBeNull();
  });

  it('should handle mixed colored + generic costs ({3}{W}{W} from 5 Plains)', () => {
    const cost = makeCost([genericSymbol(3), coloredSymbol('W'), coloredSymbol('W')]);
    const lands = [
      makeLand('plains-1', 'W'),
      makeLand('plains-2', 'W'),
      makeLand('plains-3', 'W'),
      makeLand('plains-4', 'W'),
      makeLand('plains-5', 'W'),
    ];

    const result = computeAutoPayment(cost, EMPTY_POOL, lands, CARD_DATA_MAP);

    expect(result).not.toBeNull();
    expect(result!.landsToTap).toHaveLength(5);
    expect(result!.poolManaUsed).toEqual(EMPTY_POOL);
  });

  it('should use pool mana for generic costs before tapping lands', () => {
    const cost = makeCost([genericSymbol(3), coloredSymbol('R')]);
    const pool: ManaPool = { W: 0, U: 0, B: 0, R: 0, G: 2, C: 0 };
    const lands = [
      makeLand('mountain-1', 'R'),
      makeLand('forest-1', 'G'),
    ];

    const result = computeAutoPayment(cost, pool, lands, CARD_DATA_MAP);

    expect(result).not.toBeNull();
    // R from tapping mountain, 2 generic from pool (G), 1 generic from tapping forest
    expect(result!.landsToTap).toContain('mountain-1');
    expect(result!.landsToTap).toContain('forest-1');
    expect(result!.landsToTap).toHaveLength(2);
    expect(result!.poolManaUsed.G).toBe(2);
  });

  it('should handle zero-cost spells', () => {
    const cost = makeCost([], 0);
    const lands = [makeLand('plains-1', 'W')];

    const result = computeAutoPayment(cost, EMPTY_POOL, lands, CARD_DATA_MAP);

    expect(result).not.toBeNull();
    expect(result!.landsToTap).toEqual([]);
    expect(result!.poolManaUsed).toEqual(EMPTY_POOL);
  });

  it('should return null for unsupported symbol types like X', () => {
    const cost: ManaCost = {
      symbols: [{ type: 'X' }],
      totalCMC: 0,
    };

    const result = computeAutoPayment(cost, EMPTY_POOL, [], CARD_DATA_MAP);

    expect(result).toBeNull();
  });

  it('should pay colorless {C} costs from colorless pool mana', () => {
    const cost: ManaCost = {
      symbols: [{ type: 'colorless' }],
      totalCMC: 1,
    };
    const pool: ManaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 1 };

    const result = computeAutoPayment(cost, pool, [], CARD_DATA_MAP);

    expect(result).not.toBeNull();
    expect(result!.landsToTap).toEqual([]);
    expect(result!.poolManaUsed.C).toBe(1);
  });

  it('should combine pool mana and lands to pay a mixed cost', () => {
    // Cost: {1}{W}{U}
    const cost = makeCost([genericSymbol(1), coloredSymbol('W'), coloredSymbol('U')]);
    const pool: ManaPool = { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 };
    const lands = [
      makeLand('island-1', 'U'),
      makeLand('mountain-1', 'R'),
    ];

    const result = computeAutoPayment(cost, pool, lands, CARD_DATA_MAP);

    expect(result).not.toBeNull();
    // W from pool, U from tapping island, 1 generic from tapping mountain
    expect(result!.poolManaUsed.W).toBe(1);
    expect(result!.landsToTap).toContain('island-1');
    expect(result!.landsToTap).toContain('mountain-1');
    expect(result!.landsToTap).toHaveLength(2);
  });
});
