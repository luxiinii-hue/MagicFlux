/**
 * Target validation — checking legality on cast and on resolution.
 *
 * A target must be legal both when chosen (spell goes on stack) and when
 * the ability resolves. If all targets become illegal, the spell fizzles.
 * If some targets remain legal, the spell resolves with those targets.
 */

import type {
  GameState,
  StackItem,
  ResolvedTarget,
  CardInstance,
} from "@magic-flux/types";
import { ZoneType } from "@magic-flux/types";
import { cardHasKeyword } from "../combat/keywords.js";

export interface TargetValidationResult {
  allTargetsIllegal: boolean;
  legalTargetIds: Set<string>;
}

/**
 * Check if a specific target is still legal.
 *
 * A target is legal if:
 * - For card targets: the card exists in a valid zone, and is not protected
 *   by hexproof from the targeting player
 * - For player targets: the player hasn't lost
 * - For stack items: the item is still on the stack
 *
 * @param controllerId The player who controls the spell/ability doing the targeting.
 *   Used for hexproof check (hexproof only blocks opponents' targeting).
 */
function isTargetLegal(
  state: GameState,
  target: ResolvedTarget,
  controllerId?: string,
): boolean {
  if (target.targetType === "player") {
    const player = state.players.find((p) => p.id === target.targetId);
    return !!player && !player.hasLost;
  }

  // Check if the target is a stack item (for counter spells)
  if (state.stackItems[target.targetId]) {
    return state.stack.includes(target.targetId);
  }

  // Card target — must exist and be in a reachable zone
  const card = state.cardInstances[target.targetId];
  if (!card) return false;

  if (card.zone !== ZoneType.Battlefield && card.zone !== ZoneType.Stack) {
    return false;
  }

  // Hexproof: can't be targeted by opponents' spells/abilities
  if (controllerId && card.controller !== controllerId && cardHasKeyword(card, "hexproof")) {
    return false;
  }

  // Shroud: can't be targeted by spells or abilities at all
  if (cardHasKeyword(card, "shroud")) {
    return false;
  }

  // Protection (simplified for now, ideally would check protection from specific colors/types)
  if (cardHasKeyword(card, "protection")) {
    return false;
  }

  return true;
}

/**
 * Validate all targets of a stack item at resolution time.
 * Returns which targets are still legal and whether the item fizzles.
 */
export function validateTargetsOnResolution(
  state: GameState,
  item: StackItem,
): TargetValidationResult {
  if (item.targets.length === 0) {
    return { allTargetsIllegal: false, legalTargetIds: new Set() };
  }

  const legalTargetIds = new Set<string>();
  let anyLegal = false;

  for (const target of item.targets) {
    if (isTargetLegal(state, target, item.controller)) {
      legalTargetIds.add(target.targetId);
      anyLegal = true;
    }
  }

  return {
    allTargetsIllegal: !anyLegal,
    legalTargetIds,
  };
}

/**
 * Validate targets when casting a spell (before it goes on the stack).
 * At cast time, all chosen targets must be legal.
 *
 * @param controllerId The player casting the spell (for hexproof check).
 */
export function validateTargetsOnCast(
  state: GameState,
  targets: readonly ResolvedTarget[],
  controllerId?: string,
): { valid: boolean; reason?: string } {
  for (const target of targets) {
    if (!isTargetLegal(state, target, controllerId)) {
      return {
        valid: false,
        reason: `Target ${target.targetId} is not a legal target`,
      };
    }
  }
  return { valid: true };
}
