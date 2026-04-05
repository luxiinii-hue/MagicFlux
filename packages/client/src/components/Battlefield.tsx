import type { FC } from 'react';
import type { CardData, CardInstance } from '@magic-flux/types';
import { CardView } from './CardView';
import styles from './Battlefield.module.css';

interface BattlefieldProps {
  readonly cards: readonly CardInstance[];
  readonly cardDataMap: Readonly<Record<string, CardData>>;
  readonly selectedCards: readonly string[];
  readonly highlightedCards?: readonly string[];
  readonly targetableCards?: readonly string[];
  readonly onCardClick: (instanceId: string) => void;
}

export const Battlefield: FC<BattlefieldProps> = ({
  cards,
  cardDataMap,
  selectedCards,
  highlightedCards = [],
  targetableCards = [],
  onCardClick,
}) => {
  return (
    <div className={styles.battlefield}>
      <div className={styles.grid}>
        {cards.map((card) => {
          const data = cardDataMap[card.cardDataId];
          if (!data) return null;
          return (
            <CardView
              key={card.instanceId}
              cardData={data}
              instance={card}
              selected={selectedCards.includes(card.instanceId)}
              highlighted={highlightedCards.includes(card.instanceId)}
              targetable={targetableCards.includes(card.instanceId)}
              onClick={() => onCardClick(card.instanceId)}
            />
          );
        })}
      </div>
    </div>
  );
};
