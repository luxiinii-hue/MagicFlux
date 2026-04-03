/**
 * Converts GameEvents into human-readable log messages.
 */

import type { GameEvent } from "@magic-flux/types";

export function formatEventLog(event: GameEvent): string {
  switch (event.type) {
    case "phaseChanged":
      return `Phase changed to ${event.phase} (${event.step ?? "no step"})`;
    case "turnBegan":
      return `Turn ${event.turnNumber} begins (active player: ${event.activePlayerId})`;
    case "lifeChanged":
      return `Player ${event.playerId}: life ${event.oldLife} → ${event.newLife} (${event.reason})`;
    case "manaAdded":
      return `Player ${event.playerId}: added mana`;
    case "cardEnteredZone":
      return `Card ${event.cardInstanceId} entered ${event.toZone}`;
    case "cardLeftZone":
      return `Card ${event.cardInstanceId} left ${event.fromZone}`;
    case "spellCast":
      return `Player ${event.playerId} cast spell (${event.cardInstanceId})`;
    case "abilityActivated":
      return `Player ${event.playerId} activated ability on ${event.cardInstanceId}`;
    case "abilityTriggered":
      return `Triggered ability from ${event.cardInstanceId}`;
    case "stackItemResolved":
      return `Stack item resolved: ${event.stackItemId}`;
    case "stackItemCountered":
      return `Stack item countered: ${event.stackItemId}`;
    case "damageDealt":
      return `${event.sourceInstanceId} dealt ${event.amount} damage to ${event.targetRef.targetId}`;
    case "combatDamageDealt":
      return `Combat damage dealt`;
    case "attackersDeclared":
      return `Attackers declared: ${event.attackerIds.length} creature(s)`;
    case "blockersDeclared":
      return `Blockers declared: ${Object.keys(event.blockerAssignments).length} creature(s)`;
    case "cardTapped":
      return `Card ${event.cardInstanceId} tapped`;
    case "cardUntapped":
      return `Card ${event.cardInstanceId} untapped`;
    case "cardDestroyed":
      return `Card ${event.cardInstanceId} destroyed`;
    case "tokenCreated":
      return `Token created: ${event.cardInstanceId}`;
    case "counterAdded":
      return `Counter added to ${event.cardInstanceId}: ${event.counterType}`;
    case "counterRemoved":
      return `Counter removed from ${event.cardInstanceId}: ${event.counterType}`;
    case "playerLost":
      return `Player ${event.playerId} lost (${event.reason})`;
    case "gameOver":
      return `Game over. Winners: ${event.winnerIds.join(", ")}`;
    default:
      return `Unknown event: ${(event as { type: string }).type}`;
  }
}
