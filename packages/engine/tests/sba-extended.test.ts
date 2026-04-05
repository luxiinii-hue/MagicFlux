/**
 * Extended SBA tests: aura legality, counter annihilation.
 * (Legend Rule deferred — needs isLegendary flag on CardInstance.)
 */

import { describe, it, expect } from "vitest";
import type { GameState, CardInstance } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { processStateBasedActions } from "../src/state-based/sba.js";
import { twoPlayerGame } from "./helpers.js";
import { makeCreature, placeOnBattlefield } from "./combat-helpers.js";

describe("SBA: +1/+1 and -1/-1 counter annihilation", () => {
  it("should remove equal pairs of +1/+1 and -1/-1 counters", () => {
    let state = twoPlayerGame();
    const creature: CardInstance = {
      ...makeCreature("cr1", "Bear", "p1", 2, 2),
      counters: { "+1/+1": 3, "-1/-1": 2 },
    };
    state = placeOnBattlefield(state, creature);

    const result = processStateBasedActions(state);

    expect(result.actionsPerformed).toBe(true);
    const cr = result.state.cardInstances["cr1"];
    expect(cr.counters["+1/+1"]).toBe(1);
    expect(cr.counters["-1/-1"]).toBeUndefined();
  });

  it("should remove all counters when equal", () => {
    let state = twoPlayerGame();
    const creature: CardInstance = {
      ...makeCreature("cr1", "Bear", "p1", 2, 2),
      counters: { "+1/+1": 2, "-1/-1": 2 },
    };
    state = placeOnBattlefield(state, creature);

    const result = processStateBasedActions(state);
    const cr = result.state.cardInstances["cr1"];
    expect(cr.counters["+1/+1"]).toBeUndefined();
    expect(cr.counters["-1/-1"]).toBeUndefined();
  });

  it("should not fire when only one counter type exists", () => {
    let state = twoPlayerGame();
    const creature: CardInstance = {
      ...makeCreature("cr1", "Bear", "p1", 2, 2),
      counters: { "+1/+1": 3 },
    };
    state = placeOnBattlefield(state, creature);

    const result = processStateBasedActions(state);
    // No annihilation needed — actionsPerformed may be false
    const cr = result.state.cardInstances["cr1"];
    expect(cr.counters["+1/+1"]).toBe(3);
  });
});

describe("SBA: Aura/Equipment attachment legality", () => {
  it("should detach equipment when equipped creature leaves battlefield", () => {
    let state = twoPlayerGame();

    // Creature and equipment on battlefield
    const creature = makeCreature("cr1", "Bear", "p1", 2, 2);
    state = placeOnBattlefield(state, creature);

    const equipment: CardInstance = {
      instanceId: "eq1",
      cardDataId: "Bonesplitter",
      owner: "p1", controller: "p1",
      zone: ZoneType.Battlefield, zoneOwnerId: null,
      tapped: false, flipped: false, faceDown: false, transformedOrBack: false,
      phasedOut: false, summoningSickness: false, damage: 0,
      counters: {},
      attachedTo: "cr1",
      attachments: [],
      abilities: [],
      modifiedPower: null, modifiedToughness: null,
      currentLoyalty: null, castingChoices: null, linkedEffects: {},
    };
    state = placeOnBattlefield(state, equipment);

    // Remove creature from battlefield (simulate death)
    const bf = state.zones["battlefield"];
    const updatedCreature = { ...state.cardInstances["cr1"], zone: ZoneType.Graveyard };
    state = {
      ...state,
      cardInstances: { ...state.cardInstances, cr1: updatedCreature },
      zones: {
        ...state.zones,
        battlefield: { ...bf, cardInstanceIds: bf.cardInstanceIds.filter((id) => id !== "cr1") },
      },
    };

    const result = processStateBasedActions(state);

    // Equipment should be detached but still on battlefield
    expect(result.state.cardInstances["eq1"].attachedTo).toBeNull();
    expect(result.state.cardInstances["eq1"].zone).toBe(ZoneType.Battlefield);
  });
});
