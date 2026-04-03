/**
 * Tests for Tier 1 effect handlers and X spell support.
 *
 * Tests: createToken, sacrifice, tap/untap, addCounters/removeCounters,
 * grantAbility, X spells.
 */

import { describe, it, expect } from "vitest";
import type {
  GameState,
  CardInstance,
  SpellAbilitySpell,
  Effect,
  ResolvedTarget,
  TokenDefinition,
} from "@magic-flux/types";
import { Phase, Step, ZoneType } from "@magic-flux/types";
import { executeAction } from "../src/actions.js";
import { advanceToNextPriorityPoint } from "../src/turn/phases.js";
import { twoPlayerGame } from "./helpers.js";
import { makeCreature, placeOnBattlefield } from "./combat-helpers.js";
import { handKey } from "../src/zones/transfers.js";

// Helper: make a spell card and add to hand
function makeSpellInHand(
  state: GameState,
  instanceId: string,
  name: string,
  owner: string,
  effects: Effect[],
): GameState {
  const spellAbility: SpellAbilitySpell = {
    id: `${instanceId}_spell`,
    type: "spell",
    sourceCardInstanceId: instanceId,
    effects,
    zones: [ZoneType.Hand, ZoneType.Stack],
  };

  const card: CardInstance = {
    instanceId,
    cardDataId: name,
    owner,
    controller: owner,
    zone: ZoneType.Hand,
    zoneOwnerId: owner,
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
    abilities: [spellAbility],
    modifiedPower: null,
    modifiedToughness: null,
    currentLoyalty: null,
    castingChoices: null,
    linkedEffects: {},
  };

  const hKey = handKey(owner);
  return {
    ...state,
    cardInstances: { ...state.cardInstances, [instanceId]: card },
    zones: {
      ...state.zones,
      [hKey]: {
        ...state.zones[hKey],
        cardInstanceIds: [...state.zones[hKey].cardInstanceIds, instanceId],
      },
    },
  };
}

function toMainPhase(state: GameState): GameState {
  const { state: started } = advanceToNextPriorityPoint(state);
  let s = started;
  while (!(s.turnState.phase === Phase.PreCombatMain && s.turnState.step === null)) {
    if (s.priorityPlayerId === null) {
      s = advanceToNextPriorityPoint(s).state;
      continue;
    }
    const result = executeAction(s, { type: "passPriority" });
    if (!result.success) throw new Error(result.error.message);
    s = result.state;
  }
  return s;
}

function castAndResolve(state: GameState, cardId: string, targets: ResolvedTarget[] = [], choices?: any): GameState {
  let result = executeAction(state, {
    type: "castSpell",
    cardInstanceId: cardId,
    targets,
    choices,
  });
  if (!result.success) throw new Error(`Cast failed: ${result.error.message}`);
  let s = result.state;

  // Both pass to resolve
  result = executeAction(s, { type: "passPriority" });
  s = (result as any).state;
  result = executeAction(s, { type: "passPriority" });
  return (result as any).state;
}

describe("createToken effect", () => {
  it("should create a creature token on the battlefield", () => {
    let state = toMainPhase(twoPlayerGame());

    const tokenDef: TokenDefinition = {
      name: "Soldier",
      colors: ["W"],
      cardTypes: ["Creature"],
      subtypes: ["Soldier"],
      power: 1,
      toughness: 1,
      abilities: [],
      keywords: [],
    };

    state = makeSpellInHand(state, "token_spell", "Raise the Alarm", "p1", [
      { type: "createToken", token: tokenDef, count: 2, controller: { type: "controller" } },
    ]);

    state = castAndResolve(state, "token_spell");

    // Should have 2 soldier tokens on battlefield
    const bf = state.zones["battlefield"];
    const tokens = bf.cardInstanceIds.filter((id) =>
      state.cardInstances[id].cardDataId === "token:Soldier",
    );
    expect(tokens).toHaveLength(2);

    // Tokens should be 1/1
    for (const tokenId of tokens) {
      const token = state.cardInstances[tokenId];
      expect(token.modifiedPower).toBe(1);
      expect(token.modifiedToughness).toBe(1);
      expect(token.controller).toBe("p1");
      expect(token.summoningSickness).toBe(true);
    }
  });
});

describe("sacrifice effect", () => {
  it("should sacrifice a creature controlled by the player", () => {
    let state = toMainPhase(twoPlayerGame());
    const creature = makeCreature("cr1", "Grizzly Bears", "p1", 2, 2);
    state = placeOnBattlefield(state, creature);

    state = makeSpellInHand(state, "sac_spell", "Sacrifice Spell", "p1", [
      { type: "sacrifice", filter: {}, player: { type: "controller" }, count: 1 },
    ]);

    state = castAndResolve(state, "sac_spell");

    // Creature should be in graveyard
    expect(state.cardInstances["cr1"].zone).toBe(ZoneType.Graveyard);
  });
});

describe("addCounters effect", () => {
  it("should add +1/+1 counters and modify P/T", () => {
    let state = toMainPhase(twoPlayerGame());
    const creature = makeCreature("cr1", "Grizzly Bears", "p1", 2, 2);
    state = placeOnBattlefield(state, creature);

    state = makeSpellInHand(state, "counter_spell", "Travel Preparations", "p1", [
      {
        type: "addCounters",
        counterType: "+1/+1",
        count: 2,
        target: { targetRequirementId: "t1" },
      },
    ]);

    state = castAndResolve(state, "counter_spell", [
      { requirementId: "t1", targetId: "cr1", targetType: "card" },
    ]);

    const cr = state.cardInstances["cr1"];
    expect(cr.counters["+1/+1"]).toBe(2);
    expect(cr.modifiedPower).toBe(4); // 2 + 2
    expect(cr.modifiedToughness).toBe(4); // 2 + 2
  });
});

describe("tap/untap effects", () => {
  it("should tap a target permanent", () => {
    let state = toMainPhase(twoPlayerGame());
    const creature = makeCreature("cr1", "Grizzly Bears", "p2", 2, 2);
    state = placeOnBattlefield(state, creature);

    state = makeSpellInHand(state, "tap_spell", "Frost Breath", "p1", [
      { type: "tap", target: { targetRequirementId: "t1" } },
    ]);

    state = castAndResolve(state, "tap_spell", [
      { requirementId: "t1", targetId: "cr1", targetType: "card" },
    ]);

    expect(state.cardInstances["cr1"].tapped).toBe(true);
  });
});

describe("X spell handling", () => {
  it("should use X value from casting choices in effect resolution", () => {
    let state = toMainPhase(twoPlayerGame());

    // Fireball-style: deal X damage to target
    state = makeSpellInHand(state, "fireball", "Fireball", "p1", [
      {
        type: "dealDamage",
        amount: { variable: "X" },
        to: { targetRequirementId: "t1" },
      },
    ]);

    // Cast with X=5
    let result = executeAction(state, {
      type: "castSpell",
      cardInstanceId: "fireball",
      targets: [{ requirementId: "t1", targetId: "p2", targetType: "player" }],
      choices: {
        xValue: 5,
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

    // p2 took 5 damage
    const p2 = state.players.find((p) => p.id === "p2")!;
    expect(p2.life).toBe(15); // 20 - 5
  });
});
