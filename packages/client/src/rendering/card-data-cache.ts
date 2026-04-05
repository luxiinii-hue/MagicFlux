/**
 * Client-side CardData cache. Builds minimal CardData objects for card names
 * not found in the static card data map, using Scryfall's named-card image API.
 *
 * This lets the game board render real cards without needing a full Scryfall
 * bulk data download on the client.
 */

import type { CardData } from '@magic-flux/types';

const SCRYFALL_IMAGE_BASE = 'https://api.scryfall.com/cards/named';

/**
 * Known set codes for specific cards to avoid Scryfall returning
 * wrong printings (e.g., spellbook/adventure cards from newer sets).
 */
const PREFERRED_SET: Record<string, string> = {
  'Lightning Bolt': 'a25',
  'Counterspell': 'a25',
  'Giant Growth': 'a25',
  'Shock': 'm21',
  'Dark Ritual': 'a25',
  'Ancestral Recall': 'vma',
  'Swords to Plowshares': 'a25',
  'Path to Exile': 'e02',
};

function scryfallImageUrl(cardName: string, version: 'small' | 'normal' | 'large'): string {
  const encoded = encodeURIComponent(cardName);
  const setParam = PREFERRED_SET[cardName] ? `&set=${PREFERRED_SET[cardName]}` : '';
  return `${SCRYFALL_IMAGE_BASE}?exact=${encoded}${setParam}&format=image&version=${version}`;
}

/** Cache of dynamically created CardData entries keyed by card name. */
const dynamicCardDataCache = new Map<string, CardData>();

/**
 * Get or create a minimal CardData for a card name.
 * Uses Scryfall's named image redirect so images load without an API call.
 */
export function getOrCreateCardData(
  cardName: string,
  staticMap: Readonly<Record<string, CardData>>,
): CardData {
  // Check static map first
  if (staticMap[cardName]) return staticMap[cardName];

  // Check dynamic cache
  const cached = dynamicCardDataCache.get(cardName);
  if (cached) return cached;

  // Create minimal CardData with Scryfall image URLs
  const cardData: CardData = {
    id: cardName,
    oracleId: cardName,
    name: cardName,
    manaCost: null,
    parsedManaCost: null,
    cmc: 0,
    typeLine: '',
    supertypes: [],
    cardTypes: [],
    subtypes: [],
    oracleText: '',
    power: null,
    toughness: null,
    loyalty: null,
    defense: null,
    colors: [],
    colorIdentity: [],
    keywords: [],
    layout: 'normal',
    faces: null,
    imageUris: {
      small: scryfallImageUrl(cardName, 'small'),
      normal: scryfallImageUrl(cardName, 'normal'),
      large: scryfallImageUrl(cardName, 'large'),
    },
    legalities: {},
    isToken: false,
    producedMana: null,
  };

  dynamicCardDataCache.set(cardName, cardData);
  return cardData;
}

/**
 * Build a complete card data map for all card instances in a game state.
 * Merges the static mock map with dynamically generated entries.
 */
export function buildCardDataMap(
  cardInstances: Readonly<Record<string, { cardDataId: string }>>,
  staticMap: Readonly<Record<string, CardData>>,
): Record<string, CardData> {
  const result: Record<string, CardData> = { ...staticMap };

  for (const instance of Object.values(cardInstances)) {
    const { cardDataId } = instance;
    if (!result[cardDataId]) {
      result[cardDataId] = getOrCreateCardData(cardDataId, staticMap);
    }
  }

  return result;
}
