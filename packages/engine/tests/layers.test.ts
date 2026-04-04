/**
 * Layer system tests.
 *
 * Tests: anthem effects (layer 7, +1/+1 to all your creatures),
 * keyword granting (layer 6), equipment bonuses via layers,
 * effect ordering by timestamp.
 */

import { describe, it, expect } from "vitest";
import type { GameState, ContinuousEffect } from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { applyLayerSystem } from "../src/layers/layer-system.js";
import { twoPlayerGame } from "./helpers.js";
import { makeCreature, placeOnBattlefield } from "./combat-helpers.js";
import { cardHasKeyword } from "../src/combat/keywords.js";

describe("layer system", () => {
  describe("layer 7: P/T modifications", () => {
    it("should apply anthem effect (+1/+1 to all your creatures)", () => {
      let state = twoPlayerGame();

      // Place two creatures for p1
      state = placeOnBattlefield(state, makeCreature("bear1", "Bear 1", "p1", 2, 2));
      state = placeOnBattlefield(state, makeCreature("bear2", "Bear 2", "p1", 2, 2));

      // Place the anthem source (e.g., Benalish Marshal)
      const marshal = makeCreature("marshal", "Benalish Marshal", "p1", 3, 3);
      // Add static ability: other creatures you control get +1/+1
      const marshalWithAbility = {
        ...marshal,
        abilities: [
          ...marshal.abilities,
          {
            id: "marshal_anthem",
            type: "static" as const,
            sourceCardInstanceId: "marshal",
            effects: [],
            zones: [ZoneType.Battlefield],
            continuousEffect: {
              effectType: "modifyPT",
              affectedFilter: { self: false, controller: "you" },
              modification: { power: 1, toughness: 1 },
            },
            condition: null,
            layer: 7,
          },
        ],
      };
      state = placeOnBattlefield(state, marshalWithAbility);

      // Apply layer system
      const result = applyLayerSystem(state);

      // Bears should be 3/3 (2/2 + 1/1 from anthem)
      expect(result.cardInstances["bear1"].modifiedPower).toBe(3);
      expect(result.cardInstances["bear1"].modifiedToughness).toBe(3);
      expect(result.cardInstances["bear2"].modifiedPower).toBe(3);
      expect(result.cardInstances["bear2"].modifiedToughness).toBe(3);

      // Marshal itself should NOT get the bonus (self: false)
      expect(result.cardInstances["marshal"].modifiedPower).toBe(3);
      expect(result.cardInstances["marshal"].modifiedToughness).toBe(3);
    });

    it("should not apply anthem to opponent creatures", () => {
      let state = twoPlayerGame();

      state = placeOnBattlefield(state, makeCreature("my_bear", "Bear", "p1", 2, 2));
      state = placeOnBattlefield(state, makeCreature("opp_bear", "Bear", "p2", 2, 2));

      const lord = {
        ...makeCreature("lord", "Lord", "p1", 2, 2),
        abilities: [{
          id: "lord_anthem",
          type: "static" as const,
          sourceCardInstanceId: "lord",
          effects: [],
          zones: [ZoneType.Battlefield],
          continuousEffect: {
            effectType: "modifyPT",
            affectedFilter: { self: false, controller: "you" },
            modification: { power: 1, toughness: 1 },
          },
          condition: null,
          layer: 7,
        }],
      };
      state = placeOnBattlefield(state, lord);

      const result = applyLayerSystem(state);

      // Your bear gets +1/+1
      expect(result.cardInstances["my_bear"].modifiedPower).toBe(3);
      // Opponent's bear does NOT
      expect(result.cardInstances["opp_bear"].modifiedPower).toBe(2);
    });

    it("should apply multiple anthems cumulatively", () => {
      let state = twoPlayerGame();

      state = placeOnBattlefield(state, makeCreature("bear", "Bear", "p1", 2, 2));

      // Two anthem sources
      for (const id of ["lord1", "lord2"]) {
        const lord = {
          ...makeCreature(id, "Lord", "p1", 1, 1),
          abilities: [{
            id: `${id}_anthem`,
            type: "static" as const,
            sourceCardInstanceId: id,
            effects: [],
            zones: [ZoneType.Battlefield],
            continuousEffect: {
              effectType: "modifyPT",
              affectedFilter: { self: false, controller: "you" },
              modification: { power: 1, toughness: 1 },
            },
            condition: null,
            layer: 7,
          }],
        };
        state = placeOnBattlefield(state, lord);
      }

      const result = applyLayerSystem(state);

      // Bear gets +1/+1 from each lord = 4/4
      expect(result.cardInstances["bear"].modifiedPower).toBe(4);
      expect(result.cardInstances["bear"].modifiedToughness).toBe(4);
    });

    it("should apply equipment bonus only to equipped creature", () => {
      let state = twoPlayerGame();

      state = placeOnBattlefield(state, makeCreature("bear1", "Bear 1", "p1", 2, 2));
      state = placeOnBattlefield(state, makeCreature("bear2", "Bear 2", "p1", 2, 2));

      // Equipment attached to bear1
      const equipment = {
        ...makeCreature("eq1", "Bonesplitter", "p1", 0, 0), // not a creature, but using helper
        modifiedPower: null,
        modifiedToughness: null,
        attachedTo: "bear1",
        abilities: [{
          id: "eq_pt",
          type: "static" as const,
          sourceCardInstanceId: "eq1",
          effects: [],
          zones: [ZoneType.Battlefield],
          continuousEffect: {
            effectType: "modifyPT",
            affectedFilter: { custom: "equipped_creature" },
            modification: { power: 2, toughness: 0 },
          },
          condition: null,
          layer: 7,
        }],
      };
      state = placeOnBattlefield(state, equipment);
      // Set bear1's attachments
      state = {
        ...state,
        cardInstances: {
          ...state.cardInstances,
          bear1: { ...state.cardInstances["bear1"], attachments: ["eq1"] },
        },
      };

      const result = applyLayerSystem(state);

      // Bear1 gets +2/+0
      expect(result.cardInstances["bear1"].modifiedPower).toBe(4);
      expect(result.cardInstances["bear1"].modifiedToughness).toBe(2);
      // Bear2 does not
      expect(result.cardInstances["bear2"].modifiedPower).toBe(2);
    });
  });

  describe("layer 6: ability granting", () => {
    it("should grant keywords to matching creatures", () => {
      let state = twoPlayerGame();

      state = placeOnBattlefield(state, makeCreature("bear", "Bear", "p1", 2, 2));

      // Source that grants flying to all your creatures
      const source = {
        ...makeCreature("source", "Eldrazi Monument", "p1", 0, 0),
        modifiedPower: null,
        modifiedToughness: null,
        abilities: [{
          id: "monument_flying",
          type: "static" as const,
          sourceCardInstanceId: "source",
          effects: [],
          zones: [ZoneType.Battlefield],
          continuousEffect: {
            effectType: "grantKeyword",
            affectedFilter: { controller: "you" },
            modification: { keywords: ["Flying"] },
          },
          condition: null,
          layer: 6,
        }],
      };
      state = placeOnBattlefield(state, source);

      const result = applyLayerSystem(state);

      // Bear should now have flying
      const bear = result.cardInstances["bear"];
      expect(cardHasKeyword(bear, "flying")).toBe(true);
    });
  });

  describe("spell-based continuous effects", () => {
    it("should apply endOfTurn P/T modification from resolved spell", () => {
      let state = twoPlayerGame();

      state = placeOnBattlefield(state, makeCreature("bear", "Bear", "p1", 2, 2));

      // Simulate Giant Growth having resolved — endOfTurn +3/+3 effect
      state = {
        ...state,
        continuousEffects: [
          {
            id: "eff_giant_growth",
            sourceCardInstanceId: "some_spell",
            effect: { power: 3, toughness: 3, targetId: "bear" },
            affectedFilter: {},
            duration: "endOfTurn" as const,
            layer: 7,
            subLayer: "c" as const,
            timestamp: 100,
            dependsOn: [],
          },
        ],
      };

      const result = applyLayerSystem(state);

      // Bear should be 5/5
      expect(result.cardInstances["bear"].modifiedPower).toBe(5);
      expect(result.cardInstances["bear"].modifiedToughness).toBe(5);
    });
  });
});
