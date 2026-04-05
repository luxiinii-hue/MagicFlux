/**
 * Combat test helpers — create creature cards and set up combat scenarios.
 */

import type {
  GameState,
  CardInstance,
  SpellAbility,
  SpellAbilityStatic,
  ContinuousEffectDefinition,
} from "@magic-flux/types";
import { Phase, Step, ZoneType } from "@magic-flux/types";
import { executeAction } from "../src/actions.js";
import { advanceToNextPriorityPoint } from "../src/turn/phases.js";
import { twoPlayerGame } from "./helpers.js";

/** Create a creature card with given P/T and optional keywords. */
export function makeCreature(
  instanceId: string,
  name: string,
  owner: string,
  power: number,
  toughness: number,
  keywords: string[] = [],
): CardInstance {
  const abilities: SpellAbility[] = [];

  // Add keyword static abilities
  for (const keyword of keywords) {
    const staticAbility: SpellAbilityStatic = {
      id: `${instanceId}_${keyword}`,
      type: "static",
      sourceCardInstanceId: instanceId,
      effects: [],
      zones: [ZoneType.Battlefield],
      continuousEffect: {
        effectType: keyword.toLowerCase(),
        affectedFilter: {},
        modification: {},
      },
      condition: null,
      layer: keyword.toLowerCase() === "flying" || keyword.toLowerCase() === "reach" ? 6 : 7,
    };
    abilities.push(staticAbility);
  }

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
    summoningSickness: false, // Already controlled since last turn
    damage: 0,
    counters: {},
    attachedTo: null,
    attachments: [],
    abilities,
    modifiedPower: power,
    modifiedToughness: toughness,
    basePower: power,
    baseToughness: toughness,
    isLegendary: false,
    currentLoyalty: null,
    castingChoices: null,
    linkedEffects: {},
  };
}

/** Place a creature on the battlefield in a game state. */
export function placeOnBattlefield(state: GameState, card: CardInstance): GameState {
  const bf = state.zones["battlefield"];
  return {
    ...state,
    cardInstances: { ...state.cardInstances, [card.instanceId]: card },
    zones: {
      ...state.zones,
      battlefield: {
        ...bf,
        cardInstanceIds: [...bf.cardInstanceIds, card.instanceId],
      },
    },
  };
}

/** Advance game to the declare attackers step of combat. */
export function advanceToDeclareAttackers(state: GameState): GameState {
  const { state: started } = advanceToNextPriorityPoint(state);
  let s = started;

  // Pass until we reach DeclareAttackers
  for (let i = 0; i < 500; i++) {
    if (
      s.turnState.phase === Phase.Combat &&
      s.turnState.step === Step.DeclareAttackers
    ) {
      return s;
    }

    if (s.priorityPlayerId === null) {
      const adv = advanceToNextPriorityPoint(s);
      s = adv.state;
      continue;
    }

    const result = executeAction(s, { type: "passPriority" });
    if (!result.success) throw new Error("Failed to pass");
    s = result.state;
  }
  throw new Error("Could not reach declare attackers step");
}

/** Pass both players through a combat step. */
export function passBothPlayers(state: GameState): GameState {
  let s = state;
  // Pass until phase/step changes
  const origPhase = s.turnState.phase;
  const origStep = s.turnState.step;

  for (let i = 0; i < 10; i++) {
    if (s.priorityPlayerId === null) {
      const adv = advanceToNextPriorityPoint(s);
      s = adv.state;
      break;
    }
    const result = executeAction(s, { type: "passPriority" });
    if (!result.success) throw new Error("Pass failed: " + result.error.message);
    s = result.state;

    if (s.turnState.phase !== origPhase || s.turnState.step !== origStep) break;
  }
  return s;
}
