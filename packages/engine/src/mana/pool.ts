/**
 * Mana pool operations.
 *
 * Add mana, empty pools, check if a cost can be paid from the current pool.
 * Phase 1: only pool-based checks (no mana ability lookahead).
 */

import type {
  ManaPool,
  ManaColor,
  ManaCost,
  ManaSymbol,
  GameState,
  Player,
  GameEvent,
} from "@magic-flux/types";

export const EMPTY_MANA_POOL: ManaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

const COLORS: readonly ManaColor[] = ["W", "U", "B", "R", "G", "C"];

// ---------------------------------------------------------------------------
// Pool arithmetic
// ---------------------------------------------------------------------------

/** Add mana to a pool. Returns a new pool. */
export function addMana(pool: ManaPool, color: ManaColor, amount: number = 1): ManaPool {
  return { ...pool, [color]: pool[color] + amount };
}

/** Add a full ManaPool to another. */
export function addManaPool(pool: ManaPool, addition: ManaPool): ManaPool {
  return {
    W: pool.W + addition.W,
    U: pool.U + addition.U,
    B: pool.B + addition.B,
    R: pool.R + addition.R,
    G: pool.G + addition.G,
    C: pool.C + addition.C,
  };
}

/** Total mana in a pool. */
export function totalMana(pool: ManaPool): number {
  return pool.W + pool.U + pool.B + pool.R + pool.G + pool.C;
}

// ---------------------------------------------------------------------------
// Cost checking (Phase 1: pool only, no mana abilities)
// ---------------------------------------------------------------------------

/**
 * Check whether a player's current mana pool can pay a ManaCost.
 *
 * Algorithm: first satisfy colored requirements, then check if remaining
 * pool covers generic costs.
 */
export function canPayCost(pool: ManaPool, cost: ManaCost): boolean {
  const remaining = { ...pool };

  // Pay colored and colorless symbols first
  for (const sym of cost.symbols) {
    if (sym.type === "colored") {
      if (remaining[sym.color] <= 0) return false;
      remaining[sym.color]--;
    } else if (sym.type === "colorless") {
      // Specifically colorless mana ({C})
      if (remaining.C <= 0) return false;
      remaining.C--;
    }
    // Generic, X, hybrid, phyrexian handled below
  }

  // Sum remaining generic costs
  let genericNeeded = 0;
  for (const sym of cost.symbols) {
    if (sym.type === "generic") {
      genericNeeded += sym.amount;
    }
  }

  // Check if remaining pool covers generic
  const remainingTotal = COLORS.reduce((sum, c) => sum + remaining[c], 0);
  return remainingTotal >= genericNeeded;
}

// ---------------------------------------------------------------------------
// State-level mana operations
// ---------------------------------------------------------------------------

/** Add mana to a player's pool in the game state. */
export function addManaToPlayer(
  state: GameState,
  playerId: string,
  color: ManaColor,
  amount: number,
  eventTimestamp: number,
): { state: GameState; events: GameEvent[] } {
  const updatedPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, manaPool: addMana(p.manaPool, color, amount) } : p,
  );

  const manaAdded: ManaPool = { ...EMPTY_MANA_POOL, [color]: amount };

  const events: GameEvent[] = [
    {
      type: "manaAdded",
      playerId,
      mana: manaAdded,
      timestamp: eventTimestamp,
    },
  ];

  return {
    state: { ...state, players: updatedPlayers },
    events,
  };
}

/** Empty a specific player's mana pool. */
export function emptyPlayerManaPool(state: GameState, playerId: string): GameState {
  const updatedPlayers = state.players.map((p) =>
    p.id === playerId ? { ...p, manaPool: EMPTY_MANA_POOL } : p,
  );
  return { ...state, players: updatedPlayers };
}

/** Get a player from game state. */
export function getPlayer(state: GameState, playerId: string): Player {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`Player ${playerId} not found`);
  return player;
}
