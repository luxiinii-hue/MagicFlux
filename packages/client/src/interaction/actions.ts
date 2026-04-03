/**
 * Action dispatch bridge — thin constructors that build PlayerAction
 * objects from UI-level parameters.
 */

import type { PlayerAction, ResolvedTarget } from "@magic-flux/types";

import { buildAttackerAssignments, buildBlockerAssignments } from "./combat-ui";

export function createPassPriorityAction(): PlayerAction {
  return { type: "passPriority" };
}

export function createPlayLandAction(cardInstanceId: string): PlayerAction {
  return { type: "playLand", cardInstanceId };
}

export function createCastSpellAction(
  cardInstanceId: string,
  targets: readonly ResolvedTarget[],
): PlayerAction {
  return {
    type: "castSpell",
    cardInstanceId,
    targets: targets.length > 0 ? targets : undefined,
  };
}

export function createDeclareAttackersAction(
  attackerIds: readonly string[],
  defendingPlayerId: string,
): PlayerAction {
  return {
    type: "declareAttackers",
    attackerAssignments: buildAttackerAssignments(
      attackerIds,
      defendingPlayerId,
    ),
  };
}

export function createDeclareBlockersAction(
  blockerToAttacker: Readonly<Record<string, string>>,
): PlayerAction {
  return {
    type: "declareBlockers",
    blockerAssignments: buildBlockerAssignments(blockerToAttacker),
  };
}

export function createActivateAbilityAction(
  cardInstanceId: string,
  abilityId: string,
): PlayerAction {
  return { type: "activateAbility", cardInstanceId, abilityId };
}
