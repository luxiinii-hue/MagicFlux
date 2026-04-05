/**
 * Copy effects — Clone, Fork, Phantasmal Image, etc.
 *
 * Two modes:
 * 1. Copy permanent: create a new CardInstance that copies all copiable
 *    values of the original (name, types, P/T, abilities). This is
 *    Layer 1 in the layer system.
 * 2. Copy spell: create a copy of a spell on the stack with new targets.
 *
 * Copiable values (CR 707.2): name, mana cost, color, type, supertype,
 * subtype, rules text, power, toughness, loyalty. Does NOT copy counters,
 * damage, tapped state, attached objects, or non-copiable modifications.
 */

import type {
  GameState,
  GameEvent,
  CardInstance,
  StackItem,
  SpellAbility,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

let copyCounter = 0;

// ---------------------------------------------------------------------------
// Copy a permanent (Clone pattern)
// ---------------------------------------------------------------------------

/**
 * Create a copy of a permanent on the battlefield.
 * The copy enters as a new CardInstance with the original's copiable values.
 * Returns the updated state with the new copy on the battlefield.
 */
export function copyPermanent(
  state: GameState,
  originalId: string,
  controllerId: string,
): { state: GameState; events: GameEvent[]; copyId: string } {
  const original = state.cardInstances[originalId];
  if (!original) {
    throw new Error(`Cannot copy: card ${originalId} not found`);
  }

  const copyId = `copy_${++copyCounter}_${originalId}`;

  // Copy copiable values from the original
  const copy: CardInstance = {
    instanceId: copyId,
    cardDataId: original.cardDataId,
    owner: controllerId,
    controller: controllerId,
    zone: ZoneType.Battlefield,
    zoneOwnerId: null,
    // Non-copiable values reset to defaults
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
    // Copiable values from original
    abilities: [...original.abilities],
    modifiedPower: original.modifiedPower,
    modifiedToughness: original.modifiedToughness,
    basePower: original.basePower,
    baseToughness: original.baseToughness,
    isLegendary: original.isLegendary,
    currentLoyalty: original.currentLoyalty,
    castingChoices: null,
    linkedEffects: {},
  };

  // Add to card instances and battlefield
  const bf = state.zones["battlefield"];
  const updatedState: GameState = {
    ...state,
    cardInstances: { ...state.cardInstances, [copyId]: copy },
    zones: {
      ...state.zones,
      battlefield: {
        ...bf,
        cardInstanceIds: [copyId, ...bf.cardInstanceIds],
      },
    },
  };

  const events: GameEvent[] = [
    {
      type: "cardEnteredZone",
      cardInstanceId: copyId,
      toZone: ZoneType.Battlefield,
      fromZone: null,
      timestamp: Date.now(),
    },
  ];

  return { state: updatedState, events, copyId };
}

// ---------------------------------------------------------------------------
// Copy a spell on the stack (Fork pattern)
// ---------------------------------------------------------------------------

/**
 * Create a copy of a spell on the stack. The copy can have new targets.
 * Returns the updated state with the copy on top of the stack.
 */
export function copySpell(
  state: GameState,
  originalStackItemId: string,
  controllerId: string,
  newTargets?: StackItem["targets"],
): { state: GameState; events: GameEvent[]; copyStackItemId: string } {
  const original = state.stackItems[originalStackItemId];
  if (!original) {
    throw new Error(`Cannot copy: stack item ${originalStackItemId} not found`);
  }

  const copyId = `copy_stack_${++copyCounter}_${originalStackItemId}`;

  const copy: StackItem = {
    id: copyId,
    sourceCardInstanceId: original.sourceCardInstanceId,
    ability: original.ability,
    controller: controllerId,
    targets: newTargets ?? original.targets,
    isSpell: original.isSpell,
    isCopy: true, // Mark as copy — won't move a card to graveyard on resolution
    choices: original.choices,
  };

  const updatedState: GameState = {
    ...state,
    stack: [copyId, ...state.stack],
    stackItems: { ...state.stackItems, [copyId]: copy },
  };

  const events: GameEvent[] = [
    {
      type: "spellCast",
      cardInstanceId: original.sourceCardInstanceId,
      playerId: controllerId,
      timestamp: Date.now(),
    },
  ];

  return { state: updatedState, events, copyStackItemId: copyId };
}
