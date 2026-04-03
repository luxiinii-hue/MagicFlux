import type { FC } from 'react';
import type { CardData, CardInstance } from '@magic-flux/types';
import { getCardImageUrl } from '../rendering/card-images';
import styles from './CardView.module.css';

interface CardViewProps {
  readonly cardData: CardData;
  readonly instance: CardInstance;
  readonly selected?: boolean;
  readonly highlighted?: boolean;
  readonly onClick?: () => void;
}

export const CardView: FC<CardViewProps> = ({
  cardData,
  instance,
  selected = false,
  highlighted = false,
  onClick,
}) => {
  const imageUrl = getCardImageUrl(cardData.imageUris);

  const classNames = [
    styles.card,
    instance.tapped ? styles.tapped : '',
    selected ? styles.selected : '',
    highlighted ? styles.highlighted : '',
  ].filter(Boolean).join(' ');

  const countersEntries = Object.entries(instance.counters);
  const isCreature = instance.modifiedPower !== null && instance.modifiedToughness !== null;

  return (
    <div className={classNames} onClick={onClick} role="button" tabIndex={0}>
      <img
        className={styles.image}
        src={imageUrl}
        alt={cardData.name}
        loading="lazy"
        role="img"
      />
      {countersEntries.length > 0 && (
        <div className={styles.counters}>
          {countersEntries.map(([type, count]) => (
            <span key={type} className={styles.counter}>
              {type}: {count}
            </span>
          ))}
        </div>
      )}
      {isCreature && (
        <div className={styles.overlay}>
          <span className={styles.pt}>
            {instance.modifiedPower}/{instance.modifiedToughness}
          </span>
        </div>
      )}
    </div>
  );
};
