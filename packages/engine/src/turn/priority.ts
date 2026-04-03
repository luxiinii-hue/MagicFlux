/**
 * Priority system.
 *
 * Priority determines who can act. After any game event, the active player
 * receives priority. When a player passes, priority goes to the next player
 * in turn order. When all players have passed in succession:
 * - If the stack is non-empty: resolve the top item.
 * - If the stack is empty: advance to the next phase/step.
 */

import type { GameState } from "@magic-flux/types";

/**
 * Get the next player who should receive priority after the current
 * priority holder passes.
 */
export function getNextPriorityPlayer(state: GameState): string {
  const activePlayers = state.players.filter((p) => !p.hasLost);
  const currentIdx = activePlayers.findIndex(
    (p) => p.id === state.priorityPlayerId,
  );
  return activePlayers[(currentIdx + 1) % activePlayers.length].id;
}

/**
 * Check if all active players have passed priority consecutively.
 */
export function allPlayersPassed(state: GameState): boolean {
  const activePlayerCount = state.players.filter((p) => !p.hasLost).length;
  return state.consecutivePasses >= activePlayerCount;
}

/**
 * Grant priority to a specific player. Resets the consecutive pass count.
 */
export function grantPriority(state: GameState, playerId: string): GameState {
  return {
    ...state,
    priorityPlayerId: playerId,
    consecutivePasses: 0,
  };
}

/**
 * Record a priority pass. Increments the consecutive pass counter and
 * moves priority to the next player.
 */
export function passPriority(state: GameState): GameState {
  const nextPlayer = getNextPriorityPlayer(state);
  return {
    ...state,
    priorityPlayerId: nextPlayer,
    consecutivePasses: state.consecutivePasses + 1,
  };
}
