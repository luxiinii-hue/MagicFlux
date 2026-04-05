/**
 * Search/tutor effect tests with PendingPrompt architecture.
 *
 * Tests: search creates prompt, makeChoice completes search,
 * fail-to-find (no selection), getLegalActions shows makeChoice.
 */

import { describe, it, expect } from "vitest";
import type { GameState, CardInstance, SpellAbilitySpell, Effect } from "@magic-flux/types";
import { Phase, ZoneType } from "@magic-flux/types";
import { executeAction, getLegalActions } from "../src/actions.js";
import { advanceToNextPriorityPoint } from "../src/turn/phases.js";
import { twoPlayerGame } from "./helpers.js";
import { handKey, libraryKey } from "../src/zones/transfers.js";

function toMainPhase(state: GameState): GameState {
  const { state: started } = advanceToNextPriorityPoint(state);
  let s = started;
  while (!(s.turnState.phase === Phase.PreCombatMain && s.turnState.step === null)) {
    if (s.priorityPlayerId === null) { s = advanceToNextPriorityPoint(s).state; continue; }
    const r = executeAction(s, { type: "passPriority" });
    if (!r.success) throw new Error(r.error.message);
    s = r.state;
  }
  return s;
}

function makeSearchSpell(state: GameState, id: string, owner: string): GameState {
  const card: CardInstance = {
    instanceId: id, cardDataId: "Demonic Tutor", owner, controller: owner,
    zone: ZoneType.Hand, zoneOwnerId: owner,
    tapped: false, flipped: false, faceDown: false, transformedOrBack: false,
    phasedOut: false, summoningSickness: false, damage: 0, counters: {},
    attachedTo: null, attachments: [],
    abilities: [{
      id: `${id}_spell`, type: "spell", sourceCardInstanceId: id,
      effects: [{
        type: "search",
        zone: ZoneType.Library,
        filter: {},
        player: { type: "controller" },
        then: { type: "drawCards", count: 0, player: { type: "controller" } }, // placeholder
      }],
      zones: [ZoneType.Hand, ZoneType.Stack],
    } satisfies SpellAbilitySpell],
    modifiedPower: null, modifiedToughness: null, currentLoyalty: null,
    castingChoices: null, linkedEffects: {},
  };
  const hKey = handKey(owner);
  return {
    ...state,
    cardInstances: { ...state.cardInstances, [id]: card },
    zones: { ...state.zones, [hKey]: { ...state.zones[hKey], cardInstanceIds: [...state.zones[hKey].cardInstanceIds, id] } },
  };
}

describe("search/tutor with PendingPrompt", () => {
  it("should create a PendingPrompt when search resolves", () => {
    let state = toMainPhase(twoPlayerGame());
    state = makeSearchSpell(state, "tutor1", "p1");

    // Cast the tutor
    let result = executeAction(state, { type: "castSpell", cardInstanceId: "tutor1" });
    expect(result.success).toBe(true);
    state = (result as any).state;

    // Both pass to resolve
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;

    // Should have a pending prompt
    expect(state.pendingPrompt).not.toBeNull();
    expect(state.pendingPrompt!.promptType).toBe("searchLibrary");
    expect(state.pendingPrompt!.playerId).toBe("p1");
    expect(state.pendingPrompt!.options.length).toBeGreaterThan(0);
    expect(state.pendingPrompt!.reveal).toBe(true);
  });

  it("should show only makeChoice in getLegalActions when prompt is pending", () => {
    let state = toMainPhase(twoPlayerGame());
    state = makeSearchSpell(state, "tutor1", "p1");

    let result = executeAction(state, { type: "castSpell", cardInstanceId: "tutor1" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;

    const actions = getLegalActions(state, "p1");
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("makeChoice");
  });

  it("should complete the search when player makes a choice", () => {
    let state = toMainPhase(twoPlayerGame());
    state = makeSearchSpell(state, "tutor1", "p1");

    let result = executeAction(state, { type: "castSpell", cardInstanceId: "tutor1" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;

    const prompt = state.pendingPrompt!;
    const chosenCard = prompt.options[0];
    const handBefore = state.zones[handKey("p1")].cardInstanceIds.length;
    const libBefore = state.zones[libraryKey("p1")].cardInstanceIds.length;

    // Make the choice
    result = executeAction(state, {
      type: "makeChoice",
      choiceId: prompt.promptId,
      selection: chosenCard,
    });
    expect(result.success).toBe(true);
    state = (result as any).state;

    // Prompt should be cleared
    expect(state.pendingPrompt).toBeNull();

    // Card should have moved from library to hand
    expect(state.zones[handKey("p1")].cardInstanceIds.length).toBe(handBefore + 1);
    expect(state.zones[libraryKey("p1")].cardInstanceIds.length).toBe(libBefore - 1);
    expect(state.zones[handKey("p1")].cardInstanceIds).toContain(chosenCard);
  });

  it("should handle fail-to-find (null selection)", () => {
    let state = toMainPhase(twoPlayerGame());
    state = makeSearchSpell(state, "tutor1", "p1");

    let result = executeAction(state, { type: "castSpell", cardInstanceId: "tutor1" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;

    const prompt = state.pendingPrompt!;
    const libBefore = state.zones[libraryKey("p1")].cardInstanceIds.length;

    // Fail to find (null selection)
    result = executeAction(state, {
      type: "makeChoice",
      choiceId: prompt.promptId,
      selection: null,
    });
    expect(result.success).toBe(true);
    state = (result as any).state;

    // Prompt cleared, library unchanged
    expect(state.pendingPrompt).toBeNull();
    expect(state.zones[libraryKey("p1")].cardInstanceIds.length).toBe(libBefore);
  });
});
