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

export interface TargetValidationResult {
  allTargetsIllegal: boolean;
  legalTargetIds: Set<string>;
}

/**
 * Check if a specific target is still legal at resolution time.
 *
 * A target is legal if:
 * - For card targets: the card still exists in a valid zone (battlefield
 *   for permanent targets, stack for spell targets, etc.)
 * - For player targets: the player hasn't lost
 */
function isTargetLegal(state: GameState, target: ResolvedTarget): boolean {
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

  return card.zone === ZoneType.Battlefield || card.zone === ZoneType.Stack;
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
    // No targets — can't fizzle from targeting
    return { allTargetsIllegal: false, legalTargetIds: new Set() };
  }

  const legalTargetIds = new Set<string>();
  let anyLegal = false;

  for (const target of item.targets) {
    if (isTargetLegal(state, target)) {
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
 */
export function validateTargetsOnCast(
  state: GameState,
  targets: readonly ResolvedTarget[],
): { valid: boolean; reason?: string } {
  for (const target of targets) {
    if (!isTargetLegal(state, target)) {
      return {
        valid: false,
        reason: `Target ${target.targetId} is not legal`,
      };
    }
  }
  return { valid: true };
}
