/**
 * Client-side game log formatter.
 *
 * Enriches raw server log messages with card names and player names,
 * adds color categories, and filters out noise events.
 */

import type { GameEvent, ClientGameState, CardData } from '@magic-flux/types';

export type LogCategory =
  | 'combat'    // red/orange — damage, attackers, blockers
  | 'spell'     // blue — casting, resolving, countering
  | 'life'      // green/red — life changes
  | 'phase'     // gray — phase/turn changes
  | 'zone'      // dim — card movement
  | 'system'    // gray — game over, player lost
  | 'mana';     // filtered out by default

export interface FormattedLogEntry {
  readonly message: string;
  readonly category: LogCategory;
  readonly timestamp: number;
}

/** Events to filter out of the log (noisy, not interesting to players) */
const FILTERED_EVENTS = new Set([
  'manaAdded',
  'cardTapped',
  'cardUntapped',
  'phaseChanged',
]);

export function formatLogEntry(
  event: GameEvent,
  serverMessage: string,
  state: ClientGameState | null,
  cardDataMap: Readonly<Record<string, CardData>>,
): FormattedLogEntry | null {
  // Filter noise
  if (FILTERED_EVENTS.has(event.type)) {
    return null;
  }

  const cardName = (instanceId: string): string => {
    if (!state) return instanceId;
    const card = state.cardInstances[instanceId];
    if (!card) return instanceId;
    const data = cardDataMap[card.cardDataId];
    return data?.name ?? card.cardDataId;
  };

  const playerName = (playerId: string): string => {
    if (!state) return playerId;
    const player = state.players.find((p) => p.id === playerId);
    return player?.name ?? playerId;
  };

  const targetName = (targetRef: { targetId: string; targetType: string }): string => {
    if (targetRef.targetType === 'player') return playerName(targetRef.targetId);
    return cardName(targetRef.targetId);
  };

  switch (event.type) {
    case 'turnBegan': {
      // Show per-player turn number: turn 1&2 are "Turn 1" for each player, 3&4 are "Turn 2", etc.
      const playerCount = state?.players.length ?? 2;
      const playerTurnNumber = Math.ceil(event.turnNumber / playerCount);
      return {
        message: `— ${playerName(event.activePlayerId)}'s Turn ${playerTurnNumber} —`,
        category: 'phase',
        timestamp: event.timestamp,
      };
    }

    case 'lifeChanged':
      return {
        message: `${playerName(event.playerId)}: ${event.oldLife} → ${event.newLife} life (${event.reason})`,
        category: 'life',
        timestamp: event.timestamp,
      };

    case 'spellCast': {
      // Look up targets from the stack item
      let targetText = '';
      if (state) {
        for (const stackId of state.stack) {
          const item = state.stackItems[stackId];
          if (item?.sourceCardInstanceId === event.cardInstanceId && item.targets?.length > 0) {
            const targetNames = item.targets.map((t) =>
              t.targetType === 'player' ? playerName(t.targetId) : cardName(t.targetId)
            );
            targetText = ` targeting ${targetNames.join(', ')}`;
            break;
          }
        }
      }
      return {
        message: `${playerName(event.playerId)} casts ${cardName(event.cardInstanceId)}${targetText}`,
        category: 'spell',
        timestamp: event.timestamp,
      };
    }

    case 'abilityTriggered':
      return {
        message: `  ⚡ ${cardName((event as any).cardInstanceId)} triggers`,
        category: 'spell',
        timestamp: event.timestamp,
      };

    case 'abilityActivated':
      return {
        message: `${playerName((event as any).playerId)} activates ${cardName((event as any).cardInstanceId)}`,
        category: 'spell',
        timestamp: event.timestamp,
      };

    case 'stackItemResolved':
      return null; // Filtered — the zone change message already communicates resolution

    case 'stackItemCountered':
      return {
        message: `Spell countered!`,
        category: 'spell',
        timestamp: event.timestamp,
      };

    case 'damageDealt': {
      const source = cardName(event.sourceInstanceId);
      const target = targetName(event.targetRef);
      const combatLabel = event.isCombatDamage ? ' (combat)' : '';
      return {
        message: `${source} deals ${event.amount} damage to ${target}${combatLabel}`,
        category: 'combat',
        timestamp: event.timestamp,
      };
    }

    case 'attackersDeclared':
      return {
        message: event.attackerIds.length === 0
          ? 'No attackers declared'
          : `Attacking with ${event.attackerIds.map(cardName).join(', ')}`,
        category: 'combat',
        timestamp: event.timestamp,
      };

    case 'blockersDeclared': {
      const count = Object.keys(event.blockerAssignments).length;
      return {
        message: count === 0
          ? 'No blockers declared'
          : `${count} blocker(s) assigned`,
        category: 'combat',
        timestamp: event.timestamp,
      };
    }

    case 'cardDestroyed':
      return {
        message: `${cardName(event.cardInstanceId)} destroyed`,
        category: 'combat',
        timestamp: event.timestamp,
      };

    case 'cardEnteredZone':
      if (event.toZone === 'Battlefield') {
        return {
          message: `${cardName(event.cardInstanceId)} enters the battlefield`,
          category: 'zone',
          timestamp: event.timestamp,
        };
      }
      if (event.toZone === 'Graveyard') {
        return {
          message: `${cardName(event.cardInstanceId)} goes to graveyard`,
          category: 'zone',
          timestamp: event.timestamp,
        };
      }
      return null; // Other zone changes are noise

    case 'tokenCreated':
      return {
        message: `Token created: ${cardName(event.cardInstanceId)}`,
        category: 'spell',
        timestamp: event.timestamp,
      };

    case 'playerLost':
      return {
        message: `${playerName(event.playerId)} has lost (${event.reason})`,
        category: 'system',
        timestamp: event.timestamp,
      };

    case 'gameOver':
      return {
        message: `Game Over! Winner: ${event.winnerIds.map(playerName).join(', ')}`,
        category: 'system',
        timestamp: event.timestamp,
      };

    default:
      return null; // Filter unknown events
  }
}

/** CSS color for each log category */
export const LOG_COLORS: Record<LogCategory, string> = {
  combat: '#ff8844',
  spell: '#6699ff',
  life: '#66cc66',
  phase: '#888888',
  zone: '#999999',
  system: '#ffcc44',
  mana: '#666666',
};
