import { describe, it, expect } from "vitest";
import { Phase, Step } from "@magic-flux/types";
import { executeAction, getLegalActions } from "../src/actions.js";
import { advanceToNextPriorityPoint } from "../src/turn/phases.js";
import { twoPlayerGame } from "./helpers.js";
import { handKey } from "../src/zones/transfers.js";
import { createGame } from "../src/game.js";
import { basicLandDeck, mixedLandDeck } from "./helpers.js";

describe("playLand", () => {
  /** Advance to main phase 1 for the active player. */
  function advanceToMain1(seed: number = 42) {
    let state = twoPlayerGame(seed);
    const { state: started } = advanceToNextPriorityPoint(state);
    state = started;

    // Pass through upkeep, draw to reach PreCombatMain
    while (
      !(state.turnState.phase === Phase.PreCombatMain && state.turnState.step === null)
    ) {
      if (state.priorityPlayerId === null) {
        const adv = advanceToNextPriorityPoint(state);
        state = adv.state;
        continue;
      }
      const result = executeAction(state, { type: "passPriority" });
      if (!result.success) throw new Error(result.error.message);
      state = result.state;
    }

    return state;
  }

  it("should allow playing a land during main phase", () => {
    const state = advanceToMain1();

    // p1 has priority, is active player, main phase, stack empty
    expect(state.priorityPlayerId).toBe("p1");
    expect(state.turnState.phase).toBe(Phase.PreCombatMain);

    // Find a Plains in hand
    const hand = state.zones[handKey("p1")];
    const landId = hand.cardInstanceIds[0];

    const result = executeAction(state, {
      type: "playLand",
      cardInstanceId: landId,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      // Card moved from hand to battlefield
      const newHand = result.state.zones[handKey("p1")];
      expect(newHand.cardInstanceIds).not.toContain(landId);

      const battlefield = result.state.zones["battlefield"];
      expect(battlefield.cardInstanceIds).toContain(landId);

      // Player's landsPlayedThisTurn incremented
      const p1 = result.state.players.find((p) => p.id === "p1")!;
      expect(p1.landsPlayedThisTurn).toBe(1);
    }
  });

  it("should not allow playing a second land", () => {
    let state = advanceToMain1();

    // Play first land
    const hand = state.zones[handKey("p1")];
    const landId1 = hand.cardInstanceIds[0];
    const result1 = executeAction(state, {
      type: "playLand",
      cardInstanceId: landId1,
    });
    expect(result1.success).toBe(true);
    state = result1.success ? result1.state : state;

    // Try to play second land
    const newHand = state.zones[handKey("p1")];
    const landId2 = newHand.cardInstanceIds[0];
    const result2 = executeAction(state, {
      type: "playLand",
      cardInstanceId: landId2,
    });

    expect(result2.success).toBe(false);
    if (!result2.success) {
      expect(result2.error.code).toBe("LAND_LIMIT_REACHED");
    }
  });

  it("should not allow playing a land during combat", () => {
    let state = advanceToMain1();

    // Advance past main to combat
    while (state.turnState.phase !== Phase.Combat) {
      if (state.priorityPlayerId === null) {
        const adv = advanceToNextPriorityPoint(state);
        state = adv.state;
        continue;
      }
      const result = executeAction(state, { type: "passPriority" });
      if (!result.success) break;
      state = result.state;
    }

    const hand = state.zones[handKey("p1")];
    if (hand.cardInstanceIds.length > 0) {
      const result = executeAction(state, {
        type: "playLand",
        cardInstanceId: hand.cardInstanceIds[0],
      });
      expect(result.success).toBe(false);
    }
  });
});

describe("mana abilities", () => {
  function advanceToMain1() {
    let state = twoPlayerGame();
    const { state: started } = advanceToNextPriorityPoint(state);
    state = started;

    while (
      !(state.turnState.phase === Phase.PreCombatMain && state.turnState.step === null)
    ) {
      if (state.priorityPlayerId === null) {
        const adv = advanceToNextPriorityPoint(state);
        state = adv.state;
        continue;
      }
      const result = executeAction(state, { type: "passPriority" });
      if (!result.success) throw new Error(result.error.message);
      state = result.state;
    }
    return state;
  }

  it("should allow tapping a land for mana after playing it", () => {
    let state = advanceToMain1();

    // Play a Plains
    const hand = state.zones[handKey("p1")];
    const landId = hand.cardInstanceIds[0];
    let result = executeAction(state, {
      type: "playLand",
      cardInstanceId: landId,
    });
    expect(result.success).toBe(true);
    state = result.success ? result.state : state;

    // Tap for white mana
    result = executeAction(state, {
      type: "activateAbility",
      cardInstanceId: landId,
      abilityId: "mana",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const p1 = result.state.players.find((p) => p.id === "p1")!;
      expect(p1.manaPool.W).toBe(1);

      // Land should be tapped
      const land = result.state.cardInstances[landId];
      expect(land.tapped).toBe(true);
    }
  });

  it("should not allow tapping an already tapped land", () => {
    let state = advanceToMain1();

    // Play and tap
    const hand = state.zones[handKey("p1")];
    const landId = hand.cardInstanceIds[0];
    let result = executeAction(state, { type: "playLand", cardInstanceId: landId });
    state = result.success ? result.state : state;

    result = executeAction(state, {
      type: "activateAbility",
      cardInstanceId: landId,
      abilityId: "mana",
    });
    state = result.success ? result.state : state;

    // Try tapping again
    result = executeAction(state, {
      type: "activateAbility",
      cardInstanceId: landId,
      abilityId: "mana",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("ALREADY_TAPPED");
    }
  });

  it("should empty mana pools on phase transition", () => {
    let state = advanceToMain1();

    // Play a land and tap for mana
    const hand = state.zones[handKey("p1")];
    const landId = hand.cardInstanceIds[0];
    let result = executeAction(state, { type: "playLand", cardInstanceId: landId });
    state = result.success ? result.state : state;
    result = executeAction(state, {
      type: "activateAbility",
      cardInstanceId: landId,
      abilityId: "mana",
    });
    state = result.success ? result.state : state;

    // Verify mana is in pool
    let p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.manaPool.W).toBe(1);

    // Pass through to next phase (both players pass)
    result = executeAction(state, { type: "passPriority" });
    state = result.success ? result.state : state;
    result = executeAction(state, { type: "passPriority" });
    state = result.success ? result.state : state;

    // Mana should be emptied
    p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.manaPool.W).toBe(0);
  });
});

describe("getLegalActions", () => {
  function advanceToMain1() {
    let state = twoPlayerGame();
    const { state: started } = advanceToNextPriorityPoint(state);
    state = started;

    while (
      !(state.turnState.phase === Phase.PreCombatMain && state.turnState.step === null)
    ) {
      if (state.priorityPlayerId === null) {
        const adv = advanceToNextPriorityPoint(state);
        state = adv.state;
        continue;
      }
      const result = executeAction(state, { type: "passPriority" });
      if (!result.success) throw new Error(result.error.message);
      state = result.state;
    }
    return state;
  }

  it("should include passPriority and concede when player has priority", () => {
    const { state } = advanceToNextPriorityPoint(twoPlayerGame());
    const actions = getLegalActions(state, "p1");

    expect(actions.some((a) => a.type === "passPriority")).toBe(true);
    expect(actions.some((a) => a.type === "concede")).toBe(true);
  });

  it("should include playLand during main phase", () => {
    const state = advanceToMain1();
    const actions = getLegalActions(state, "p1");

    expect(actions.some((a) => a.type === "playLand")).toBe(true);
  });

  it("should return empty array for player without priority", () => {
    const { state } = advanceToNextPriorityPoint(twoPlayerGame());
    const actions = getLegalActions(state, "p2"); // p2 doesn't have priority

    expect(actions).toHaveLength(0);
  });
});

describe("concede", () => {
  it("should mark the conceding player as lost", () => {
    const { state } = advanceToNextPriorityPoint(twoPlayerGame());
    const result = executeAction(state, { type: "concede" });

    expect(result.success).toBe(true);
    if (result.success) {
      const p1 = result.state.players.find((p) => p.id === "p1")!;
      expect(p1.hasLost).toBe(true);
      expect(p1.hasConceded).toBe(true);
      expect(result.state.gameOver).toBe(true);
      expect(result.state.winners).toEqual(["p2"]);
    }
  });
});
