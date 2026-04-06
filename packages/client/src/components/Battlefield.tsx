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
  readonly attackingCards?: readonly string[];
  readonly blockingCards?: readonly string[];
  readonly pendingBlockerId?: string | null;
  readonly onCardClick: (instanceId: string) => void;
}

export const Battlefield: FC<BattlefieldProps> = ({
  cards,
  cardDataMap,
  selectedCards,
  highlightedCards = [],
  targetableCards = [],
  attackingCards = [],
  blockingCards = [],
  pendingBlockerId = null,
  onCardClick,
}) => {
  return (
    <div className={styles.battlefield}>
      <div className={styles.grid}>
        {cards.map((card) => {
          const data = cardDataMap[card.cardDataId];
          if (!data) return null;
          const isAttacking = attackingCards.includes(card.instanceId);
          const isBlocking = blockingCards.includes(card.instanceId);
          const isPendingBlocker = card.instanceId === pendingBlockerId;
          return (
            <CardView
              key={card.instanceId}
              cardData={data}
              instance={card}
              selected={selectedCards.includes(card.instanceId)}
              highlighted={highlightedCards.includes(card.instanceId)}
              targetable={targetableCards.includes(card.instanceId)}
              attacking={isAttacking}
              eligible={isPendingBlocker}
              onClick={() => onCardClick(card.instanceId)}
            />
          );
        })}
      </div>
    </div>
  );
};
