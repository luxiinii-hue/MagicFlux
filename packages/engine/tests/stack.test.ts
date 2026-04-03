/**
 * Phase 2 tests: stack, spell casting, effect resolution, targeting, fizzle.
 *
 * These tests create game states with cards that have spell abilities,
 * cast them onto the stack, and verify resolution behavior.
 */

import { describe, it, expect } from "vitest";
import type {
  GameState,
  CardInstance,
  StackItem,
  SpellAbility,
  SpellAbilitySpell,
  Effect,
  ResolvedTarget,
  ManaPool,
} from "@magic-flux/types";
import { Phase, Step, ZoneType } from "@magic-flux/types";
import { executeAction, getLegalActions } from "../src/actions.js";
import { pushToStack, resolveTopOfStack } from "../src/stack/stack.js";
import { advanceToNextPriorityPoint } from "../src/turn/phases.js";
import { twoPlayerGame } from "./helpers.js";
import { handKey, libraryKey, moveCard } from "../src/zones/transfers.js";

// ---------------------------------------------------------------------------
// Helpers: create cards with spell abilities
// ---------------------------------------------------------------------------

/** Create a simple instant spell card (like Lightning Bolt). */
function makeSpellCard(
  instanceId: string,
  name: string,
  owner: string,
  effects: Effect[],
): CardInstance {
  const spellAbility: SpellAbilitySpell = {
    id: `${instanceId}_spell`,
    type: "spell",
    sourceCardInstanceId: instanceId,
    effects,
    zones: [ZoneType.Hand, ZoneType.Stack],
  };

  return {
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
}

/** Inject a spell card into a player's hand in a game state. */
function addCardToHand(state: GameState, card: CardInstance, playerId: string): GameState {
  const hKey = `player:${playerId}:hand`;
  const hand = state.zones[hKey];

  return {
    ...state,
    cardInstances: { ...state.cardInstances, [card.instanceId]: card },
    zones: {
      ...state.zones,
      [hKey]: {
        ...hand,
        cardInstanceIds: [...hand.cardInstanceIds, card.instanceId],
      },
    },
  };
}

/** Put a card on the battlefield. */
function addCardToBattlefield(state: GameState, card: CardInstance): GameState {
  const bf = state.zones["battlefield"];
  const updatedCard = { ...card, zone: ZoneType.Battlefield, zoneOwnerId: null };
  return {
    ...state,
    cardInstances: { ...state.cardInstances, [card.instanceId]: updatedCard },
    zones: {
      ...state.zones,
      battlefield: {
        ...bf,
        cardInstanceIds: [...bf.cardInstanceIds, card.instanceId],
      },
    },
  };
}

/** Advance game to main phase with priority. */
function toMainPhase(state: GameState): GameState {
  const { state: started } = advanceToNextPriorityPoint(state);
  let s = started;
  while (!(s.turnState.phase === Phase.PreCombatMain && s.turnState.step === null)) {
    if (s.priorityPlayerId === null) {
      const adv = advanceToNextPriorityPoint(s);
      s = adv.state;
      continue;
    }
    const result = executeAction(s, { type: "passPriority" });
    if (!result.success) throw new Error("Failed to pass");
    s = result.state;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("stack operations", () => {
  it("should push a stack item and grant priority to active player", () => {
    let state = toMainPhase(twoPlayerGame());

    const boltCard = makeSpellCard("bolt1", "Lightning Bolt", "p1", [
      {
        type: "dealDamage",
        amount: 3,
        to: { targetRequirementId: "t1" },
      },
    ]);
    state = addCardToHand(state, boltCard, "p1");

    // Move card to stack zone first
    const moveResult = moveCard(state, "bolt1", handKey("p1"), "stack", Date.now());
    state = moveResult.state;

    const stackItem: StackItem = {
      id: "stack_bolt1",
      sourceCardInstanceId: "bolt1",
      ability: boltCard.abilities[0],
      controller: "p1",
      targets: [{ requirementId: "t1", targetId: "p2", targetType: "player" }],
      isSpell: true,
      isCopy: false,
      choices: null,
    };

    const pushResult = pushToStack(state, stackItem);
    expect(pushResult.state.stack).toContain("stack_bolt1");
    expect(pushResult.state.stackItems["stack_bolt1"]).toBeDefined();
    expect(pushResult.state.priorityPlayerId).toBe("p1"); // Active player gets priority
  });

  it("should resolve top of stack (LIFO) and apply effects", () => {
    let state = toMainPhase(twoPlayerGame());

    const boltCard = makeSpellCard("bolt1", "Lightning Bolt", "p1", [
      {
        type: "dealDamage",
        amount: 3,
        to: { targetRequirementId: "t1" },
      },
    ]);
    state = addCardToHand(state, boltCard, "p1");

    // Move to stack and push
    const moveResult = moveCard(state, "bolt1", handKey("p1"), "stack", Date.now());
    state = moveResult.state;

    const stackItem: StackItem = {
      id: "stack_bolt1",
      sourceCardInstanceId: "bolt1",
      ability: boltCard.abilities[0],
      controller: "p1",
      targets: [{ requirementId: "t1", targetId: "p2", targetType: "player" }],
      isSpell: true,
      isCopy: false,
      choices: null,
    };

    const pushResult = pushToStack(state, stackItem);
    state = pushResult.state;

    // Resolve
    const resolveResult = resolveTopOfStack(state);
    state = resolveResult.state;

    // Stack should be empty
    expect(state.stack).toHaveLength(0);

    // p2 should have taken 3 damage (20 - 3 = 17)
    const p2 = state.players.find((p) => p.id === "p2")!;
    expect(p2.life).toBe(17);

    // Bolt should be in graveyard
    const bolt = state.cardInstances["bolt1"];
    expect(bolt.zone).toBe(ZoneType.Graveyard);
  });
});

describe("castSpell action", () => {
  it("should cast a spell from hand onto the stack", () => {
    let state = toMainPhase(twoPlayerGame());

    const boltCard = makeSpellCard("bolt1", "Lightning Bolt", "p1", [
      {
        type: "dealDamage",
        amount: 3,
        to: { targetRequirementId: "t1" },
      },
    ]);
    state = addCardToHand(state, boltCard, "p1");

    const result = executeAction(state, {
      type: "castSpell",
      cardInstanceId: "bolt1",
      targets: [{ requirementId: "t1", targetId: "p2", targetType: "player" }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      // Card should be on the stack
      expect(result.state.stack.length).toBe(1);
      expect(result.state.cardInstances["bolt1"].zone).toBe(ZoneType.Stack);

      // Card should no longer be in hand
      const hand = result.state.zones[handKey("p1")];
      expect(hand.cardInstanceIds).not.toContain("bolt1");
    }
  });

  it("should resolve a spell when all players pass", () => {
    let state = toMainPhase(twoPlayerGame());

    const boltCard = makeSpellCard("bolt1", "Lightning Bolt", "p1", [
      {
        type: "dealDamage",
        amount: 3,
        to: { targetRequirementId: "t1" },
      },
    ]);
    state = addCardToHand(state, boltCard, "p1");

    // Cast the spell
    let result = executeAction(state, {
      type: "castSpell",
      cardInstanceId: "bolt1",
      targets: [{ requirementId: "t1", targetId: "p2", targetType: "player" }],
    });
    expect(result.success).toBe(true);
    state = (result as any).state;

    // Both players pass priority — spell resolves
    result = executeAction(state, { type: "passPriority" }); // p1 passes
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" }); // p2 passes
    state = (result as any).state;

    // Spell resolved — p2 took 3 damage
    const p2 = state.players.find((p) => p.id === "p2")!;
    expect(p2.life).toBe(17);

    // Stack should be empty
    expect(state.stack).toHaveLength(0);

    // Bolt in graveyard
    expect(state.cardInstances["bolt1"].zone).toBe(ZoneType.Graveyard);
  });
});

describe("effect resolution", () => {
  function setupAndCastSpell(effects: Effect[], targets: ResolvedTarget[]) {
    let state = toMainPhase(twoPlayerGame());
    const card = makeSpellCard("spell1", "Test Spell", "p1", effects);
    state = addCardToHand(state, card, "p1");

    let result = executeAction(state, {
      type: "castSpell",
      cardInstanceId: "spell1",
      targets,
    });
    state = (result as any).state;

    // Both pass — resolve
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    return (result as any).state as GameState;
  }

  it("should resolve gainLife effect", () => {
    const state = setupAndCastSpell(
      [{ type: "gainLife", amount: 5, player: { type: "controller" } }],
      [],
    );
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.life).toBe(25); // 20 + 5
  });

  it("should resolve loseLife effect", () => {
    const state = setupAndCastSpell(
      [{ type: "loseLife", amount: 3, player: { type: "targetPlayer", targetRef: { targetRequirementId: "t1" } } }],
      [{ requirementId: "t1", targetId: "p2", targetType: "player" }],
    );
    const p2 = state.players.find((p) => p.id === "p2")!;
    expect(p2.life).toBe(17); // 20 - 3
  });

  it("should resolve drawCards effect", () => {
    const state = setupAndCastSpell(
      [{ type: "drawCards", count: 3, player: { type: "controller" } }],
      [],
    );
    // p1 drew 3 extra cards (hand started at 7, played spell = 6, drew 3 = 9)
    // Actually: hand was 7 + bolt = 8, cast = 7, then draw 3 = 10
    const hand = state.zones[handKey("p1")];
    // Starting 7 cards + 1 test spell injected - 1 cast + 3 drawn = 10
    expect(hand.cardInstanceIds.length).toBe(10);
  });

  it("should resolve addMana effect (Dark Ritual style)", () => {
    const state = setupAndCastSpell(
      [{ type: "addMana", mana: { W: 0, U: 0, B: 3, R: 0, G: 0, C: 0 }, player: { type: "controller" } }],
      [],
    );
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.manaPool.B).toBe(3);
  });
});

describe("targeting and fizzle", () => {
  it("should fizzle when the only target becomes illegal", () => {
    let state = toMainPhase(twoPlayerGame());

    // Create a creature on the battlefield
    const creature = makeSpellCard("creature1", "Grizzly Bears", "p2", []);
    const creatureOnBF: CardInstance = {
      ...creature,
      zone: ZoneType.Battlefield,
      zoneOwnerId: null,
      modifiedPower: 2,
      modifiedToughness: 2,
    };
    state = addCardToBattlefield(state, creatureOnBF);

    // Create a destroy spell targeting the creature
    const doom = makeSpellCard("doom1", "Doom Blade", "p1", [
      { type: "destroy", target: { targetRequirementId: "t1" } },
    ]);
    state = addCardToHand(state, doom, "p1");

    // Cast targeting the creature
    let result = executeAction(state, {
      type: "castSpell",
      cardInstanceId: "doom1",
      targets: [{ requirementId: "t1", targetId: "creature1", targetType: "card" }],
    });
    state = (result as any).state;

    // Remove the creature from battlefield before resolution (simulating another effect)
    const bf = state.zones["battlefield"];
    const updatedBF = {
      ...bf,
      cardInstanceIds: bf.cardInstanceIds.filter((id) => id !== "creature1"),
    };
    const updatedCreature: CardInstance = {
      ...state.cardInstances["creature1"],
      zone: ZoneType.Graveyard,
      zoneOwnerId: "p2",
    };
    state = {
      ...state,
      zones: { ...state.zones, battlefield: updatedBF },
      cardInstances: { ...state.cardInstances, creature1: updatedCreature },
    };

    // Both pass — spell should fizzle
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;

    // Stack should be empty (fizzled)
    expect(state.stack).toHaveLength(0);
    // Doom Blade should be in graveyard (fizzled spells still go to graveyard)
    expect(state.cardInstances["doom1"].zone).toBe(ZoneType.Graveyard);
  });
});

describe("counter spell effect", () => {
  it("should counter a spell on the stack", () => {
    let state = toMainPhase(twoPlayerGame());

    // p1 casts a spell
    const bolt = makeSpellCard("bolt1", "Lightning Bolt", "p1", [
      { type: "dealDamage", amount: 3, to: { targetRequirementId: "t1" } },
    ]);
    state = addCardToHand(state, bolt, "p1");

    let result = executeAction(state, {
      type: "castSpell",
      cardInstanceId: "bolt1",
      targets: [{ requirementId: "t1", targetId: "p2", targetType: "player" }],
    });
    state = (result as any).state;

    // Get the stack item ID for the bolt
    const boltStackId = state.stack[0];

    // p1 passes priority to p2
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;

    // p2 casts Counterspell targeting the bolt on the stack
    const counter = makeSpellCard("counter1", "Counterspell", "p2", [
      { type: "counter", target: { targetRequirementId: "t1" } },
    ]);
    state = addCardToHand(state, counter, "p2");

    result = executeAction(state, {
      type: "castSpell",
      cardInstanceId: "counter1",
      targets: [{ requirementId: "t1", targetId: boltStackId, targetType: "card" }],
    });
    state = (result as any).state;

    // Both pass — Counterspell resolves first (LIFO)
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;
    result = executeAction(state, { type: "passPriority" });
    state = (result as any).state;

    // Bolt should have been countered — p2 life unchanged
    const p2 = state.players.find((p) => p.id === "p2")!;
    expect(p2.life).toBe(20);

    // Bolt should be in p1's graveyard (countered)
    expect(state.cardInstances["bolt1"].zone).toBe(ZoneType.Graveyard);
  });
});
