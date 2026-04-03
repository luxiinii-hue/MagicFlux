import { describe, it, expect } from "vitest";
import { Phase, Step } from "@magic-flux/types";
import { executeAction, getLegalActions } from "../src/actions.js";
import { advancePhase, advanceToNextPriorityPoint } from "../src/turn/phases.js";
import { twoPlayerGame } from "./helpers.js";
import { handKey, libraryKey } from "../src/zones/transfers.js";

describe("turn structure", () => {
  /** Helper: advance from untap (no priority) to the first priority point. */
  function startGame() {
    const state = twoPlayerGame();
    // Game starts at Untap (no priority). Advance to first priority point.
    return advanceToNextPriorityPoint(state);
  }

  it("should advance from untap to upkeep (first priority point)", () => {
    const { state } = startGame();

    expect(state.turnState.phase).toBe(Phase.Beginning);
    expect(state.turnState.step).toBe(Step.Upkeep);
    expect(state.priorityPlayerId).toBe("p1");
  });

  it("should advance through all phases when both players keep passing", () => {
    let { state } = startGame();
    const phases: string[] = [];

    // Pass priority through the entire turn
    for (let i = 0; i < 100; i++) {
      if (state.gameOver) break;

      phases.push(`${state.turnState.phase}:${state.turnState.step ?? "main"}`);

      if (state.priorityPlayerId === null) {
        const advance = advanceToNextPriorityPoint(state);
        state = advance.state;
        continue;
      }

      // Both players pass
      let result = executeAction(state, { type: "passPriority" });
      if (!result.success) break;
      state = result.state;

      // Second player also passes if they have priority
      if (state.priorityPlayerId !== null) {
        result = executeAction(state, { type: "passPriority" });
        if (!result.success) break;
        state = result.state;
      }
    }

    // Should have seen upkeep, draw, main1, combat phases, main2, end step
    expect(phases).toContain("Beginning:Upkeep");
    expect(phases).toContain("Beginning:Draw");
    expect(phases).toContain("PreCombatMain:main");
    expect(phases).toContain("Combat:BeginningOfCombat");
    expect(phases).toContain("PostCombatMain:main");
    expect(phases).toContain("Ending:EndStep");
  });

  it("should transition to turn 2 after all phases of turn 1", () => {
    let { state } = startGame();

    // Pass through entire turn 1
    for (let i = 0; i < 200; i++) {
      if (state.turnNumber > 1) break;

      if (state.priorityPlayerId === null) {
        const advance = advanceToNextPriorityPoint(state);
        state = advance.state;
        continue;
      }

      const result = executeAction(state, { type: "passPriority" });
      if (!result.success) break;
      state = result.state;
    }

    expect(state.turnNumber).toBe(2);
    expect(state.activePlayerId).toBe("p2");
  });

  it("should skip draw on turn 1 for first player in 2-player game", () => {
    let { state } = startGame();
    const p1HandBefore = state.zones[handKey("p1")].cardInstanceIds.length;

    // We're at upkeep. Pass through upkeep (both pass) to reach draw step.
    let result = executeAction(state, { type: "passPriority" }); // p1 passes
    state = result.success ? result.state : state;
    result = executeAction(state, { type: "passPriority" }); // p2 passes
    state = result.success ? result.state : state;

    // Should now be at draw step; draw was skipped on turn 1
    const p1HandAfter = state.zones[handKey("p1")].cardInstanceIds.length;
    expect(p1HandAfter).toBe(p1HandBefore); // No card drawn
  });

  it("should draw a card on turn 2 draw step", () => {
    let { state } = startGame();

    // Pass through all of turn 1
    for (let i = 0; i < 200; i++) {
      if (state.turnNumber > 1) break;
      if (state.priorityPlayerId === null) {
        const advance = advanceToNextPriorityPoint(state);
        state = advance.state;
        continue;
      }
      const result = executeAction(state, { type: "passPriority" });
      if (!result.success) break;
      state = result.state;
    }

    // Now on turn 2, at upkeep (first priority point after untap)
    expect(state.turnNumber).toBe(2);
    expect(state.activePlayerId).toBe("p2");

    const p2LibBefore = state.zones[libraryKey("p2")].cardInstanceIds.length;
    const p2HandBefore = state.zones[handKey("p2")].cardInstanceIds.length;

    // Pass through upkeep to get to draw
    let result = executeAction(state, { type: "passPriority" }); // p2 passes (active has priority first)
    state = result.success ? result.state : state;
    result = executeAction(state, { type: "passPriority" }); // p1 passes
    state = result.success ? result.state : state;

    // Should have drawn a card at draw step
    const p2LibAfter = state.zones[libraryKey("p2")].cardInstanceIds.length;
    const p2HandAfter = state.zones[handKey("p2")].cardInstanceIds.length;

    expect(p2LibAfter).toBe(p2LibBefore - 1);
    expect(p2HandAfter).toBe(p2HandBefore + 1);
  });
});

describe("priority", () => {
  function startGame() {
    const state = twoPlayerGame();
    return advanceToNextPriorityPoint(state);
  }

  it("should grant priority to active player first", () => {
    const { state } = startGame();
    expect(state.priorityPlayerId).toBe("p1"); // p1 is active
  });

  it("should pass priority to the next player", () => {
    const { state } = startGame();
    const result = executeAction(state, { type: "passPriority" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.state.priorityPlayerId).toBe("p2");
    }
  });

  it("should advance when all players pass on empty stack", () => {
    let { state } = startGame();
    // At upkeep. Both pass.
    let result = executeAction(state, { type: "passPriority" });
    state = result.success ? result.state : state;
    result = executeAction(state, { type: "passPriority" });
    state = result.success ? result.state : state;

    // Should have advanced past upkeep
    const stillUpkeep =
      state.turnState.phase === Phase.Beginning &&
      state.turnState.step === Step.Upkeep;
    expect(stillUpkeep).toBe(false);
  });
});
