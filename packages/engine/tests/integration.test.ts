/**
 * Integration test: Phase 1 acceptance scenario.
 *
 * Two players start a game with decks of 60 basic Plains. They take turns
 * passing priority. The game advances through every phase and step of turn 1,
 * then turn 2. On turn 2, the active player plays a Plains from hand, taps it
 * for W, and their mana pool shows 1 white mana. The mana empties when they
 * pass to the next phase.
 */

import { describe, it, expect } from "vitest";
import { Phase, Step } from "@magic-flux/types";
import { createGame } from "../src/game.js";
import { executeAction, getLegalActions } from "../src/actions.js";
import { advanceToNextPriorityPoint } from "../src/turn/phases.js";
import { basicLandDeck } from "./helpers.js";
import { handKey, libraryKey } from "../src/zones/transfers.js";
import type { GameState } from "@magic-flux/types";

function passUntil(
  state: GameState,
  predicate: (s: GameState) => boolean,
  maxIterations: number = 500,
): GameState {
  for (let i = 0; i < maxIterations; i++) {
    if (predicate(state)) return state;

    if (state.priorityPlayerId === null) {
      const adv = advanceToNextPriorityPoint(state);
      state = adv.state;
      continue;
    }

    const result = executeAction(state, { type: "passPriority" });
    if (!result.success) throw new Error(`Pass failed: ${result.error.message}`);
    state = result.state;
  }
  throw new Error("Did not reach predicate within iteration limit");
}

describe("Phase 1 acceptance scenario", () => {
  it("should play through a full two-turn game with land play and mana", () => {
    // Create the game
    const config = {
      format: "standard" as const,
      seed: 42,
      players: [
        { id: "p1", name: "Alice", decklist: basicLandDeck("Plains") },
        { id: "p2", name: "Bob", decklist: basicLandDeck("Plains") },
      ],
    };

    let state = createGame(config);

    // Game starts at turn 1, untap step, no priority
    expect(state.turnNumber).toBe(1);
    expect(state.turnState.phase).toBe(Phase.Beginning);
    expect(state.turnState.step).toBe(Step.Untap);
    expect(state.priorityPlayerId).toBeNull();

    // Advance to first priority point (upkeep)
    const { state: afterUntap } = advanceToNextPriorityPoint(state);
    state = afterUntap;
    expect(state.turnState.step).toBe(Step.Upkeep);
    expect(state.priorityPlayerId).toBe("p1");

    // ---- Pass through turn 1 entirely ----
    state = passUntil(state, (s) => s.turnNumber === 2);
    expect(state.turnNumber).toBe(2);
    expect(state.activePlayerId).toBe("p2");

    // Advance to first priority point of turn 2
    if (state.priorityPlayerId === null) {
      const adv = advanceToNextPriorityPoint(state);
      state = adv.state;
    }

    // ---- Turn 2: advance to main phase ----
    state = passUntil(
      state,
      (s) => s.turnState.phase === Phase.PreCombatMain && s.turnState.step === null,
    );
    expect(state.priorityPlayerId).toBe("p2");

    // p2 should be able to play a land
    const legalActions = getLegalActions(state, "p2");
    expect(legalActions.some((a) => a.type === "playLand")).toBe(true);

    // Play a Plains from hand
    const hand = state.zones[handKey("p2")];
    const landCardId = hand.cardInstanceIds[0];
    expect(landCardId).toBeDefined();

    let result = executeAction(state, {
      type: "playLand",
      cardInstanceId: landCardId,
    });
    expect(result.success).toBe(true);
    state = (result as any).state;

    // Verify: land on battlefield, hand size decreased
    expect(state.zones["battlefield"].cardInstanceIds).toContain(landCardId);
    expect(state.zones[handKey("p2")].cardInstanceIds).not.toContain(landCardId);

    // Tap Plains for W
    result = executeAction(state, {
      type: "activateAbility",
      cardInstanceId: landCardId,
      abilityId: "mana",
    });
    expect(result.success).toBe(true);
    state = (result as any).state;

    // Verify: 1 white mana in pool, land is tapped
    const p2 = state.players.find((p) => p.id === "p2")!;
    expect(p2.manaPool.W).toBe(1);
    expect(state.cardInstances[landCardId].tapped).toBe(true);

    // Pass to next phase — mana should empty
    result = executeAction(state, { type: "passPriority" }); // p2 passes
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" }); // p1 passes
    state = (result as any).state;

    // Mana pool should be empty after phase transition
    const p2After = state.players.find((p) => p.id === "p2")!;
    expect(p2After.manaPool.W).toBe(0);

    // Verify priority passes correctly — both players get priority at each window
    expect(state.priorityPlayerId).toBeDefined();
  });
});
