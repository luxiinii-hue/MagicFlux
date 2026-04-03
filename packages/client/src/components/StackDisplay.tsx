import type { FC } from 'react';
import type { StackItem, CardData } from '@magic-flux/types';
import { getCardImageUrl } from '../rendering/card-images';
import styles from './StackDisplay.module.css';

interface StackDisplayProps {
  readonly items: readonly StackItem[];
  readonly cardDataMap: Readonly<Record<string, CardData>>;
  readonly instanceToCardDataId: Readonly<Record<string, string>>;
  readonly playerNames: Readonly<Record<string, string>>;
}

export const StackDisplay: FC<StackDisplayProps> = ({
  items,
  cardDataMap,
  instanceToCardDataId,
  playerNames,
}) => {
  return (
    <div className={styles.stack}>
      <div className={styles.header}>Stack</div>
      {items.length === 0 ? (
        <div className={styles.empty}>Stack is empty</div>
      ) : (
        items.map((item) => {
          const cardDataId = instanceToCardDataId[item.sourceCardInstanceId];
          const cardData = cardDataId ? cardDataMap[cardDataId] : undefined;
          const name = cardData?.name ?? 'Unknown';
          const imageUrl = cardData ? getCardImageUrl(cardData.imageUris, 'small') : '';
          const controllerName = playerNames[item.controller] ?? item.controller;

          return (
            <div key={item.id} className={styles.item}>
              {imageUrl && <img className={styles.itemImage} src={imageUrl} alt={name} />}
              <div className={styles.itemText}>
                <div className={styles.itemName}>{name}</div>
                <div className={styles.itemController}>{controllerName}</div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
