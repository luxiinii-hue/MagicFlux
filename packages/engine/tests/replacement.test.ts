/**
 * Replacement effect tests.
 *
 * Tests: zone change replacement (Rest in Peace pattern),
 * damage prevention, amount modification.
 */

import { describe, it, expect } from "vitest";
import type { GameState, ReplacementEffect } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { twoPlayerGame } from "./helpers.js";
import { makeCreature, placeOnBattlefield } from "./combat-helpers.js";
import { moveCard, graveyardKey } from "../src/zones/transfers.js";
import {
  addReplacementEffect,
  checkDamageReplacement,
  checkAmountReplacement,
  removeReplacementEffectsFromSource,
} from "../src/replacement/replacement.js";

describe("zone change replacement (Rest in Peace pattern)", () => {
  it("should exile a card instead of sending to graveyard", () => {
    let state = twoPlayerGame();

    // Place a creature on battlefield
    const creature = makeCreature("cr1", "Grizzly Bears", "p1", 2, 2);
    state = placeOnBattlefield(state, creature);

    // Add Rest in Peace-style replacement: cards going to graveyard go to exile instead
    const restInPeace: ReplacementEffect = {
      id: "rip_1",
      sourceCardInstanceId: "rip_source",
      eventType: "cardEnteredZone",
      filter: null,
      replacementAction: {
        type: "changeZone",
        fromZone: ZoneType.Graveyard,
        toZone: ZoneType.Exile,
      },
      condition: null,
      self: false,
      duration: "whileSourceOnBattlefield",
      appliedOnce: true,
    };

    // Need a source permanent on battlefield for "whileSourceOnBattlefield"
    const ripSource = makeCreature("rip_source", "Rest in Peace", "p1", 0, 0);
    const ripOnBF = { ...ripSource, modifiedPower: null, modifiedToughness: null };
    state = placeOnBattlefield(state, ripOnBF);
    state = addReplacementEffect(state, restInPeace);

    // Move creature to graveyard — should be replaced with exile
    const result = moveCard(state, "cr1", "battlefield", graveyardKey("p1"), Date.now());

    // Creature should be in exile, not graveyard
    expect(result.state.cardInstances["cr1"].zone).toBe(ZoneType.Exile);
    expect(result.state.zones["exile"].cardInstanceIds).toContain("cr1");
  });

  it("should not replace when replacement source is not on battlefield", () => {
    let state = twoPlayerGame();
    const creature = makeCreature("cr1", "Grizzly Bears", "p1", 2, 2);
    state = placeOnBattlefield(state, creature);

    // Replacement effect with source NOT on battlefield
    const effect: ReplacementEffect = {
      id: "rip_1",
      sourceCardInstanceId: "nonexistent",
      eventType: "cardEnteredZone",
      filter: null,
      replacementAction: {
        type: "changeZone",
        fromZone: ZoneType.Graveyard,
        toZone: ZoneType.Exile,
      },
      condition: null,
      self: false,
      duration: "whileSourceOnBattlefield",
      appliedOnce: true,
    };
    state = addReplacementEffect(state, effect);

    // Move to graveyard — should go to graveyard normally (source not on BF)
    const result = moveCard(state, "cr1", "battlefield", graveyardKey("p1"), Date.now());
    expect(result.state.cardInstances["cr1"].zone).toBe(ZoneType.Graveyard);
  });
});

describe("damage replacement", () => {
  it("should prevent damage", () => {
    let state = twoPlayerGame();

    const prevention: ReplacementEffect = {
      id: "fog_1",
      sourceCardInstanceId: "fog_source",
      eventType: "damageDealt",
      filter: null,
      replacementAction: { type: "preventDamage", amount: 99 },
      condition: null,
      self: false,
      duration: "endOfTurn",
      appliedOnce: false,
    };
    state = addReplacementEffect(state, prevention);

    const result = checkDamageReplacement(state, "attacker", "p2", 5);
    expect(result.amount).toBe(0);
    expect(result.prevented).toBe(true);
  });

  it("should partially prevent damage", () => {
    let state = twoPlayerGame();

    const prevention: ReplacementEffect = {
      id: "shield_1",
      sourceCardInstanceId: "shield_source",
      eventType: "damageDealt",
      filter: null,
      replacementAction: { type: "preventDamage", amount: 3 },
      condition: null,
      self: false,
      duration: "endOfTurn",
      appliedOnce: false,
    };
    state = addReplacementEffect(state, prevention);

    const result = checkDamageReplacement(state, "attacker", "p2", 5);
    expect(result.amount).toBe(2); // 5 - 3
    expect(result.prevented).toBe(false);
  });
});

describe("amount modification replacement", () => {
  it("should double token creation (Doubling Season pattern)", () => {
    let state = twoPlayerGame();

    const doubling: ReplacementEffect = {
      id: "ds_1",
      sourceCardInstanceId: "ds_source",
      eventType: "tokenCreated",
      filter: null,
      replacementAction: { type: "modifyAmount", multiplier: 2 },
      condition: null,
      self: false,
      duration: "permanent",
      appliedOnce: false,
    };
    state = addReplacementEffect(state, doubling);

    const result = checkAmountReplacement(state, "tokenCreated", "p1", 2);
    expect(result).toBe(4); // 2 * 2
  });
});

describe("replacement effect lifecycle", () => {
  it("should remove effects when source leaves battlefield", () => {
    let state = twoPlayerGame();

    const effect: ReplacementEffect = {
      id: "eff_1",
      sourceCardInstanceId: "source1",
      eventType: "cardEnteredZone",
      filter: null,
      replacementAction: { type: "changeZone", fromZone: ZoneType.Graveyard, toZone: ZoneType.Exile },
      condition: null,
      self: false,
      duration: "whileSourceOnBattlefield",
      appliedOnce: true,
    };
    state = addReplacementEffect(state, effect);
    expect(state.replacementEffects).toHaveLength(1);

    state = removeReplacementEffectsFromSource(state, "source1");
    expect(state.replacementEffects).toHaveLength(0);
  });
});
