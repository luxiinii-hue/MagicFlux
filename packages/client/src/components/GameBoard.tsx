import type { FC } from 'react';
import type { CardData, CardInstance, ClientGameState, ClientHandZone, ClientLibraryZone, PlayerAction } from '@magic-flux/types';
import { ZoneType } from '@magic-flux/types';
import { PlayerPanel } from './PlayerPanel';
import { Battlefield } from './Battlefield';
import { Hand } from './Hand';
import { isCastableCard, isPlayableLand } from '../interaction/targeting';
import styles from './GameBoard.module.css';

interface GameBoardProps {
  readonly gameState: ClientGameState;
  readonly cardDataMap: Readonly<Record<string, CardData>>;
  readonly viewingPlayerId: string;
  readonly selectedCards: readonly string[];
  readonly highlightedCards?: readonly string[];
  readonly legalActions?: readonly PlayerAction[];
  readonly onCardClick: (instanceId: string) => void;
  readonly onPlayerClick?: (playerId: string) => void;
  readonly targetablePlayerIds?: readonly string[];
  readonly targetableCardIds?: readonly string[];
}

function getBattlefieldCards(state: ClientGameState, playerId: string): CardInstance[] {
  const bfZone = state.zones['battlefield'];
  if (!bfZone || !('cardInstanceIds' in bfZone) || !bfZone.cardInstanceIds) return [];
  return bfZone.cardInstanceIds
    .map((id) => state.cardInstances[id])
    .filter((c): c is CardInstance => c !== undefined && c.controller === playerId);
}

function getHandData(
  state: ClientGameState,
  playerId: string,
  viewingPlayerId: string,
): { cards: CardInstance[] | null; cardCount: number } {
  const handZone = state.zones[`player:${playerId}:hand`];
  if (!handZone) return { cards: null, cardCount: 0 };

  if ('cardCount' in handZone) {
    const hz = handZone as ClientHandZone;
    if (hz.cardInstanceIds && playerId === viewingPlayerId) {
      const cards = hz.cardInstanceIds
        .map((id) => state.cardInstances[id])
        .filter((c): c is CardInstance => c !== undefined);
      return { cards, cardCount: hz.cardCount };
    }
    return { cards: null, cardCount: hz.cardCount };
  }

  return { cards: null, cardCount: 0 };
}

function getLibraryCount(state: ClientGameState, playerId: string): number {
  const libZone = state.zones[`player:${playerId}:library`];
  if (libZone && 'cardCount' in libZone) {
    return (libZone as ClientLibraryZone).cardCount;
  }
  return 0;
}

export const GameBoard: FC<GameBoardProps> = ({
  gameState,
  cardDataMap,
  viewingPlayerId,
  selectedCards,
  highlightedCards = [],
  legalActions = [],
  onCardClick,
  onPlayerClick,
  targetablePlayerIds = [],
  targetableCardIds = [],
}) => {
  const viewingPlayer = gameState.players.find((p) => p.id === viewingPlayerId);
  const opponents = gameState.players.filter((p) => p.id !== viewingPlayerId);

  return (
    <div className={styles.board}>
      {/* Opponents (top) — works for 1-5 opponents */}
      {opponents.map((opp) => {
        const hand = getHandData(gameState, opp.id, viewingPlayerId);
        return (
          <div key={opp.id} className={styles.opponentSection}>
            <PlayerPanel
              player={opp}
              isActive={gameState.activePlayerId === opp.id}
              hasPriority={gameState.priorityPlayerId === opp.id}
              libraryCount={getLibraryCount(gameState, opp.id)}
              targetable={targetablePlayerIds.includes(opp.id)}
              onClick={() => onPlayerClick?.(opp.id)}
            />
            <Hand
              cards={hand.cards}
              cardDataMap={cardDataMap}
              isOwner={false}
              cardCount={hand.cardCount}
              onCardClick={onCardClick}
            />
            <div className={styles.battlefieldSection}>
              <div className={styles.battlefieldLabel}>{opp.name}</div>
              <Battlefield
                cards={getBattlefieldCards(gameState, opp.id)}
                cardDataMap={cardDataMap}
                selectedCards={selectedCards}
                highlightedCards={highlightedCards}
                targetableCards={targetableCardIds}
                onCardClick={onCardClick}
              />
            </div>
          </div>
        );
      })}

      {/* Viewing player (bottom) */}
      {viewingPlayer && (() => {
        const hand = getHandData(gameState, viewingPlayer.id, viewingPlayerId);
        return (
          <div className={styles.playerSection}>
            <div className={styles.battlefieldSection}>
              <div className={styles.battlefieldLabel}>You</div>
              <Battlefield
                cards={getBattlefieldCards(gameState, viewingPlayer.id)}
                cardDataMap={cardDataMap}
                selectedCards={selectedCards}
                highlightedCards={highlightedCards}
                targetableCards={targetableCardIds}
                onCardClick={onCardClick}
              />
            </div>
            <PlayerPanel
              player={viewingPlayer}
              isActive={gameState.activePlayerId === viewingPlayer.id}
              hasPriority={gameState.priorityPlayerId === viewingPlayer.id}
              libraryCount={getLibraryCount(gameState, viewingPlayer.id)}
              targetable={targetablePlayerIds.includes(viewingPlayer.id)}
              onClick={() => onPlayerClick?.(viewingPlayer.id)}
            />
            <Hand
              cards={hand.cards}
              cardDataMap={cardDataMap}
              isOwner
              cardCount={hand.cardCount}
              selectedCards={selectedCards}
              legalActions={legalActions}
              onCardClick={onCardClick}
            />
          </div>
        );
      })()}
    </div>
  );
};
