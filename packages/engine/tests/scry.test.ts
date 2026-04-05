/**
 * Scry tests with PendingPrompt.
 *
 * Tests: scry creates prompt, player bottoms selected cards,
 * player keeps all on top, scry 1 with single card.
 */

import { describe, it, expect } from "vitest";
import type { GameState, CardInstance, SpellAbilitySpell } from "@magic-flux/types";
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

function makeScrySpell(state: GameState, id: string, owner: string, scryCount: number): GameState {
  const card: CardInstance = {
    instanceId: id, cardDataId: `Scry ${scryCount} Spell`, owner, controller: owner,
    zone: ZoneType.Hand, zoneOwnerId: owner,
    tapped: false, flipped: false, faceDown: false, transformedOrBack: false,
    phasedOut: false, summoningSickness: false, damage: 0, counters: {},
    attachedTo: null, attachments: [],
    abilities: [{
      id: `${id}_spell`, type: "spell", sourceCardInstanceId: id,
      effects: [
        { type: "drawCards", count: 1, player: { type: "controller" } },
        { type: "custom", resolveFunction: `scry_${scryCount}` },
      ],
      zones: [ZoneType.Hand, ZoneType.Stack],
    } satisfies SpellAbilitySpell],
    modifiedPower: null, modifiedToughness: null,
    basePower: null, baseToughness: null,
    currentLoyalty: null, castingChoices: null, linkedEffects: {},
  };
  const hKey = handKey(owner);
  return {
    ...state,
    cardInstances: { ...state.cardInstances, [id]: card },
    zones: { ...state.zones, [hKey]: { ...state.zones[hKey], cardInstanceIds: [...state.zones[hKey].cardInstanceIds, id] } },
  };
}

describe("scry with PendingPrompt", () => {
  it("should create a scry prompt showing top N cards", () => {
    let state = toMainPhase(twoPlayerGame());
    state = makeScrySpell(state, "opt1", "p1", 1);

    // Cast the spell
    let result = executeAction(state, { type: "castSpell", cardInstanceId: "opt1" });
    state = (result as any).state;

    // Both pass to resolve
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;

    // Should have a scry prompt
    expect(state.pendingPrompt).not.toBeNull();
    expect(state.pendingPrompt!.promptType).toBe("scry");
    expect(state.pendingPrompt!.playerId).toBe("p1");
    expect(state.pendingPrompt!.options.length).toBe(1);
    expect(state.pendingPrompt!.reveal).toBe(false); // Scry is private
  });

  it("should put selected cards on bottom when player responds", () => {
    let state = toMainPhase(twoPlayerGame());
    state = makeScrySpell(state, "preordain1", "p1", 2);

    // Note the top 2 cards of library before scry
    const libBefore = state.zones[libraryKey("p1")].cardInstanceIds;

    // Cast and resolve
    let result = executeAction(state, { type: "castSpell", cardInstanceId: "preordain1" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;

    const prompt = state.pendingPrompt!;
    expect(prompt.options.length).toBe(2);

    // Put the first card on bottom, keep the second on top
    const cardToBottom = prompt.options[0];
    const cardOnTop = prompt.options[1];

    result = executeAction(state, {
      type: "makeChoice",
      choiceId: prompt.promptId,
      selection: [cardToBottom],
    });
    expect(result.success).toBe(true);
    state = (result as any).state;

    // Prompt cleared
    expect(state.pendingPrompt).toBeNull();

    // The bottomed card should be at the end of the library
    const libAfter = state.zones[libraryKey("p1")].cardInstanceIds;
    expect(libAfter[libAfter.length - 1]).toBe(cardToBottom);

    // The kept card should be on top (first in array, after any cards drawn)
    // Note: the spell also draws 1 card, so the library shifted
    expect(libAfter[0]).toBe(cardOnTop);
  });

  it("should keep all on top when player selects nothing for bottom", () => {
    let state = toMainPhase(twoPlayerGame());
    state = makeScrySpell(state, "scry_spell", "p1", 2);

    let result = executeAction(state, { type: "castSpell", cardInstanceId: "scry_spell" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;

    const prompt = state.pendingPrompt!;
    const topCards = [...prompt.options];

    // Keep all on top (empty selection for bottom)
    result = executeAction(state, {
      type: "makeChoice",
      choiceId: prompt.promptId,
      selection: [],
    });
    state = (result as any).state;

    // Both cards should still be at the top of library (after the draw shifted things)
    const lib = state.zones[libraryKey("p1")].cardInstanceIds;
    expect(lib[0]).toBe(topCards[0]);
    expect(lib[1]).toBe(topCards[1]);
  });

  it("should show only makeChoice during scry prompt", () => {
    let state = toMainPhase(twoPlayerGame());
    state = makeScrySpell(state, "opt1", "p1", 1);

    let result = executeAction(state, { type: "castSpell", cardInstanceId: "opt1" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;

    const actions = getLegalActions(state, "p1");
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("makeChoice");
  });
});
