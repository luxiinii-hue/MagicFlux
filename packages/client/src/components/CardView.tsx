import type { FC } from 'react';
import type { CardData, CardInstance } from '@magic-flux/types';
import { getCardImageUrl } from '../rendering/card-images';
import styles from './CardView.module.css';

interface CardViewProps {
  readonly cardData: CardData;
  readonly instance: CardInstance;
  readonly selected?: boolean;
  readonly highlighted?: boolean;
  readonly castable?: boolean;
  readonly playable?: boolean;
  readonly attacking?: boolean;
  readonly eligible?: boolean;
  readonly dimmed?: boolean;
  readonly onClick?: () => void;
  readonly onDragStart?: (e: React.DragEvent) => void;
  readonly onDragEnd?: (e: React.DragEvent) => void;
  readonly draggable?: boolean;
}

export const CardView: FC<CardViewProps> = ({
  cardData,
  instance,
  selected = false,
  highlighted = false,
  castable = false,
  playable = false,
  attacking = false,
  eligible = false,
  dimmed = false,
  onClick,
  onDragStart,
  onDragEnd,
  draggable = false,
}) => {
  const imageUrl = getCardImageUrl(cardData.imageUris);

  const classNames = [
    styles.card,
    instance.tapped ? styles.tapped : '',
    selected ? styles.selected : '',
    highlighted ? styles.highlighted : '',
    castable ? styles.castable : '',
    playable ? styles.playable : '',
    attacking ? styles.attacking : '',
    eligible ? styles.eligible : '',
    dimmed ? styles.dimmed : '',
  ].filter(Boolean).join(' ');

  const countersEntries = Object.entries(instance.counters);
  const isCreature = instance.modifiedPower !== null && instance.modifiedToughness !== null;

  return (
    <div
      className={classNames}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      draggable={draggable}
      role="button"
      tabIndex={0}
    >
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
