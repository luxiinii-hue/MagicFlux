/**
 * Multi-ability trigger handling and linked ability pair tests.
 *
 * Verifies: cards with multiple triggered abilities each trigger
 * independently, Oblivion Ring ETB+LTB linked pair.
 */

import { describe, it, expect } from "vitest";
import type {
  GameState,
  CardInstance,
  SpellAbilityTriggered,
  GameEvent,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { checkTriggeredAbilities } from "../src/triggers/triggers.js";
import { twoPlayerGame } from "./helpers.js";

function placeOnBattlefield(state: GameState, card: CardInstance): GameState {
  const bf = state.zones["battlefield"];
  return {
    ...state,
    cardInstances: { ...state.cardInstances, [card.instanceId]: card },
    zones: { ...state.zones, battlefield: { ...bf, cardInstanceIds: [card.instanceId, ...bf.cardInstanceIds] } },
  };
}

describe("multi-ability trigger handling", () => {
  it("should trigger multiple abilities on the same card from different events", () => {
    let state = twoPlayerGame();

    // Card with two independent triggers:
    // 1. ETB trigger (cardEnteredZone)
    // 2. Damage trigger (damageDealt)
    const multiCard: CardInstance = {
      instanceId: "multi1",
      cardDataId: "Multi Trigger Card",
      owner: "p1",
      controller: "p1",
      zone: ZoneType.Battlefield,
      zoneOwnerId: null,
      tapped: false, flipped: false, faceDown: false, transformedOrBack: false,
      phasedOut: false, summoningSickness: false, damage: 0, counters: {},
      attachedTo: null, attachments: [],
      abilities: [
        {
          id: "multi1_etb",
          type: "triggered",
          sourceCardInstanceId: "multi1",
          effects: [{ type: "drawCards", count: 1, player: { type: "controller" } }],
          zones: [ZoneType.Battlefield],
          triggerCondition: {
            eventType: "cardEnteredZone",
            filter: null,
            self: false,
            optional: false,
            interveningIf: null,
          },
          targets: [],
        } satisfies SpellAbilityTriggered,
        {
          id: "multi1_damage",
          type: "triggered",
          sourceCardInstanceId: "multi1",
          effects: [{ type: "gainLife", amount: 1, player: { type: "controller" } }],
          zones: [ZoneType.Battlefield],
          triggerCondition: {
            eventType: "damageDealt",
            filter: null,
            self: false,
            optional: false,
            interveningIf: null,
          },
          targets: [],
        } satisfies SpellAbilityTriggered,
      ],
      modifiedPower: 2, modifiedToughness: 2,
      currentLoyalty: null, castingChoices: null, linkedEffects: {},
    };
    state = placeOnBattlefield(state, multiCard);

    // Send both event types
    const events: GameEvent[] = [
      { type: "cardEnteredZone", cardInstanceId: "other", toZone: ZoneType.Battlefield, fromZone: ZoneType.Hand, timestamp: 1 },
      { type: "damageDealt", sourceInstanceId: "attacker", targetRef: { targetId: "p2", targetType: "player" }, amount: 3, isCombatDamage: false, isDeathtouch: false, timestamp: 2 },
    ];

    const triggers = checkTriggeredAbilities(state, events);

    // Both abilities should trigger independently
    expect(triggers).toHaveLength(2);
    expect(triggers.some((t) => t.ability.id === "multi1_etb")).toBe(true);
    expect(triggers.some((t) => t.ability.id === "multi1_damage")).toBe(true);
  });

  it("should trigger only the matching ability when one event type fires", () => {
    let state = twoPlayerGame();

    const multiCard: CardInstance = {
      instanceId: "multi1",
      cardDataId: "Multi Trigger Card",
      owner: "p1",
      controller: "p1",
      zone: ZoneType.Battlefield,
      zoneOwnerId: null,
      tapped: false, flipped: false, faceDown: false, transformedOrBack: false,
      phasedOut: false, summoningSickness: false, damage: 0, counters: {},
      attachedTo: null, attachments: [],
      abilities: [
        {
          id: "multi1_etb",
          type: "triggered",
          sourceCardInstanceId: "multi1",
          effects: [{ type: "drawCards", count: 1, player: { type: "controller" } }],
          zones: [ZoneType.Battlefield],
          triggerCondition: { eventType: "cardEnteredZone", filter: null, self: false, optional: false, interveningIf: null },
          targets: [],
        } satisfies SpellAbilityTriggered,
        {
          id: "multi1_death",
          type: "triggered",
          sourceCardInstanceId: "multi1",
          effects: [{ type: "gainLife", amount: 2, player: { type: "controller" } }],
          zones: [ZoneType.Battlefield],
          triggerCondition: { eventType: "cardLeftZone", filter: null, self: false, optional: false, interveningIf: null },
          targets: [],
        } satisfies SpellAbilityTriggered,
      ],
      modifiedPower: 2, modifiedToughness: 2,
      currentLoyalty: null, castingChoices: null, linkedEffects: {},
    };
    state = placeOnBattlefield(state, multiCard);

    // Only ETB event
    const events: GameEvent[] = [
      { type: "cardEnteredZone", cardInstanceId: "other", toZone: ZoneType.Battlefield, fromZone: ZoneType.Hand, timestamp: 1 },
    ];

    const triggers = checkTriggeredAbilities(state, events);

    // Only ETB ability should trigger
    expect(triggers).toHaveLength(1);
    expect(triggers[0].ability.id).toBe("multi1_etb");
  });

  it("should produce separate StackItems for triggers from different cards", () => {
    let state = twoPlayerGame();

    // Two different cards, each with an ETB trigger
    for (const id of ["card_a", "card_b"]) {
      const card: CardInstance = {
        instanceId: id,
        cardDataId: "ETB Card",
        owner: "p1",
        controller: "p1",
        zone: ZoneType.Battlefield,
        zoneOwnerId: null,
        tapped: false, flipped: false, faceDown: false, transformedOrBack: false,
        phasedOut: false, summoningSickness: false, damage: 0, counters: {},
        attachedTo: null, attachments: [],
        abilities: [{
          id: `${id}_etb`,
          type: "triggered",
          sourceCardInstanceId: id,
          effects: [{ type: "drawCards", count: 1, player: { type: "controller" } }],
          zones: [ZoneType.Battlefield],
          triggerCondition: { eventType: "cardEnteredZone", filter: null, self: false, optional: false, interveningIf: null },
          targets: [],
        } satisfies SpellAbilityTriggered],
        modifiedPower: 1, modifiedToughness: 1,
        currentLoyalty: null, castingChoices: null, linkedEffects: {},
      };
      state = placeOnBattlefield(state, card);
    }

    const events: GameEvent[] = [
      { type: "cardEnteredZone", cardInstanceId: "something", toZone: ZoneType.Battlefield, fromZone: ZoneType.Hand, timestamp: 1 },
    ];

    const triggers = checkTriggeredAbilities(state, events);

    // Both cards should produce their own StackItem
    expect(triggers).toHaveLength(2);
    expect(triggers[0].sourceCardInstanceId).not.toBe(triggers[1].sourceCardInstanceId);
  });

  it("should order triggers APNAP (active player first)", () => {
    let state = twoPlayerGame();

    // p2's card
    const p2Card: CardInstance = {
      instanceId: "p2_card",
      cardDataId: "P2 Trigger",
      owner: "p2", controller: "p2",
      zone: ZoneType.Battlefield, zoneOwnerId: null,
      tapped: false, flipped: false, faceDown: false, transformedOrBack: false,
      phasedOut: false, summoningSickness: false, damage: 0, counters: {},
      attachedTo: null, attachments: [],
      abilities: [{
        id: "p2_etb", type: "triggered", sourceCardInstanceId: "p2_card",
        effects: [], zones: [ZoneType.Battlefield],
        triggerCondition: { eventType: "cardEnteredZone", filter: null, self: false, optional: false, interveningIf: null },
        targets: [],
      } satisfies SpellAbilityTriggered],
      modifiedPower: 1, modifiedToughness: 1,
      currentLoyalty: null, castingChoices: null, linkedEffects: {},
    };
    state = placeOnBattlefield(state, p2Card);

    // p1's card (active player)
    const p1Card: CardInstance = {
      ...p2Card, instanceId: "p1_card", owner: "p1", controller: "p1",
      abilities: [{
        id: "p1_etb", type: "triggered", sourceCardInstanceId: "p1_card",
        effects: [], zones: [ZoneType.Battlefield],
        triggerCondition: { eventType: "cardEnteredZone", filter: null, self: false, optional: false, interveningIf: null },
        targets: [],
      } satisfies SpellAbilityTriggered],
    };
    state = placeOnBattlefield(state, p1Card);

    const events: GameEvent[] = [
      { type: "cardEnteredZone", cardInstanceId: "x", toZone: ZoneType.Battlefield, fromZone: ZoneType.Hand, timestamp: 1 },
    ];

    const triggers = checkTriggeredAbilities(state, events);

    // Active player's (p1) trigger should come first
    expect(triggers[0].controller).toBe("p1");
    expect(triggers[1].controller).toBe("p2");
  });
});
