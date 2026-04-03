/**
 * Targeting helper functions — pure logic for determining castable cards,
 * playable lands, targeting completeness, and eligible attackers/blockers.
 */

import type { PlayerAction, ClientGameState, CardInstance } from '@magic-flux/types';
import { ZoneType } from '@magic-flux/types';

/**
 * Returns true if any legal action is a `castSpell` with the given cardInstanceId.
 */
export function isCastableCard(
  cardInstanceId: string,
  legalActions: readonly PlayerAction[],
): boolean {
  return legalActions.some(
    (a) => a.type === 'castSpell' && a.cardInstanceId === cardInstanceId,
  );
}

/**
 * Returns true if any legal action is a `playLand` with the given cardInstanceId.
 */
export function isPlayableLand(
  cardInstanceId: string,
  legalActions: readonly PlayerAction[],
): boolean {
  return legalActions.some(
    (a) => a.type === 'playLand' && a.cardInstanceId === cardInstanceId,
  );
}

/**
 * Returns true when the player has selected enough targets.
 */
export function isTargetingComplete(
  selectedCount: number,
  requiredCount: number,
): boolean {
  return selectedCount >= requiredCount;
}

/**
 * Returns instanceIds of creatures the player can declare as attackers.
 *
 * Eligible: on the battlefield, controlled by the player, not tapped,
 * no summoning sickness, and is a creature (modifiedPower !== null).
 */
export function getEligibleAttackerIds(
  state: ClientGameState,
  playerId: string,
): string[] {
  const battlefield = state.zones['battlefield'];
  if (!battlefield || !('cardInstanceIds' in battlefield)) {
    return [];
  }

  return battlefield.cardInstanceIds.filter((id) => {
    const card: CardInstance | undefined = state.cardInstances[id];
    if (!card) return false;
    return (
      card.controller === playerId &&
      !card.tapped &&
      !card.summoningSickness &&
      card.modifiedPower !== null
    );
  });
}

/**
 * Returns instanceIds of creatures the player can declare as blockers.
 *
 * Eligible: on the battlefield, controlled by the player, not tapped,
 * and is a creature (modifiedPower !== null).
 */
export function getEligibleBlockerIds(
  state: ClientGameState,
  playerId: string,
): string[] {
  const battlefield = state.zones['battlefield'];
  if (!battlefield || !('cardInstanceIds' in battlefield)) {
    return [];
  }

  return battlefield.cardInstanceIds.filter((id) => {
    const card: CardInstance | undefined = state.cardInstances[id];
    if (!card) return false;
    return (
      card.controller === playerId &&
      !card.tapped &&
      card.modifiedPower !== null
    );
  });
}
