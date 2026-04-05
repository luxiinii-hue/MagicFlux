/**
 * Planeswalker loyalty ability tests.
 *
 * Tests: loyalty activation, +N/-N costs, one-per-turn restriction,
 * 0 loyalty SBA death, damage to planeswalker removes loyalty.
 */

import { describe, it, expect } from "vitest";
import type { GameState, CardInstance, SpellAbilityActivated } from "@magic-flux/types";
import { Phase, ZoneType } from "@magic-flux/types";
import { executeAction } from "../src/actions.js";
import { advanceToNextPriorityPoint } from "../src/turn/phases.js";
import { processStateBasedActionsLoop } from "../src/state-based/sba.js";
import { dealDamageToPlayeswalker } from "../src/planeswalker.js";
import { twoPlayerGame } from "./helpers.js";

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

function makePlaneswalker(
  instanceId: string,
  name: string,
  owner: string,
  startingLoyalty: number,
): CardInstance {
  // +1: draw a card
  const plusAbility: SpellAbilityActivated = {
    id: `${instanceId}_plus1`,
    type: "activated",
    sourceCardInstanceId: instanceId,
    effects: [{ type: "drawCards", count: 1, player: { type: "controller" } }],
    zones: [ZoneType.Battlefield],
    cost: {
      manaCost: null,
      tapSelf: false,
      untapSelf: false,
      sacrifice: null,
      discard: null,
      payLife: null,
      exileSelf: false,
      exileFromGraveyard: null,
      removeCounters: null,
      additionalCosts: [{ type: "addLoyalty", description: "+1", data: { amount: 1 } }],
    },
    timing: "sorcery",
    targets: [],
    activationRestrictions: [],
  };

  // -3: deal 3 damage to any target
  const minusAbility: SpellAbilityActivated = {
    id: `${instanceId}_minus3`,
    type: "activated",
    sourceCardInstanceId: instanceId,
    effects: [{ type: "dealDamage", amount: 3, to: { targetRequirementId: "t1" } }],
    zones: [ZoneType.Battlefield],
    cost: {
      manaCost: null,
      tapSelf: false,
      untapSelf: false,
      sacrifice: null,
      discard: null,
      payLife: null,
      exileSelf: false,
      exileFromGraveyard: null,
      removeCounters: { counterType: "loyalty", count: 3 },
      additionalCosts: [],
    },
    timing: "sorcery",
    targets: [{
      id: "t1",
      description: "any target",
      count: { exactly: 1 },
      targetTypes: ["creature", "player", "planeswalker"],
      filter: null,
      controller: "any",
    }],
    activationRestrictions: [],
  };

  return {
    instanceId,
    cardDataId: name,
    owner,
    controller: owner,
    zone: ZoneType.Battlefield,
    zoneOwnerId: null,
    tapped: false,
    flipped: false,
    faceDown: false,
    transformedOrBack: false,
    phasedOut: false,
    summoningSickness: false,
    damage: 0,
    counters: {},
    attachedTo: null,
    attachments: [],
    abilities: [plusAbility, minusAbility],
    modifiedPower: null,
    modifiedToughness: null,
    currentLoyalty: startingLoyalty,
    castingChoices: null,
    linkedEffects: {},
  };
}

function placeOnBattlefield(state: GameState, card: CardInstance): GameState {
  const bf = state.zones["battlefield"];
  return {
    ...state,
    cardInstances: { ...state.cardInstances, [card.instanceId]: card },
    zones: { ...state.zones, battlefield: { ...bf, cardInstanceIds: [card.instanceId, ...bf.cardInstanceIds] } },
  };
}

describe("planeswalker loyalty abilities", () => {
  it("should activate +1 ability and increase loyalty", () => {
    let state = toMainPhase(twoPlayerGame());
    const pw = makePlaneswalker("jace1", "Jace", "p1", 4);
    state = placeOnBattlefield(state, pw);

    const result = executeAction(state, {
      type: "activateAbility",
      cardInstanceId: "jace1",
      abilityId: "jace1_plus1",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      // Loyalty should increase from 4 to 5
      expect(result.state.cardInstances["jace1"].currentLoyalty).toBe(5);
      // Ability should be on the stack
      expect(result.state.stack.length).toBeGreaterThan(0);
    }
  });

  it("should activate -3 ability and decrease loyalty", () => {
    let state = toMainPhase(twoPlayerGame());
    const pw = makePlaneswalker("jace1", "Jace", "p1", 4);
    state = placeOnBattlefield(state, pw);

    const result = executeAction(state, {
      type: "activateAbility",
      cardInstanceId: "jace1",
      abilityId: "jace1_minus3",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      // Loyalty should decrease from 4 to 1
      expect(result.state.cardInstances["jace1"].currentLoyalty).toBe(1);
    }
  });

  it("should not allow -N when loyalty is insufficient", () => {
    let state = toMainPhase(twoPlayerGame());
    const pw = makePlaneswalker("jace1", "Jace", "p1", 2); // Only 2 loyalty
    state = placeOnBattlefield(state, pw);

    const result = executeAction(state, {
      type: "activateAbility",
      cardInstanceId: "jace1",
      abilityId: "jace1_minus3", // Costs 3, only have 2
    });

    expect(result.success).toBe(false);
  });

  it("should not allow two loyalty abilities in one turn", () => {
    let state = toMainPhase(twoPlayerGame());
    const pw = makePlaneswalker("jace1", "Jace", "p1", 4);
    state = placeOnBattlefield(state, pw);

    // First activation succeeds
    let result = executeAction(state, {
      type: "activateAbility",
      cardInstanceId: "jace1",
      abilityId: "jace1_plus1",
    });
    expect(result.success).toBe(true);
    state = (result as any).state;

    // Pass to resolve the first ability
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;

    // Second activation should fail
    result = executeAction(state, {
      type: "activateAbility",
      cardInstanceId: "jace1",
      abilityId: "jace1_plus1",
    });
    expect(result.success).toBe(false);
  });
});

describe("planeswalker SBA: 0 loyalty", () => {
  it("should destroy planeswalker at 0 loyalty", () => {
    let state = twoPlayerGame();
    const pw = makePlaneswalker("pw1", "Planeswalker", "p1", 0);
    state = placeOnBattlefield(state, pw);

    const { state: afterSBA } = processStateBasedActionsLoop(state);
    expect(afterSBA.cardInstances["pw1"].zone).toBe(ZoneType.Graveyard);
  });
});

describe("damage to planeswalker", () => {
  it("should remove loyalty counters equal to damage", () => {
    let state = twoPlayerGame();
    const pw = makePlaneswalker("pw1", "Planeswalker", "p1", 5);
    state = placeOnBattlefield(state, pw);

    const { state: afterDamage } = dealDamageToPlayeswalker(state, "pw1", 3);
    expect(afterDamage.cardInstances["pw1"].currentLoyalty).toBe(2);
  });

  it("should kill planeswalker when damage exceeds loyalty (via SBA)", () => {
    let state = twoPlayerGame();
    const pw = makePlaneswalker("pw1", "Planeswalker", "p1", 3);
    state = placeOnBattlefield(state, pw);

    const { state: afterDamage } = dealDamageToPlayeswalker(state, "pw1", 5);
    expect(afterDamage.cardInstances["pw1"].currentLoyalty).toBe(0);

    const { state: afterSBA } = processStateBasedActionsLoop(afterDamage);
    expect(afterSBA.cardInstances["pw1"].zone).toBe(ZoneType.Graveyard);
  });
});
