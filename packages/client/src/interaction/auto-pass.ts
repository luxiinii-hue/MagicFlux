/**
 * Smart auto-pass logic with configurable yield settings.
 *
 * Each stop condition can be individually toggled via AutoPassSettings.
 */

import type { PlayerAction, ClientGameState } from '@magic-flux/types';
import { Phase, Step } from '@magic-flux/types';
import type { AutoPassSettings } from '../state/settings';

const DEFAULT_CONFIG: AutoPassSettings = {
  stopAtMainPhase: true,
  stopAtAttackers: true,
  stopAtBlockers: true,
  yieldWhenNoActions: true,
  stopOnOpponentSpell: true,
  stopWithInstants: true,
};

/**
 * Determine whether to auto-pass priority.
 *
 * @returns true if the player should auto-pass based on context and settings
 */
export function shouldAutoPass(
  gameState: ClientGameState,
  viewingPlayerId: string,
  legalActions: readonly PlayerAction[],
  config: AutoPassSettings = DEFAULT_CONFIG,
): boolean {
  const isMyTurn = gameState.activePlayerId === viewingPlayerId;
  const { phase, step } = gameState.turnState;
  const stackHasItems = gameState.stack.length > 0;

  const meaningfulActions = legalActions.filter(
    (a) => a.type !== 'passPriority' && a.type !== 'concede',
  );
  const hasMeaningfulActions = meaningfulActions.length > 0;
  const hasInstants = meaningfulActions.some(
    (a) => a.type === 'castSpell' || a.type === 'activateAbility',
  );

  // --- Your turn ---
  if (isMyTurn) {
    // Main phases
    if (config.stopAtMainPhase && (phase === Phase.PreCombatMain || phase === Phase.PostCombatMain)) {
      return false;
    }

    // Declare attackers
    if (config.stopAtAttackers && phase === Phase.Combat && step === Step.DeclareAttackers) {
      return false;
    }

    // Stack has items on your turn — always stop (you may want to respond)
    if (stackHasItems) {
      return false;
    }

    // Stop if you have instants and the setting says to
    if (config.stopWithInstants && hasInstants) {
      return false;
    }

    // Yield when no meaningful actions
    if (config.yieldWhenNoActions && !hasMeaningfulActions) {
      return true;
    }

    // Default: auto-pass non-decision steps on your turn
    return !hasMeaningfulActions;
  }

  // --- Opponent's turn ---

  // Yield when no meaningful actions
  if (config.yieldWhenNoActions && !hasMeaningfulActions) {
    return true;
  }

  // Declare blockers
  if (config.stopAtBlockers && phase === Phase.Combat && step === Step.DeclareBlockers) {
    const hasBlockAction = meaningfulActions.some((a) => a.type === 'declareBlockers');
    if (hasBlockAction) return false;
  }

  // Stop when opponent casts a spell and you have responses
  if (config.stopOnOpponentSpell && stackHasItems && hasInstants) {
    return false;
  }

  // Stop when you have instants available (even without stack)
  if (config.stopWithInstants && hasInstants && !stackHasItems) {
    // Only stop if there's something meaningful to do at this timing
    // (having instants during opponent's upkeep might not warrant stopping)
    return true; // Still auto-pass — the stack check above handles the response case
  }

  // Default: auto-pass on opponent's turn
  return true;
}
