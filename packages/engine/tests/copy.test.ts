/**
 * Copy effect tests.
 *
 * Tests: copying a permanent (Clone), copying a spell (Fork).
 */

import { describe, it, expect } from "vitest";
import type { GameState, StackItem, SpellAbilitySpell } from "@magic-flux/types";
import { Phase, ZoneType } from "@magic-flux/types";
import { copyPermanent, copySpell } from "../src/stack/copy.js";
import { pushToStack } from "../src/stack/stack.js";
import { twoPlayerGame } from "./helpers.js";
import { makeCreature, placeOnBattlefield } from "./combat-helpers.js";
import { cardHasKeyword } from "../src/combat/keywords.js";

describe("copyPermanent (Clone pattern)", () => {
  it("should create a copy of a creature with same P/T and abilities", () => {
    let state = twoPlayerGame();
    const angel = makeCreature("angel1", "Serra Angel", "p2", 4, 4, ["flying", "vigilance"]);
    state = placeOnBattlefield(state, angel);

    const result = copyPermanent(state, "angel1", "p1");

    // Copy should exist on battlefield
    const copy = result.state.cardInstances[result.copyId];
    expect(copy).toBeDefined();
    expect(copy.zone).toBe(ZoneType.Battlefield);

    // Copy should have same P/T
    expect(copy.modifiedPower).toBe(4);
    expect(copy.modifiedToughness).toBe(4);

    // Copy should have same keywords
    expect(cardHasKeyword(copy, "flying")).toBe(true);
    expect(cardHasKeyword(copy, "vigilance")).toBe(true);

    // Copy should be controlled by the copier
    expect(copy.controller).toBe("p1");
    expect(copy.owner).toBe("p1");

    // Copy should have summoning sickness
    expect(copy.summoningSickness).toBe(true);

    // Non-copiable values should be reset
    expect(copy.tapped).toBe(false);
    expect(copy.damage).toBe(0);
    expect(copy.counters).toEqual({});
  });

  it("should not copy counters or damage from original", () => {
    let state = twoPlayerGame();
    const creature = makeCreature("cr1", "Big Beast", "p2", 5, 5);
    const withState = {
      ...creature,
      damage: 3,
      counters: { "+1/+1": 2 },
    };
    state = placeOnBattlefield(state, withState);

    const result = copyPermanent(state, "cr1", "p1");
    const copy = result.state.cardInstances[result.copyId];

    expect(copy.damage).toBe(0);
    expect(copy.counters).toEqual({});
    // P/T copies the base, not the counter-modified value
    expect(copy.modifiedPower).toBe(5);
  });
});

describe("copySpell (Fork pattern)", () => {
  it("should create a copy of a spell on the stack", () => {
    let state = twoPlayerGame();

    // Put a spell on the stack
    const spellAbility: SpellAbilitySpell = {
      id: "bolt_spell",
      type: "spell",
      sourceCardInstanceId: "bolt1",
      effects: [{ type: "dealDamage", amount: 3, to: { targetRequirementId: "t1" } }],
      zones: [ZoneType.Hand, ZoneType.Stack],
    };

    const stackItem: StackItem = {
      id: "stack_bolt",
      sourceCardInstanceId: "bolt1",
      ability: spellAbility,
      controller: "p1",
      targets: [{ requirementId: "t1", targetId: "p2", targetType: "player" }],
      isSpell: true,
      isCopy: false,
      choices: null,
    };

    const pushResult = pushToStack(state, stackItem);
    state = pushResult.state;

    // Fork it — p2 copies the bolt
    const result = copySpell(state, "stack_bolt", "p2");

    // Copy should be on top of stack
    expect(result.state.stack[0]).toBe(result.copyStackItemId);
    expect(result.state.stack.length).toBe(2);

    // Copy should be marked as a copy
    const copy = result.state.stackItems[result.copyStackItemId];
    expect(copy.isCopy).toBe(true);
    expect(copy.controller).toBe("p2");

    // Copy should have same effects
    expect(copy.ability.effects).toEqual(spellAbility.effects);
  });

  it("should allow new targets on the copy", () => {
    let state = twoPlayerGame();

    const stackItem: StackItem = {
      id: "stack_bolt",
      sourceCardInstanceId: "bolt1",
      ability: {
        id: "bolt_spell",
        type: "spell",
        sourceCardInstanceId: "bolt1",
        effects: [{ type: "dealDamage", amount: 3, to: { targetRequirementId: "t1" } }],
        zones: [ZoneType.Hand, ZoneType.Stack],
      },
      controller: "p1",
      targets: [{ requirementId: "t1", targetId: "p2", targetType: "player" }],
      isSpell: true,
      isCopy: false,
      choices: null,
    };

    const pushResult = pushToStack(state, stackItem);
    state = pushResult.state;

    // Copy with new target — redirect to p1
    const newTargets = [{ requirementId: "t1", targetId: "p1", targetType: "player" as const }];
    const result = copySpell(state, "stack_bolt", "p2", newTargets);

    const copy = result.state.stackItems[result.copyStackItemId];
    expect(copy.targets[0].targetId).toBe("p1");
  });
});
