/**
 * Mana payment — executing a ManaPaymentPlan.
 *
 * Activates mana abilities in the plan, then deducts mana from the pool
 * to cover each symbol in the cost.
 */

import type {
  GameState,
  GameEvent,
  ManaPaymentPlan,
  ManaCost,
  ManaColor,
  ManaPool,
  CardInstance,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { addManaToPlayer, getPlayer } from "./pool.js";

const BASIC_LAND_MANA: Record<string, ManaColor> = {
  Plains: "W",
  Island: "U",
  Swamp: "B",
  Mountain: "R",
  Forest: "G",
};

/**
 * Execute a mana payment plan:
 * 1. Activate any mana abilities listed in the plan (tap lands, etc.)
 * 2. Deduct mana from the pool based on poolPayments mapping
 */
export function payManaCost(
  state: GameState,
  playerId: string,
  cost: ManaCost,
  payment: ManaPaymentPlan,
): { state: GameState; events: GameEvent[] } {
  let currentState = state;
  const allEvents: GameEvent[] = [];

  // 1. Activate mana abilities
  for (const activation of payment.manaAbilitiesToActivate) {
    const card = currentState.cardInstances[activation.cardInstanceId];
    if (!card || card.tapped || card.zone !== ZoneType.Battlefield) continue;

    // Tap the permanent
    const tappedCard: CardInstance = { ...card, tapped: true };
    currentState = {
      ...currentState,
      cardInstances: {
        ...currentState.cardInstances,
        [activation.cardInstanceId]: tappedCard,
      },
    };
    allEvents.push({
      type: "cardTapped",
      cardInstanceId: activation.cardInstanceId,
      timestamp: Date.now(),
    });

    // Determine mana produced (Phase 2: basic lands)
    const manaColor = BASIC_LAND_MANA[card.cardDataId];
    if (manaColor) {
      const manaResult = addManaToPlayer(currentState, playerId, manaColor, 1, Date.now());
      currentState = manaResult.state;
      allEvents.push(...manaResult.events);
    }
  }

  // 2. Deduct mana from pool based on payment mapping
  const player = getPlayer(currentState, playerId);
  const pool = { ...player.manaPool };

  for (let i = 0; i < cost.symbols.length; i++) {
    const sym = cost.symbols[i];

    // Check for Phyrexian life payment
    if (payment.phyrexianLifePayments.includes(i)) {
      // Pay 2 life instead of mana
      const updatedPlayers = currentState.players.map((p) =>
        p.id === playerId ? { ...p, life: p.life - 2 } : p,
      );
      currentState = { ...currentState, players: updatedPlayers };
      continue;
    }

    const colorUsed = payment.poolPayments[i];
    if (colorUsed && pool[colorUsed] > 0) {
      pool[colorUsed]--;
    } else if (sym.type === "colored" && pool[sym.color] > 0) {
      pool[sym.color]--;
    } else if (sym.type === "colorless" && pool.C > 0) {
      pool.C--;
    } else if (sym.type === "generic") {
      // Deduct generic from whatever's available
      let remaining = sym.amount;
      for (const color of ["C", "W", "U", "B", "R", "G"] as ManaColor[]) {
        const take = Math.min(remaining, pool[color]);
        pool[color] -= take;
        remaining -= take;
        if (remaining === 0) break;
      }
    }
  }

  // Apply the deducted pool
  const updatedPlayers = currentState.players.map((p) =>
    p.id === playerId
      ? { ...p, manaPool: { W: pool.W, U: pool.U, B: pool.B, R: pool.R, G: pool.G, C: pool.C } }
      : p,
  );
  currentState = { ...currentState, players: updatedPlayers };

  return { state: currentState, events: allEvents };
}
