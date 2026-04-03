import type { CombatState } from '@magic-flux/types';

/**
 * Maps each attacker ID to the defending player ID.
 * Used to build the DeclareAttackers action payload.
 */
export function buildAttackerAssignments(
  attackerIds: readonly string[],
  defendingPlayerId: string,
): Record<string, string> {
  const assignments: Record<string, string> = {};
  for (const id of attackerIds) {
    assignments[id] = defendingPlayerId;
  }
  return assignments;
}

/**
 * Converts a blocker→attacker map (blockerId: attackerId) to the action
 * format (blockerId: [attackerIds]). Each blocker blocks exactly one
 * attacker, so the array is always length 1.
 */
export function buildBlockerAssignments(
  assignments: Readonly<Record<string, string>>,
): Record<string, readonly string[]> {
  const result: Record<string, readonly string[]> = {};
  for (const [blockerId, attackerId] of Object.entries(assignments)) {
    result[blockerId] = [attackerId];
  }
  return result;
}

/**
 * Extracts attacker instance IDs from the current combat state.
 * Returns an empty array when combat state is null (not in combat).
 */
export function getAttackerIds(combatState: CombatState | null): string[] {
  if (combatState === null) {
    return [];
  }
  return Object.keys(combatState.attackers);
}

/**
 * Returns the ID of the defending player (the first player whose ID
 * is not the active player). Falls back to activePlayerId if no
 * opponent is found (should not happen in a real game).
 */
export function getDefendingPlayerId(
  players: readonly { id: string }[],
  activePlayerId: string,
): string {
  const opponent = players.find((p) => p.id !== activePlayerId);
  return opponent ? opponent.id : activePlayerId;
}
