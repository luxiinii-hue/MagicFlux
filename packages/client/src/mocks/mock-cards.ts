import type {
  CardData, CardInstance, ManaColor, CardTypeName, Supertype,
  CardLayout, FormatLegality, ManaCost, SpellAbility,
} from '@magic-flux/types';
import { ZoneType } from '@magic-flux/types';

// ---------------------------------------------------------------------------
// CardData factory
// ---------------------------------------------------------------------------

export function createMockCardData(overrides: Partial<CardData> = {}): CardData {
  return {
    id: 'mock-card-data-001',
    oracleId: 'mock-oracle-001',
    name: 'Mock Card',
    manaCost: null,
    parsedManaCost: null,
    cmc: 0,
    typeLine: 'Basic Land — Plains',
    supertypes: ['Basic'] as readonly Supertype[],
    cardTypes: ['Land'] as readonly CardTypeName[],
    subtypes: ['Plains'],
    oracleText: '({T}: Add {W}.)',
    power: null,
    toughness: null,
    loyalty: null,
    defense: null,
    colors: [] as readonly ManaColor[],
    colorIdentity: ['W'] as readonly ManaColor[],
    keywords: [] as readonly string[],
    layout: 'normal' as CardLayout,
    faces: null,
    imageUris: {
      small: 'https://cards.scryfall.io/small/front/a/3/a3958a25-fd98-41e7-834b-e41e4e4925b8.jpg',
      normal: 'https://cards.scryfall.io/normal/front/a/3/a3958a25-fd98-41e7-834b-e41e4e4925b8.jpg',
      large: 'https://cards.scryfall.io/large/front/a/3/a3958a25-fd98-41e7-834b-e41e4e4925b8.jpg',
    },
    legalities: { standard: 'legal', modern: 'legal', commander: 'legal' } as Readonly<Record<string, FormatLegality>>,
    isToken: false,
    producedMana: ['W'] as readonly ManaColor[],
    ...overrides,
  };
}

// Pre-built card data
export const PLAINS_DATA = createMockCardData();

export const MOUNTAIN_DATA = createMockCardData({
  id: 'mountain-data-001',
  oracleId: 'mountain-oracle-001',
  name: 'Mountain',
  typeLine: 'Basic Land — Mountain',
  subtypes: ['Mountain'],
  oracleText: '({T}: Add {R}.)',
  colorIdentity: ['R'],
  imageUris: {
    small: 'https://cards.scryfall.io/small/front/5/4/54a7b4d0-7f5a-4a72-950e-63b1f7e67b6c.jpg',
    normal: 'https://cards.scryfall.io/normal/front/5/4/54a7b4d0-7f5a-4a72-950e-63b1f7e67b6c.jpg',
    large: 'https://cards.scryfall.io/large/front/5/4/54a7b4d0-7f5a-4a72-950e-63b1f7e67b6c.jpg',
  },
  producedMana: ['R'],
});

export const ISLAND_DATA = createMockCardData({
  id: 'island-data-001',
  oracleId: 'island-oracle-001',
  name: 'Island',
  typeLine: 'Basic Land — Island',
  subtypes: ['Island'],
  oracleText: '({T}: Add {U}.)',
  colorIdentity: ['U'],
  imageUris: {
    small: 'https://cards.scryfall.io/small/front/b/e/be59b6ec-d1c6-4ef3-8ad6-b0be477b11d3.jpg',
    normal: 'https://cards.scryfall.io/normal/front/b/e/be59b6ec-d1c6-4ef3-8ad6-b0be477b11d3.jpg',
    large: 'https://cards.scryfall.io/large/front/b/e/be59b6ec-d1c6-4ef3-8ad6-b0be477b11d3.jpg',
  },
  producedMana: ['U'],
});

export const SERRA_ANGEL_DATA = createMockCardData({
  id: 'serra-angel-data-001',
  oracleId: 'serra-angel-oracle-001',
  name: 'Serra Angel',
  manaCost: '{3}{W}{W}',
  parsedManaCost: {
    symbols: [
      { type: 'generic', amount: 3 },
      { type: 'colored', color: 'W' },
      { type: 'colored', color: 'W' },
    ],
    totalCMC: 5,
  } as ManaCost,
  cmc: 5,
  typeLine: 'Creature — Angel',
  supertypes: [] as readonly Supertype[],
  cardTypes: ['Creature'] as readonly CardTypeName[],
  subtypes: ['Angel'],
  oracleText: 'Flying, vigilance',
  power: '4',
  toughness: '4',
  colors: ['W'] as readonly ManaColor[],
  colorIdentity: ['W'] as readonly ManaColor[],
  keywords: ['Flying', 'Vigilance'],
  imageUris: {
    small: 'https://cards.scryfall.io/small/front/9/0/9067f035-3437-4c5c-bae9-d3c9571248f0.jpg',
    normal: 'https://cards.scryfall.io/normal/front/9/0/9067f035-3437-4c5c-bae9-d3c9571248f0.jpg',
    large: 'https://cards.scryfall.io/large/front/9/0/9067f035-3437-4c5c-bae9-d3c9571248f0.jpg',
  },
  producedMana: null,
});

export const LIGHTNING_BOLT_DATA = createMockCardData({
  id: 'lightning-bolt-data-001',
  oracleId: 'bolt-oracle-001',
  name: 'Lightning Bolt',
  manaCost: '{R}',
  parsedManaCost: {
    symbols: [{ type: 'colored', color: 'R' }],
    totalCMC: 1,
  } as ManaCost,
  cmc: 1,
  typeLine: 'Instant',
  supertypes: [] as readonly Supertype[],
  cardTypes: ['Instant'] as readonly CardTypeName[],
  subtypes: [],
  oracleText: 'Lightning Bolt deals 3 damage to any target.',
  power: null,
  toughness: null,
  colors: ['R'] as readonly ManaColor[],
  colorIdentity: ['R'] as readonly ManaColor[],
  keywords: [],
  imageUris: {
    small: 'https://cards.scryfall.io/small/front/f/2/f29ba16f-c8fb-42fe-aabf-87089cb214a7.jpg',
    normal: 'https://cards.scryfall.io/normal/front/f/2/f29ba16f-c8fb-42fe-aabf-87089cb214a7.jpg',
    large: 'https://cards.scryfall.io/large/front/f/2/f29ba16f-c8fb-42fe-aabf-87089cb214a7.jpg',
  },
  producedMana: null,
});

export const GRIZZLY_BEARS_DATA = createMockCardData({
  id: 'grizzly-bears-data-001',
  oracleId: 'bears-oracle-001',
  name: 'Grizzly Bears',
  manaCost: '{1}{G}',
  parsedManaCost: {
    symbols: [
      { type: 'generic', amount: 1 },
      { type: 'colored', color: 'G' },
    ],
    totalCMC: 2,
  } as ManaCost,
  cmc: 2,
  typeLine: 'Creature — Bear',
  supertypes: [] as readonly Supertype[],
  cardTypes: ['Creature'] as readonly CardTypeName[],
  subtypes: ['Bear'],
  oracleText: '',
  power: '2',
  toughness: '2',
  colors: ['G'] as readonly ManaColor[],
  colorIdentity: ['G'] as readonly ManaColor[],
  keywords: [],
  imageUris: {
    small: 'https://cards.scryfall.io/small/front/4/0/409f9b88-f03e-40b6-9883-68c14c37c0de.jpg',
    normal: 'https://cards.scryfall.io/normal/front/4/0/409f9b88-f03e-40b6-9883-68c14c37c0de.jpg',
    large: 'https://cards.scryfall.io/large/front/4/0/409f9b88-f03e-40b6-9883-68c14c37c0de.jpg',
  },
  producedMana: null,
});

// ---------------------------------------------------------------------------
// CardInstance factory
// ---------------------------------------------------------------------------

export function createMockCardInstance(
  cardDataId: string,
  instanceId: string,
  owner: string,
  zone: ZoneType,
  overrides: Partial<CardInstance> = {},
): CardInstance {
  return {
    instanceId,
    cardDataId,
    owner,
    controller: owner,
    zone,
    zoneOwnerId: (zone === ZoneType.Library || zone === ZoneType.Hand || zone === ZoneType.Graveyard) ? owner : null,
    tapped: false,
    flipped: false,
    faceDown: false,
    transformedOrBack: false,
    phasedOut: false,
    summoningSickness: false,
    damage: 0,
    counters: {},
    attachedTo: null,
    attachments: [],
    abilities: [] as readonly SpellAbility[],
    modifiedPower: null,
    modifiedToughness: null,
    currentLoyalty: null,
    castingChoices: null,
    linkedEffects: {},
    ...overrides,
  };
}
