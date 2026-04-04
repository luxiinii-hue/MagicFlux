/**
 * Tests for forEach, conditional, and custom (board wipe) effects.
 */

import { describe, it, expect } from "vitest";
import type { GameState, CardInstance, SpellAbilitySpell, Effect } from "@magic-flux/types";
import { Phase, ZoneType } from "@magic-flux/types";
import { executeAction } from "../src/actions.js";
import { advanceToNextPriorityPoint } from "../src/turn/phases.js";
import { twoPlayerGame } from "./helpers.js";
import { makeCreature, placeOnBattlefield } from "./combat-helpers.js";
import { handKey } from "../src/zones/transfers.js";

function makeSpellInHand(state: GameState, id: string, name: string, owner: string, effects: Effect[]): GameState {
  const card: CardInstance = {
    instanceId: id, cardDataId: name, owner, controller: owner,
    zone: ZoneType.Hand, zoneOwnerId: owner,
    tapped: false, flipped: false, faceDown: false, transformedOrBack: false,
    phasedOut: false, summoningSickness: false, damage: 0, counters: {},
    attachedTo: null, attachments: [],
    abilities: [{
      id: `${id}_spell`, type: "spell", sourceCardInstanceId: id,
      effects, zones: [ZoneType.Hand, ZoneType.Stack],
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

function castAndResolve(state: GameState, cardId: string, targets: any[] = []): GameState {
  let result = executeAction(state, { type: "castSpell", cardInstanceId: cardId, targets });
  if (!result.success) throw new Error(`Cast failed: ${result.error.message}`);
  let s = result.state;
  result = executeAction(s, { type: "passPriority" });
  s = (result as any).state;
  result = executeAction(s, { type: "passPriority" });
  return (result as any).state;
}

describe("custom: destroy_all_creatures (Wrath of God)", () => {
  it("should destroy all creatures on the battlefield", () => {
    let state = toMainPhase(twoPlayerGame());

    // Place creatures for both players
    state = placeOnBattlefield(state, makeCreature("cr1", "Bear 1", "p1", 2, 2));
    state = placeOnBattlefield(state, makeCreature("cr2", "Bear 2", "p1", 2, 2));
    state = placeOnBattlefield(state, makeCreature("cr3", "Bear 3", "p2", 2, 2));

    // Cast Wrath of God
    state = makeSpellInHand(state, "wrath", "Wrath of God", "p1", [
      { type: "custom", resolveFunction: "destroy_all_creatures" },
    ]);

    state = castAndResolve(state, "wrath");

    // All creatures should be in graveyards
    expect(state.cardInstances["cr1"].zone).toBe(ZoneType.Graveyard);
    expect(state.cardInstances["cr2"].zone).toBe(ZoneType.Graveyard);
    expect(state.cardInstances["cr3"].zone).toBe(ZoneType.Graveyard);

    // Battlefield should have no creatures
    const bf = state.zones["battlefield"];
    const creatures = bf.cardInstanceIds.filter((id) =>
      state.cardInstances[id]?.modifiedPower !== null
    );
    expect(creatures).toHaveLength(0);
  });
});

describe("conditional effect", () => {
  it("should resolve thenEffects when condition is met", () => {
    let state = toMainPhase(twoPlayerGame());

    // Place a creature so controlsPermanent is true
    state = placeOnBattlefield(state, makeCreature("cr1", "Bear", "p1", 2, 2));

    state = makeSpellInHand(state, "cond1", "Conditional Spell", "p1", [
      {
        type: "conditional",
        condition: { type: "controlsPermanent", filter: {} },
        thenEffects: [{ type: "gainLife", amount: 5, player: { type: "controller" } }],
        elseEffects: [{ type: "loseLife", amount: 5, player: { type: "controller" } }],
      },
    ]);

    state = castAndResolve(state, "cond1");

    // Should have gained 5 life (condition met — controls a permanent)
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.life).toBe(25);
  });

  it("should resolve elseEffects when condition is not met", () => {
    let state = toMainPhase(twoPlayerGame());

    // No creatures on battlefield — condition fails
    state = makeSpellInHand(state, "cond1", "Conditional Spell", "p1", [
      {
        type: "conditional",
        condition: { type: "lifeAtOrBelow", amount: 5, player: { type: "controller" } },
        thenEffects: [{ type: "gainLife", amount: 10, player: { type: "controller" } }],
        elseEffects: [{ type: "drawCards", count: 1, player: { type: "controller" } }],
      },
    ]);

    const handBefore = state.zones[handKey("p1")].cardInstanceIds.length;
    state = castAndResolve(state, "cond1");

    // Life is 20, not <= 5, so else branch: draw 1 card
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.life).toBe(20); // Unchanged
    // Hand: started with N + cond1, cast cond1 (-1), drew 1 (+1) = N
    const handAfter = state.zones[handKey("p1")].cardInstanceIds.length;
    expect(handAfter).toBe(handBefore); // net zero (cast one, drew one)
  });
});

describe("forEach effect", () => {
  it("should apply effect to each matching card", () => {
    let state = toMainPhase(twoPlayerGame());

    // Place 3 creatures for p1
    state = placeOnBattlefield(state, makeCreature("cr1", "Bear 1", "p1", 2, 2));
    state = placeOnBattlefield(state, makeCreature("cr2", "Bear 2", "p1", 2, 2));
    state = placeOnBattlefield(state, makeCreature("cr3", "Bear 3", "p1", 2, 2));

    // forEach: destroy each creature controller controls
    state = makeSpellInHand(state, "each1", "ForEach Spell", "p1", [
      {
        type: "forEach",
        selector: { zone: ZoneType.Battlefield, controller: "you" },
        effect: { type: "destroy", target: { targetRequirementId: "__forEach__" } },
      },
    ]);

    state = castAndResolve(state, "each1");

    // All p1 creatures should be destroyed
    expect(state.cardInstances["cr1"].zone).toBe(ZoneType.Graveyard);
    expect(state.cardInstances["cr2"].zone).toBe(ZoneType.Graveyard);
    expect(state.cardInstances["cr3"].zone).toBe(ZoneType.Graveyard);
  });
});
