import type { ManaCost, ManaPool, ManaColor, CardInstance } from '@magic-flux/types';

export interface AutoPayResult {
  readonly landsToTap: readonly string[];
  readonly poolManaUsed: ManaPool;
}

const BASIC_LAND_COLOR_MAP: Readonly<Record<string, ManaColor>> = {
  Plains: 'W',
  Island: 'U',
  Swamp: 'B',
  Mountain: 'R',
  Forest: 'G',
};

/**
 * Determine what color of mana a land produces based on its subtypes.
 * Returns null if the land's color cannot be determined from basic land types.
 */
export function getLandColor(
  cardDataId: string,
  cardDataMap?: Readonly<Record<string, { subtypes: readonly string[] }>>,
): ManaColor | null {
  if (!cardDataMap) return null;
  const data = cardDataMap[cardDataId];
  if (!data) return null;

  for (const subtype of data.subtypes) {
    const color = BASIC_LAND_COLOR_MAP[subtype];
    if (color) return color;
  }
  return null;
}

/**
 * Compute a greedy auto-payment plan for the given mana cost.
 *
 * Strategy:
 *  1. Pay colored costs first — use pool mana when available, otherwise tap a
 *     matching untapped land.
 *  2. Pay generic costs — drain remaining pool mana, then tap any remaining
 *     untapped lands.
 *  3. Return null if the cost cannot be fully satisfied.
 */
export function computeAutoPayment(
  cost: ManaCost,
  pool: ManaPool,
  untappedLands: readonly CardInstance[],
  cardDataMap?: Readonly<Record<string, { subtypes: readonly string[] }>>,
): AutoPayResult | null {
  // Mutable copies we can drain as we allocate resources
  const remainingPool: Record<ManaColor, number> = {
    W: pool.W,
    U: pool.U,
    B: pool.B,
    R: pool.R,
    G: pool.G,
    C: pool.C,
  };

  const landsToTap: string[] = [];
  const availableLands = untappedLands
    .filter((land) => !land.tapped)
    .map((land) => ({
      instanceId: land.instanceId,
      color: getLandColor(land.cardDataId, cardDataMap),
      used: false,
    }));

  // ----- Step 1: Separate cost into colored requirements and generic amount -----
  let genericAmount = 0;
  const coloredNeeds: ManaColor[] = [];

  for (const symbol of cost.symbols) {
    switch (symbol.type) {
      case 'colored':
        coloredNeeds.push(symbol.color);
        break;
      case 'colorless':
        // {C} specifically requires colorless mana
        coloredNeeds.push('C');
        break;
      case 'generic':
        genericAmount += symbol.amount;
        break;
      // X, phyrexian, hybrid, hybridGeneric, snow — not handled by auto-pay
      default:
        return null;
    }
  }

  // ----- Step 2: Pay each colored cost -----
  for (const color of coloredNeeds) {
    // Try pool first
    if (remainingPool[color] > 0) {
      remainingPool[color]--;
      continue;
    }

    // Try an untapped land that produces this color
    const landIndex = availableLands.findIndex(
      (l) => !l.used && l.color === color,
    );
    if (landIndex !== -1) {
      availableLands[landIndex].used = true;
      landsToTap.push(availableLands[landIndex].instanceId);
      continue;
    }

    // Cannot pay this colored cost
    return null;
  }

  // ----- Step 3: Pay generic cost -----
  // Drain remaining pool mana first (any color)
  const DRAIN_ORDER: ManaColor[] = ['C', 'W', 'U', 'B', 'R', 'G'];
  for (const color of DRAIN_ORDER) {
    if (genericAmount <= 0) break;
    const take = Math.min(remainingPool[color], genericAmount);
    remainingPool[color] -= take;
    genericAmount -= take;
  }

  // Tap remaining untapped lands
  for (const land of availableLands) {
    if (genericAmount <= 0) break;
    if (land.used) continue;
    land.used = true;
    landsToTap.push(land.instanceId);
    genericAmount--;
  }

  // ----- Step 4: Check satisfaction -----
  if (genericAmount > 0) return null;

  // Build poolManaUsed from what was consumed
  const poolManaUsed: ManaPool = {
    W: pool.W - remainingPool.W,
    U: pool.U - remainingPool.U,
    B: pool.B - remainingPool.B,
    R: pool.R - remainingPool.R,
    G: pool.G - remainingPool.G,
    C: pool.C - remainingPool.C,
  };

  return { landsToTap, poolManaUsed };
}
