import type { FC } from 'react';
import type { StackItem, CardData, ClientGameState } from '@magic-flux/types';
import { getCardImageUrl } from '../rendering/card-images';
import { showCardHover, hideCardHover } from './CardHover';
import styles from './StackDisplay.module.css';

interface StackDisplayProps {
  readonly items: readonly StackItem[];
  readonly cardDataMap: Readonly<Record<string, CardData>>;
  readonly instanceToCardDataId: Readonly<Record<string, string>>;
  readonly playerNames: Readonly<Record<string, string>>;
  readonly gameState?: ClientGameState;
}

function getTargetDescription(
  item: StackItem,
  gameState: ClientGameState | undefined,
  cardDataMap: Readonly<Record<string, CardData>>,
  playerNames: Readonly<Record<string, string>>,
): string | null {
  if (!item.targets || item.targets.length === 0) return null;

  const parts: string[] = [];
  for (const target of item.targets) {
    if (target.targetType === 'player') {
      parts.push(playerNames[target.targetId] ?? target.targetId);
    } else if (gameState) {
      const card = gameState.cardInstances[target.targetId];
      if (card) {
        const data = cardDataMap[card.cardDataId];
        parts.push(data?.name ?? card.cardDataId);
      }
    }
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

export const StackDisplay: FC<StackDisplayProps> = ({
  items,
  cardDataMap,
  instanceToCardDataId,
  playerNames,
  gameState,
}) => {
  return (
    <div className={styles.stack}>
      <div className={styles.header}>
        Stack {items.length > 0 && <span className={styles.count}>({items.length})</span>}
      </div>
      {items.length === 0 ? (
        <div className={styles.empty}>Stack is empty</div>
      ) : (
        items.map((item) => {
          const cardDataId = instanceToCardDataId[item.sourceCardInstanceId];
          const cardData = cardDataId ? cardDataMap[cardDataId] : undefined;
          const name = cardData?.name ?? cardDataId ?? 'Unknown';
          const imageUrl = cardData ? getCardImageUrl(cardData.imageUris, 'small') : '';
          const controllerName = playerNames[item.controller] ?? item.controller;
          const isSpell = item.isSpell;
          const isTrigger = item.ability?.type === 'triggered';
          const isActivated = item.ability?.type === 'activated';
          const targetDesc = getTargetDescription(item, gameState, cardDataMap, playerNames);

          const typeLabel = isSpell ? 'Spell' : isTrigger ? 'Trigger' : isActivated ? 'Ability' : 'Effect';
          const typeClass = isSpell ? styles.typeSpell
            : isTrigger ? styles.typeTrigger
            : styles.typeAbility;

          return (
            <div
              key={item.id}
              className={`${styles.item} ${isTrigger ? styles.itemTrigger : ''}`}
              onMouseEnter={(e) => { if (cardData) showCardHover(cardData, e.clientX, e.clientY); }}
              onMouseMove={(e) => { if (cardData) showCardHover(cardData, e.clientX, e.clientY); }}
              onMouseLeave={() => hideCardHover()}
            >
              {imageUrl && <img className={styles.itemImage} src={imageUrl} alt={name} />}
              <div className={styles.itemText}>
                <div className={styles.itemTop}>
                  <span className={`${styles.typeTag} ${typeClass}`}>{typeLabel}</span>
                  <span className={styles.itemName}>{name}</span>
                </div>
                <div className={styles.itemController}>{controllerName}</div>
                {targetDesc && (
                  <div className={styles.itemTargets}>→ {targetDesc}</div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
