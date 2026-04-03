/**
 * Explicit tests for all Phase 3 acceptance criteria.
 *
 * Tests: first strike, double strike, deathtouch+trample, menace,
 * hexproof, ETB triggered abilities, mana abilities, equipment.
 */

import { describe, it, expect } from "vitest";
import type { GameState, CardInstance, SpellAbilityTriggered } from "@magic-flux/types";
import { Phase, Step, ZoneType } from "@magic-flux/types";
import { executeAction } from "../src/actions.js";
import { processStateBasedActionsLoop } from "../src/state-based/sba.js";
import { checkTriggeredAbilities } from "../src/triggers/triggers.js";
import { attachEquipment, detachEquipment } from "../src/combat/equipment.js";
import { twoPlayerGame } from "./helpers.js";
import {
  makeCreature,
  placeOnBattlefield,
  advanceToDeclareAttackers,
  passBothPlayers,
} from "./combat-helpers.js";
import { handKey } from "../src/zones/transfers.js";
import { advanceToNextPriorityPoint } from "../src/turn/phases.js";

// Helper: run a full blocked combat between attacker and blocker
function runBlockedCombat(
  state: GameState,
  attackerId: string,
  blockerId: string,
): GameState {
  let result = executeAction(state, {
    type: "declareAttackers",
    attackerAssignments: { [attackerId]: "p2" },
  });
  let s = (result as any).state;
  s = passBothPlayers(s); // through declare attackers to declare blockers

  result = executeAction(s, {
    type: "declareBlockers",
    blockerAssignments: { [blockerId]: [attackerId] },
  });
  s = (result as any).state;

  // Pass through all combat steps
  while (s.turnState.phase === Phase.Combat) {
    if (s.priorityPlayerId === null) break;
    const r = executeAction(s, { type: "passPriority" });
    if (!r.success) break;
    s = (r as any).state;
  }

  return processStateBasedActionsLoop(s).state;
}

describe("first strike", () => {
  it("should kill blocker before it deals regular damage (AC#5)", () => {
    let state = twoPlayerGame();
    // 3/1 first strike vs 2/2
    const fsCreature = makeCreature("fs1", "First Striker", "p1", 3, 1, ["first strike"]);
    const blocker = makeCreature("blk1", "Grizzly Bears", "p2", 2, 2);
    state = placeOnBattlefield(state, fsCreature);
    state = placeOnBattlefield(state, blocker);
    state = advanceToDeclareAttackers(state);

    state = runBlockedCombat(state, "fs1", "blk1");

    // Blocker should die (3 >= 2), first striker should survive (blocker died before dealing damage)
    expect(state.cardInstances["blk1"].zone).toBe(ZoneType.Graveyard);
    expect(state.cardInstances["fs1"].zone).toBe(ZoneType.Battlefield);
  });
});

describe("double strike", () => {
  it("should deal damage in both first strike and regular steps (AC#6)", () => {
    let state = twoPlayerGame();
    // 2/2 double strike vs 4/4
    const dsCreature = makeCreature("ds1", "Double Striker", "p1", 2, 2, ["double strike"]);
    const blocker = makeCreature("blk1", "Big Beast", "p2", 1, 4);
    state = placeOnBattlefield(state, dsCreature);
    state = placeOnBattlefield(state, blocker);
    state = advanceToDeclareAttackers(state);

    state = runBlockedCombat(state, "ds1", "blk1");

    // Blocker takes 2+2=4 damage from double strike, should die
    expect(state.cardInstances["blk1"].zone).toBe(ZoneType.Graveyard);
  });
});

describe("deathtouch + trample", () => {
  it("should assign 1 to blocker and trample the rest (AC#8)", () => {
    let state = twoPlayerGame();
    // 6/6 deathtouch trample vs 4/4
    const dtTrampler = makeCreature("dt1", "DT Trampler", "p1", 6, 6, ["deathtouch", "trample"]);
    const blocker = makeCreature("blk1", "Big Blocker", "p2", 1, 4);
    state = placeOnBattlefield(state, dtTrampler);
    state = placeOnBattlefield(state, blocker);
    state = advanceToDeclareAttackers(state);

    state = runBlockedCombat(state, "dt1", "blk1");

    // With deathtouch+trample: assign 1 to blocker (lethal with deathtouch), 5 tramples
    const p2 = state.players.find((p) => p.id === "p2")!;
    expect(p2.life).toBe(15); // 20 - 5
    expect(state.cardInstances["blk1"].zone).toBe(ZoneType.Graveyard);
  });
});

describe("menace", () => {
  it("should not allow a single creature to block a menace attacker (AC#12)", () => {
    let state = twoPlayerGame();
    const menaceCreature = makeCreature("mn1", "Menace Beast", "p1", 3, 3, ["menace"]);
    const singleBlocker = makeCreature("blk1", "Grizzly Bears", "p2", 2, 2);
    state = placeOnBattlefield(state, menaceCreature);
    state = placeOnBattlefield(state, singleBlocker);
    state = advanceToDeclareAttackers(state);

    let result = executeAction(state, {
      type: "declareAttackers",
      attackerAssignments: { mn1: "p2" },
    });
    state = (result as any).state;
    state = passBothPlayers(state);

    // Try to block with single creature — menace should prevent it
    result = executeAction(state, {
      type: "declareBlockers",
      blockerAssignments: { blk1: ["mn1"] },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // Block should have been rejected due to menace
      expect(result.state.combatState!.attackers["mn1"].blocked).toBe(false);
    }
  });

  it("should allow 2+ creatures to block a menace attacker", () => {
    let state = twoPlayerGame();
    const menaceCreature = makeCreature("mn1", "Menace Beast", "p1", 3, 3, ["menace"]);
    const blocker1 = makeCreature("blk1", "Bear 1", "p2", 2, 2);
    const blocker2 = makeCreature("blk2", "Bear 2", "p2", 2, 2);
    state = placeOnBattlefield(state, menaceCreature);
    state = placeOnBattlefield(state, blocker1);
    state = placeOnBattlefield(state, blocker2);
    state = advanceToDeclareAttackers(state);

    let result = executeAction(state, {
      type: "declareAttackers",
      attackerAssignments: { mn1: "p2" },
    });
    state = (result as any).state;
    state = passBothPlayers(state);

    // Two blockers — menace allows it
    result = executeAction(state, {
      type: "declareBlockers",
      blockerAssignments: { blk1: ["mn1"], blk2: ["mn1"] },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.state.combatState!.attackers["mn1"].blocked).toBe(true);
      expect(result.state.combatState!.attackers["mn1"].blockers.length).toBe(2);
    }
  });
});

describe("hexproof", () => {
  it("should prevent opponent from targeting hexproof creature (AC#13)", () => {
    let state = twoPlayerGame();

    // p2 controls a hexproof creature on battlefield
    const hexproof = makeCreature("hex1", "Hexproof Beast", "p2", 3, 3, ["hexproof"]);
    state = placeOnBattlefield(state, hexproof);

    // p1 has a destroy spell in hand
    const doomBlade: CardInstance = {
      instanceId: "doom1",
      cardDataId: "Doom Blade",
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
        id: "doom_spell",
        type: "spell",
        sourceCardInstanceId: "doom1",
        effects: [{ type: "destroy", target: { targetRequirementId: "t1" } }],
        zones: [ZoneType.Hand, ZoneType.Stack],
      }],
      modifiedPower: null,
      modifiedToughness: null,
      currentLoyalty: null,
      castingChoices: null,
      linkedEffects: {},
    };

    // Add doom blade to p1's hand
    const hKey = handKey("p1");
    state = {
      ...state,
      cardInstances: { ...state.cardInstances, doom1: doomBlade },
      zones: {
        ...state.zones,
        [hKey]: {
          ...state.zones[hKey],
          cardInstanceIds: [...state.zones[hKey].cardInstanceIds, "doom1"],
        },
      },
    };

    // Advance to main phase
    const { state: started } = advanceToNextPriorityPoint(state);
    let s = started;
    while (!(s.turnState.phase === Phase.PreCombatMain && s.turnState.step === null)) {
      if (s.priorityPlayerId === null) {
        s = advanceToNextPriorityPoint(s).state;
        continue;
      }
      const r = executeAction(s, { type: "passPriority" });
      if (!r.success) break;
      s = r.state;
    }

    // p1 tries to cast targeting the hexproof creature
    const result = executeAction(s, {
      type: "castSpell",
      cardInstanceId: "doom1",
      targets: [{ requirementId: "t1", targetId: "hex1", targetType: "card" }],
    });

    // Should fail — hexproof prevents opponent targeting
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_TARGET");
    }
  });
});

describe("ETB triggered abilities (AC#15)", () => {
  it("should detect ETB triggers from events", () => {
    let state = twoPlayerGame();

    // Create a creature with an ETB trigger
    const etbCreature: CardInstance = {
      instanceId: "etb1",
      cardDataId: "ETB Creature",
      owner: "p1",
      controller: "p1",
      zone: ZoneType.Battlefield,
      zoneOwnerId: null,
      tapped: false,
      flipped: false,
      faceDown: false,
      transformedOrBack: false,
      phasedOut: false,
      summoningSickness: true,
      damage: 0,
      counters: {},
      attachedTo: null,
      attachments: [],
      abilities: [{
        id: "etb1_trigger",
        type: "triggered" as const,
        sourceCardInstanceId: "etb1",
        effects: [{ type: "dealDamage", amount: 2, to: { targetRequirementId: "t1" } }],
        zones: [ZoneType.Battlefield],
        triggerCondition: {
          eventType: "cardEnteredZone",
          filter: null,
          self: true,
          optional: false,
          interveningIf: null,
        },
        targets: [{
          id: "t1",
          description: "any target",
          count: { exactly: 1 },
          targetTypes: ["creature", "player"],
          filter: null,
          controller: "any",
        }],
      } satisfies SpellAbilityTriggered],
      modifiedPower: 2,
      modifiedToughness: 2,
      currentLoyalty: null,
      castingChoices: null,
      linkedEffects: {},
    };

    state = placeOnBattlefield(state, etbCreature);

    // Simulate the ETB event
    const events = [{
      type: "cardEnteredZone" as const,
      cardInstanceId: "etb1",
      toZone: ZoneType.Battlefield,
      fromZone: ZoneType.Hand,
      timestamp: 1,
    }];

    const triggers = checkTriggeredAbilities(state, events);
    expect(triggers.length).toBe(1);
    expect(triggers[0].sourceCardInstanceId).toBe("etb1");
    expect(triggers[0].ability.type).toBe("triggered");
  });
});

describe("equipment (AC#17)", () => {
  it("should attach equipment and modify creature stats", () => {
    let state = twoPlayerGame();

    const creature = makeCreature("cr1", "Grizzly Bears", "p1", 2, 2);
    state = placeOnBattlefield(state, creature);

    // Create an equipment (+2/+0)
    const equipment: CardInstance = {
      instanceId: "eq1",
      cardDataId: "Bonesplitter",
      owner: "p1",
      controller: "p1",
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
      abilities: [{
        id: "eq1_static",
        type: "static",
        sourceCardInstanceId: "eq1",
        effects: [],
        zones: [ZoneType.Battlefield],
        continuousEffect: {
          effectType: "equipment_bonus",
          affectedFilter: {},
          modification: { power: 2, toughness: 0 },
        },
        condition: null,
        layer: 7,
      }],
      modifiedPower: null,
      modifiedToughness: null,
      currentLoyalty: null,
      castingChoices: null,
      linkedEffects: {},
    };
    state = placeOnBattlefield(state, equipment);

    // Attach
    const { state: attachedState } = attachEquipment(state, "eq1", "cr1");

    // Creature should be 4/2
    expect(attachedState.cardInstances["cr1"].modifiedPower).toBe(4);
    expect(attachedState.cardInstances["cr1"].modifiedToughness).toBe(2);
    expect(attachedState.cardInstances["eq1"].attachedTo).toBe("cr1");
    expect(attachedState.cardInstances["cr1"].attachments).toContain("eq1");
  });

  it("should detach equipment and reverse stat modifications", () => {
    let state = twoPlayerGame();

    const creature = makeCreature("cr1", "Grizzly Bears", "p1", 2, 2);
    state = placeOnBattlefield(state, creature);

    const equipment: CardInstance = {
      instanceId: "eq1",
      cardDataId: "Bonesplitter",
      owner: "p1",
      controller: "p1",
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
      abilities: [{
        id: "eq1_static",
        type: "static",
        sourceCardInstanceId: "eq1",
        effects: [],
        zones: [ZoneType.Battlefield],
        continuousEffect: {
          effectType: "equipment_bonus",
          affectedFilter: {},
          modification: { power: 2, toughness: 0 },
        },
        condition: null,
        layer: 7,
      }],
      modifiedPower: null,
      modifiedToughness: null,
      currentLoyalty: null,
      castingChoices: null,
      linkedEffects: {},
    };
    state = placeOnBattlefield(state, equipment);

    // Attach then detach
    const { state: attached } = attachEquipment(state, "eq1", "cr1");
    const { state: detached } = detachEquipment(attached, "eq1");

    // Creature should be back to 2/2
    expect(detached.cardInstances["cr1"].modifiedPower).toBe(2);
    expect(detached.cardInstances["cr1"].modifiedToughness).toBe(2);
    expect(detached.cardInstances["eq1"].attachedTo).toBeNull();
  });
});
