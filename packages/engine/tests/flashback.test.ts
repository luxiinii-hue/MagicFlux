import { describe, it, expect } from "vitest";
import type { GameState, CardInstance, SpellAbilitySpell } from "@magic-flux/types";
import { Phase, ZoneType } from "@magic-flux/types";
import { executeAction } from "../src/actions.js";
import { advanceToNextPriorityPoint } from "../src/turn/phases.js";
import { twoPlayerGame } from "./helpers.js";
import { graveyardKey, handKey } from "../src/zones/transfers.js";

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

describe("flashback", () => {
  it("should exile a spell cast with flashback instead of sending to graveyard", () => {
    let state = toMainPhase(twoPlayerGame());

    // Create a spell with flashback in the graveyard
    const spell: CardInstance = {
      instanceId: "fb_bolt",
      cardDataId: "Firebolt",
      owner: "p1",
      controller: "p1",
      zone: ZoneType.Hand,
      zoneOwnerId: "p1",
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
      abilities: [{
        id: "fb_bolt_spell",
        type: "spell" as const,
        sourceCardInstanceId: "fb_bolt",
        effects: [{
          type: "dealDamage",
          amount: 2,
          to: { targetRequirementId: "t1" },
        }],
        zones: [ZoneType.Hand, ZoneType.Stack, ZoneType.Graveyard],
      } satisfies SpellAbilitySpell],
      modifiedPower: null,
      modifiedToughness: null,
      currentLoyalty: null,
      castingChoices: null,
      linkedEffects: {},
    };

    // Add to hand
    const hKey = handKey("p1");
    state = {
      ...state,
      cardInstances: { ...state.cardInstances, fb_bolt: spell },
      zones: {
        ...state.zones,
        [hKey]: {
          ...state.zones[hKey],
          cardInstanceIds: [...state.zones[hKey].cardInstanceIds, "fb_bolt"],
        },
      },
    };

    // Cast with flashback flag
    let result = executeAction(state, {
      type: "castSpell",
      cardInstanceId: "fb_bolt",
      targets: [{ requirementId: "t1", targetId: "p2", targetType: "player" }],
      choices: {
        xValue: null,
        kickerPaid: false,
        additionalKickersPaid: [],
        chosenModes: [],
        alternativeCostUsed: "flashback",
      },
    });
    expect(result.success).toBe(true);
    state = (result as any).state;

    // Both pass — resolve
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;

    // Spell should be in exile (not graveyard) because flashback
    expect(state.cardInstances["fb_bolt"].zone).toBe(ZoneType.Exile);

    // Damage was still dealt
    const p2 = state.players.find((p) => p.id === "p2")!;
    expect(p2.life).toBe(18);
  });

  it("should send a normal spell to graveyard (not exile)", () => {
    let state = toMainPhase(twoPlayerGame());

    const spell: CardInstance = {
      instanceId: "bolt1",
      cardDataId: "Lightning Bolt",
      owner: "p1",
      controller: "p1",
      zone: ZoneType.Hand,
      zoneOwnerId: "p1",
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
      abilities: [{
        id: "bolt_spell",
        type: "spell" as const,
        sourceCardInstanceId: "bolt1",
        effects: [{ type: "dealDamage", amount: 3, to: { targetRequirementId: "t1" } }],
        zones: [ZoneType.Hand, ZoneType.Stack],
      } satisfies SpellAbilitySpell],
      modifiedPower: null,
      modifiedToughness: null,
      currentLoyalty: null,
      castingChoices: null,
      linkedEffects: {},
    };

    const hKey = handKey("p1");
    state = {
      ...state,
      cardInstances: { ...state.cardInstances, bolt1: spell },
      zones: {
        ...state.zones,
        [hKey]: {
          ...state.zones[hKey],
          cardInstanceIds: [...state.zones[hKey].cardInstanceIds, "bolt1"],
        },
      },
    };

    let result = executeAction(state, {
      type: "castSpell",
      cardInstanceId: "bolt1",
      targets: [{ requirementId: "t1", targetId: "p2", targetType: "player" }],
    });
    state = (result as any).state;

    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;

    // Normal spell goes to graveyard
    expect(state.cardInstances["bolt1"].zone).toBe(ZoneType.Graveyard);
  });
});
