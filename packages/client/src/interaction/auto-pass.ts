/**
 * Smart auto-pass logic.
 *
 * Determines whether the client should automatically pass priority
 * based on the current game context. The goal is to skip all
 * non-interactive priority windows while stopping whenever the
 * player might want to act.
 *
 * STOPS (does not auto-pass) when:
 * - It's your main phase (you might play lands or cast sorceries)
 * - It's declare attackers and you're the active player (you choose attackers)
 * - It's declare blockers and you're the defending player (you choose blockers)
 * - There are items on the stack AND you have instant-speed responses available
 * - You're being prompted for a choice (sacrifice, discard, etc.)
 *
 * AUTO-PASSES when:
 * - It's your turn in non-main, non-combat-choice phases (beginning, ending)
 * - It's opponent's turn and you have no instant-speed plays
 * - Stack is empty and it's not a decision point
 * - You only have passPriority (and optionally concede) as legal actions
 */

import type { PlayerAction, ClientGameState } from '@magic-flux/types';
import { Phase, Step } from '@magic-flux/types';

/**
 * Determine whether to auto-pass priority.
 *
 * @returns true if the player has nothing meaningful to do and should auto-pass
 */
export function shouldAutoPass(
  gameState: ClientGameState,
  viewingPlayerId: string,
  legalActions: readonly PlayerAction[],
): boolean {
  const isMyTurn = gameState.activePlayerId === viewingPlayerId;
  const { phase, step } = gameState.turnState;
  const stackHasItems = gameState.stack.length > 0;

  // Count meaningful actions (everything except passPriority and concede)
  const meaningfulActions = legalActions.filter(
    (a) => a.type !== 'passPriority' && a.type !== 'concede',
  );
  const hasMeaningfulActions = meaningfulActions.length > 0;

  // If the only things you can do are pass and concede, always auto-pass
  if (!hasMeaningfulActions) {
    return true;
  }

  // --- Your turn ---
  if (isMyTurn) {
    // Main phases: STOP — you might want to play lands, cast sorceries, etc.
    if (phase === Phase.PreCombatMain || phase === Phase.PostCombatMain) {
      return false;
    }

    // Declare attackers step: STOP — you choose attackers
    if (phase === Phase.Combat && step === Step.DeclareAttackers) {
      return false;
    }

    // Stack has items: STOP — you might want to respond to triggers/abilities
    if (stackHasItems) {
      return false;
    }

    // Beginning/ending/other combat steps on your turn with no stack:
    // auto-pass unless you have instant-speed plays you'd want to use
    // For simplicity, auto-pass here — advanced users can toggle off
    return true;
  }

  // --- Opponent's turn ---

  // Declare blockers step: STOP — you choose blockers
  if (phase === Phase.Combat && step === Step.DeclareBlockers) {
    // Only stop if you actually have creatures that could block
    const hasBlockAction = meaningfulActions.some((a) => a.type === 'declareBlockers');
    if (hasBlockAction) return false;
  }

  // Stack has items from opponent: STOP if you have instant-speed responses
  if (stackHasItems) {
    const hasInstantResponse = meaningfulActions.some(
      (a) => a.type === 'castSpell' || a.type === 'activateAbility',
    );
    if (hasInstantResponse) return false;
  }

  // Opponent's turn, no stack or no responses: auto-pass
  return true;
}
