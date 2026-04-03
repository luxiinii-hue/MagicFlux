import type { FC } from 'react';
import type { CardData, CardInstance, PlayerAction } from '@magic-flux/types';
import { CardView } from './CardView';
import { isCastableCard, isPlayableLand } from '../interaction/targeting';
import styles from './Hand.module.css';

interface HandProps {
  readonly cards: readonly CardInstance[] | null;
  readonly cardDataMap: Readonly<Record<string, CardData>>;
  readonly isOwner: boolean;
  readonly cardCount: number;
  readonly selectedCards?: readonly string[];
  readonly legalActions?: readonly PlayerAction[];
  readonly onCardClick: (instanceId: string) => void;
}

export const Hand: FC<HandProps> = ({
  cards,
  cardDataMap,
  isOwner,
  cardCount,
  selectedCards = [],
  legalActions = [],
  onCardClick,
}) => {
  if (!isOwner || !cards) {
    return (
      <div className={styles.opponentHand}>
        {cardCount} {cardCount === 1 ? 'card' : 'cards'}
      </div>
    );
  }

  return (
    <div className={styles.hand}>
      <div className={styles.fan}>
        {cards.map((card) => {
          const data = cardDataMap[card.cardDataId];
          if (!data) return null;
          return (
            <CardView
              key={card.instanceId}
              cardData={data}
              instance={card}
              selected={selectedCards.includes(card.instanceId)}
              castable={isCastableCard(card.instanceId, legalActions)}
              playable={isPlayableLand(card.instanceId, legalActions)}
              onClick={() => onCardClick(card.instanceId)}
            />
          );
        })}
      </div>
    </div>
  );
};
