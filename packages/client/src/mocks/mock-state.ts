import type {
  ClientGameState, Player, Zone, CardInstance,
  TurnState, GameEvent, PlayerAction, ClientLibraryZone, ClientHandZone,
  CardData,
} from '@magic-flux/types';
import { Phase, Step, ZoneType } from '@magic-flux/types';
import {
  PLAINS_DATA, MOUNTAIN_DATA, SERRA_ANGEL_DATA,
  LIGHTNING_BOLT_DATA, GRIZZLY_BEARS_DATA,
  createMockCardInstance,
} from './mock-cards';

// ---------------------------------------------------------------------------
// Card data registry for mock usage
// ---------------------------------------------------------------------------

export const MOCK_CARD_DATA_MAP: Record<string, CardData> = {
  [PLAINS_DATA.id]: PLAINS_DATA,
  [MOUNTAIN_DATA.id]: MOUNTAIN_DATA,
  [SERRA_ANGEL_DATA.id]: SERRA_ANGEL_DATA,
  [LIGHTNING_BOLT_DATA.id]: LIGHTNING_BOLT_DATA,
  [GRIZZLY_BEARS_DATA.id]: GRIZZLY_BEARS_DATA,
};

// ---------------------------------------------------------------------------
// Factory: a mid-game 2-player state
// ---------------------------------------------------------------------------

export function createMockGameState(): ClientGameState {
  const p1 = 'player-1';
  const p2 = 'player-2';

  const cardInstances: Record<string, CardInstance> = {};

  // Player 1 battlefield: 2 Plains (1 tapped), Serra Angel
  const p1Plains1 = createMockCardInstance(PLAINS_DATA.id, 'p1-plains-1', p1, ZoneType.Battlefield);
  const p1Plains2 = createMockCardInstance(PLAINS_DATA.id, 'p1-plains-2', p1, ZoneType.Battlefield, { tapped: true });
  const p1Angel = createMockCardInstance(SERRA_ANGEL_DATA.id, 'p1-serra-angel', p1, ZoneType.Battlefield, {
    modifiedPower: 4,
    modifiedToughness: 4,
  });

  // Player 1 hand: Lightning Bolt, Plains
  const p1Bolt = createMockCardInstance(LIGHTNING_BOLT_DATA.id, 'p1-bolt-hand', p1, ZoneType.Hand, { zoneOwnerId: p1 });
  const p1PlainsHand = createMockCardInstance(PLAINS_DATA.id, 'p1-plains-hand', p1, ZoneType.Hand, { zoneOwnerId: p1 });

  // Player 2 battlefield: 2 Mountains, Grizzly Bears (with +1/+1 counter)
  const p2Mountain1 = createMockCardInstance(MOUNTAIN_DATA.id, 'p2-mountain-1', p2, ZoneType.Battlefield);
  const p2Mountain2 = createMockCardInstance(MOUNTAIN_DATA.id, 'p2-mountain-2', p2, ZoneType.Battlefield);
  const p2Bears = createMockCardInstance(GRIZZLY_BEARS_DATA.id, 'p2-bears', p2, ZoneType.Battlefield, {
    modifiedPower: 3,
    modifiedToughness: 3,
    counters: { '+1/+1': 1 },
  });

  // Player 2 graveyard: a Lightning Bolt
  const p2BoltGy = createMockCardInstance(LIGHTNING_BOLT_DATA.id, 'p2-bolt-gy', p2, ZoneType.Graveyard, { zoneOwnerId: p2 });

  for (const card of [p1Plains1, p1Plains2, p1Angel, p1Bolt, p1PlainsHand, p2Mountain1, p2Mountain2, p2Bears, p2BoltGy]) {
    cardInstances[card.instanceId] = card;
  }

  const players: Player[] = [
    {
      id: p1, name: 'Alice', life: 18, poisonCounters: 0,
      manaPool: { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 },
      hasLost: false, hasConceded: false, commanderDamageReceived: {},
      commanderId: null, commanderTax: 0, energyCounters: 0,
      experienceCounters: 0, landsPlayedThisTurn: 1, maxLandsPerTurn: 1,
      drewFromEmptyLibrary: false,
    },
    {
      id: p2, name: 'Bob', life: 14, poisonCounters: 0,
      manaPool: { W: 0, U: 0, B: 0, R: 2, G: 0, C: 0 },
      hasLost: false, hasConceded: false, commanderDamageReceived: {},
      commanderId: null, commanderTax: 0, energyCounters: 0,
      experienceCounters: 0, landsPlayedThisTurn: 0, maxLandsPerTurn: 1,
      drewFromEmptyLibrary: false,
    },
  ];

  const zones: Record<string, Zone | ClientLibraryZone | ClientHandZone> = {
    battlefield: {
      key: 'battlefield', type: ZoneType.Battlefield, ownerId: null,
      cardInstanceIds: ['p1-plains-1', 'p1-plains-2', 'p1-serra-angel', 'p2-mountain-1', 'p2-mountain-2', 'p2-bears'],
      visibility: 'public',
    },
    [`player:${p1}:hand`]: {
      key: `player:${p1}:hand`, type: 'Hand' as const, ownerId: p1,
      cardInstanceIds: ['p1-bolt-hand', 'p1-plains-hand'], cardCount: 2,
    } satisfies ClientHandZone,
    [`player:${p2}:hand`]: {
      key: `player:${p2}:hand`, type: 'Hand' as const, ownerId: p2,
      cardInstanceIds: null, cardCount: 4,
    } satisfies ClientHandZone,
    [`player:${p1}:library`]: {
      key: `player:${p1}:library`, type: 'Library' as const, ownerId: p1, cardCount: 50,
    } satisfies ClientLibraryZone,
    [`player:${p2}:library`]: {
      key: `player:${p2}:library`, type: 'Library' as const, ownerId: p2, cardCount: 48,
    } satisfies ClientLibraryZone,
    [`player:${p1}:graveyard`]: {
      key: `player:${p1}:graveyard`, type: ZoneType.Graveyard, ownerId: p1,
      cardInstanceIds: [], visibility: 'public',
    },
    [`player:${p2}:graveyard`]: {
      key: `player:${p2}:graveyard`, type: ZoneType.Graveyard, ownerId: p2,
      cardInstanceIds: ['p2-bolt-gy'], visibility: 'public',
    },
    exile: { key: 'exile', type: ZoneType.Exile, ownerId: null, cardInstanceIds: [], visibility: 'public' },
    stack: { key: 'stack', type: ZoneType.Stack, ownerId: null, cardInstanceIds: [], visibility: 'public' },
  };

  const turnState: TurnState = {
    turnNumber: 3, activePlayerId: p1, phase: Phase.PreCombatMain,
    step: null, hasDeclaredAttackers: false, hasDeclaredBlockers: false,
    priorityPassedWithoutAction: [],
  };

  return {
    gameId: 'mock-game-001', players, cardInstances, zones, turnState,
    activePlayerId: p1, priorityPlayerId: p1, stack: [], stackItems: {},
    turnNumber: 3, gameOver: false, winners: [], losers: [],
    continuousEffects: [], combatState: null, format: 'standard',
  };
}

// ---------------------------------------------------------------------------
// Mock legal actions
// ---------------------------------------------------------------------------

export function createMockLegalActions(): PlayerAction[] {
  return [
    { type: 'passPriority' },
    { type: 'playLand', cardInstanceId: 'p1-plains-hand' },
  ];
}

// ---------------------------------------------------------------------------
// Mock game log
// ---------------------------------------------------------------------------

export interface MockLogEntry {
  readonly event: GameEvent;
  readonly message: string;
}

export function createMockGameLog(): MockLogEntry[] {
  return [
    { event: { type: 'turnBegan', turnNumber: 3, activePlayerId: 'player-1', timestamp: 20 }, message: "Turn 3 — Alice's turn" },
    { event: { type: 'phaseChanged', phase: Phase.Beginning, step: Step.Draw, timestamp: 21 }, message: 'Draw step' },
    { event: { type: 'phaseChanged', phase: Phase.PreCombatMain, step: null, timestamp: 22 }, message: 'Pre-combat main phase' },
    { event: { type: 'cardEnteredZone', cardInstanceId: 'p1-plains-2', toZone: ZoneType.Battlefield, fromZone: ZoneType.Hand, timestamp: 23 }, message: 'Alice plays Plains' },
    { event: { type: 'manaAdded', playerId: 'player-1', mana: { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 }, timestamp: 24 }, message: 'Alice adds {W}' },
  ];
}
