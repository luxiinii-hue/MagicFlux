/**
 * Kicker mechanic tests.
 *
 * Kicker is an optional additional cost. When paid, the spell has
 * enhanced effects. Uses the conditional effect handler with a
 * custom condition checking CastingChoices.kickerPaid.
 */

import { describe, it, expect } from "vitest";
import type { GameState, CardInstance, SpellAbilitySpell, Effect } from "@magic-flux/types";
import { Phase, ZoneType } from "@magic-flux/types";
import { executeAction } from "../src/actions.js";
import { advanceToNextPriorityPoint } from "../src/turn/phases.js";
import { twoPlayerGame } from "./helpers.js";
import { handKey } from "../src/zones/transfers.js";

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

function makeKickerSpell(state: GameState): GameState {
  // Burst Lightning style: {R} deal 2 damage. Kicker {4}: deal 4 instead.
  // Modeled as: base effect deals 2, conditional checks kickerPaid for +2 more.
  const card: CardInstance = {
    instanceId: "burst1",
    cardDataId: "Burst Lightning",
    owner: "p1",
    controller: "p1",
    zone: ZoneType.Hand,
    zoneOwnerId: "p1",
    tapped: false, flipped: false, faceDown: false, transformedOrBack: false,
    phasedOut: false, summoningSickness: false, damage: 0, counters: {},
    attachedTo: null, attachments: [],
    abilities: [{
      id: "burst_spell",
      type: "spell",
      sourceCardInstanceId: "burst1",
      effects: [
        // Always deal 2
        { type: "dealDamage", amount: 2, to: { targetRequirementId: "t1" } },
        // If kicked, deal 2 more
        {
          type: "conditional",
          condition: { type: "custom", predicateFunction: "kickerPaid" },
          thenEffects: [
            { type: "dealDamage", amount: 2, to: { targetRequirementId: "t1" } },
          ],
        },
      ],
      zones: [ZoneType.Hand, ZoneType.Stack],
    } satisfies SpellAbilitySpell],
    modifiedPower: null, modifiedToughness: null, currentLoyalty: null,
    castingChoices: null, linkedEffects: {},
  };

  const hKey = handKey("p1");
  return {
    ...state,
    cardInstances: { ...state.cardInstances, burst1: card },
    zones: { ...state.zones, [hKey]: { ...state.zones[hKey], cardInstanceIds: [...state.zones[hKey].cardInstanceIds, "burst1"] } },
  };
}

describe("kicker mechanic", () => {
  it("should deal base damage without kicker", () => {
    let state = toMainPhase(twoPlayerGame());
    state = makeKickerSpell(state);

    // Cast without kicker
    let result = executeAction(state, {
      type: "castSpell",
      cardInstanceId: "burst1",
      targets: [{ requirementId: "t1", targetId: "p2", targetType: "player" }],
      choices: {
        xValue: null,
        kickerPaid: false,
        additionalKickersPaid: [],
        chosenModes: [],
        alternativeCostUsed: null,
      },
    });
    expect(result.success).toBe(true);
    state = (result as any).state;

    // Both pass to resolve
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;

    // Only 2 damage — kicker not paid, conditional branch skipped
    const p2 = state.players.find((p) => p.id === "p2")!;
    expect(p2.life).toBe(18); // 20 - 2 base damage only
  });

  it("should deal enhanced damage with kicker paid", () => {
    let state = toMainPhase(twoPlayerGame());
    state = makeKickerSpell(state);

    // Cast with kicker
    let result = executeAction(state, {
      type: "castSpell",
      cardInstanceId: "burst1",
      targets: [{ requirementId: "t1", targetId: "p2", targetType: "player" }],
      choices: {
        xValue: null,
        kickerPaid: true,
        additionalKickersPaid: [],
        chosenModes: [],
        alternativeCostUsed: null,
      },
    });
    expect(result.success).toBe(true);
    state = (result as any).state;

    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;

    // With kicker: 2 base + 2 kicker = 4 damage
    const p2 = state.players.find((p) => p.id === "p2")!;
    expect(p2.life).toBe(16); // 20 - 4
  });
});
