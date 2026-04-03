/**
 * Equipment system — equip, attach, detach, stat modification.
 *
 * Equipment is an artifact that can be attached to a creature using the
 * Equip activated ability. While attached, it grants stat modifications
 * and/or keywords to the equipped creature via continuous effects.
 *
 * When the equipped creature leaves the battlefield, the equipment
 * becomes unattached but stays on the battlefield.
 */

import type {
  GameState,
  GameEvent,
  CardInstance,
  ContinuousEffect,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";

/**
 * Attach an equipment to a creature. Updates both cards' attachment
 * references and creates continuous effects for the equipment's bonuses.
 */
export function attachEquipment(
  state: GameState,
  equipmentId: string,
  creatureId: string,
): { state: GameState; events: GameEvent[] } {
  const equipment = state.cardInstances[equipmentId];
  const creature = state.cardInstances[creatureId];

  if (!equipment || !creature) {
    throw new Error("Equipment or creature not found");
  }
  if (equipment.zone !== ZoneType.Battlefield || creature.zone !== ZoneType.Battlefield) {
    throw new Error("Both equipment and creature must be on the battlefield");
  }

  // Detach from current creature if already attached
  let updatedState = state;
  if (equipment.attachedTo) {
    updatedState = detachEquipment(updatedState, equipmentId).state;
  }

  // Update equipment: set attachedTo
  const updatedEquipment: CardInstance = {
    ...updatedState.cardInstances[equipmentId],
    attachedTo: creatureId,
  };

  // Update creature: add to attachments
  const updatedCreature: CardInstance = {
    ...updatedState.cardInstances[creatureId],
    attachments: [...updatedState.cardInstances[creatureId].attachments, equipmentId],
  };

  updatedState = {
    ...updatedState,
    cardInstances: {
      ...updatedState.cardInstances,
      [equipmentId]: updatedEquipment,
      [creatureId]: updatedCreature,
    },
  };

  // Apply equipment's continuous effects
  // The equipment's static abilities create continuous effects that apply
  // to the equipped creature. These are managed by the layer system.
  // For Phase 3, we handle P/T modifications directly on the creature.
  const equipmentAbilities = updatedEquipment.abilities;
  for (const ability of equipmentAbilities) {
    if (ability.type === "static" && ability.continuousEffect) {
      const mod = ability.continuousEffect.modification as Record<string, any>;
      if (mod.power !== undefined || mod.toughness !== undefined) {
        const powerMod = (mod.power as number) ?? 0;
        const toughnessMod = (mod.toughness as number) ?? 0;
        const currentCreature = updatedState.cardInstances[creatureId];
        updatedState = {
          ...updatedState,
          cardInstances: {
            ...updatedState.cardInstances,
            [creatureId]: {
              ...currentCreature,
              modifiedPower: (currentCreature.modifiedPower ?? 0) + powerMod,
              modifiedToughness: (currentCreature.modifiedToughness ?? 0) + toughnessMod,
            },
          },
        };
      }
    }
  }

  return { state: updatedState, events: [] };
}

/**
 * Detach an equipment from its current creature.
 * Reverses stat modifications.
 */
export function detachEquipment(
  state: GameState,
  equipmentId: string,
): { state: GameState; events: GameEvent[] } {
  const equipment = state.cardInstances[equipmentId];
  if (!equipment || !equipment.attachedTo) {
    return { state, events: [] };
  }

  const creatureId = equipment.attachedTo;
  const creature = state.cardInstances[creatureId];

  let updatedState = state;

  // Reverse P/T modifications
  if (creature) {
    for (const ability of equipment.abilities) {
      if (ability.type === "static" && ability.continuousEffect) {
        const mod = ability.continuousEffect.modification as Record<string, any>;
        if (mod.power !== undefined || mod.toughness !== undefined) {
          const powerMod = (mod.power as number) ?? 0;
          const toughnessMod = (mod.toughness as number) ?? 0;
          const currentCreature = updatedState.cardInstances[creatureId];
          updatedState = {
            ...updatedState,
            cardInstances: {
              ...updatedState.cardInstances,
              [creatureId]: {
                ...currentCreature,
                modifiedPower: (currentCreature.modifiedPower ?? 0) - powerMod,
                modifiedToughness: (currentCreature.modifiedToughness ?? 0) - toughnessMod,
              },
            },
          };
        }
      }
    }

    // Remove equipment from creature's attachments
    const currentCreature = updatedState.cardInstances[creatureId];
    updatedState = {
      ...updatedState,
      cardInstances: {
        ...updatedState.cardInstances,
        [creatureId]: {
          ...currentCreature,
          attachments: currentCreature.attachments.filter((id) => id !== equipmentId),
        },
      },
    };
  }

  // Clear equipment's attachedTo
  updatedState = {
    ...updatedState,
    cardInstances: {
      ...updatedState.cardInstances,
      [equipmentId]: {
        ...updatedState.cardInstances[equipmentId],
        attachedTo: null,
      },
    },
  };

  return { state: updatedState, events: [] };
}
