import { useState } from 'react';
import type { FC } from 'react';
import type { CardData, CardInstance } from '@magic-flux/types';
import { getCardImageUrl } from '../rendering/card-images';
import { showCardHover, hideCardHover } from './CardHover';
import styles from './MulliganScreen.module.css';

interface MulliganScreenProps {
  readonly cards: CardInstance[];
  readonly cardDataMap: Readonly<Record<string, CardData>>;
  readonly mulliganCount: number;
  readonly phase: 'decide' | 'putOnBottom';
  readonly putOnBottomCount: number;
  readonly opponentStatus: string;
  readonly onKeep: () => void;
  readonly onMulligan: () => void;
  readonly onPutOnBottom: (cardIds: string[]) => void;
}

export const MulliganScreen: FC<MulliganScreenProps> = ({
  cards,
  cardDataMap,
  mulliganCount,
  phase,
  putOnBottomCount,
  opponentStatus,
  onKeep,
  onMulligan,
  onPutOnBottom,
}) => {
  const [selectedForBottom, setSelectedForBottom] = useState<string[]>([]);

  const toggleCardForBottom = (instanceId: string) => {
    setSelectedForBottom((prev) =>
      prev.includes(instanceId)
        ? prev.filter((id) => id !== instanceId)
        : prev.length < putOnBottomCount
          ? [...prev, instanceId]
          : prev,
    );
  };

  const handleConfirmBottom = () => {
    if (selectedForBottom.length === putOnBottomCount) {
      onPutOnBottom(selectedForBottom);
      setSelectedForBottom([]);
    }
  };

  const handSizeAfterKeep = 7 - mulliganCount;

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <div className={styles.title}>
          {phase === 'decide'
            ? mulliganCount === 0
              ? 'Opening Hand'
              : `Mulligan ${mulliganCount}`
            : `Put ${putOnBottomCount} card${putOnBottomCount > 1 ? 's' : ''} on bottom`
          }
        </div>

        <div className={styles.subtitle}>
          {phase === 'decide'
            ? `${cards.length} cards — ${mulliganCount > 0 ? `keeping ${handSizeAfterKeep}` : 'keep this hand?'}`
            : `Select ${putOnBottomCount - selectedForBottom.length} more`
          }
        </div>

        <div className={styles.opponentStatus}>{opponentStatus}</div>

        <div className={styles.hand}>
          {cards.map((card, i) => {
            const cardData = cardDataMap[card.cardDataId];
            const imageUrl = cardData
              ? getCardImageUrl(cardData.imageUris, 'normal')
              : getCardImageUrl(null);
            const isSelected = selectedForBottom.includes(card.instanceId);
            const fanAngle = (i - (cards.length - 1) / 2) * 3;
            const fanY = Math.abs(i - (cards.length - 1) / 2) * 4;

            return (
              <div
                key={card.instanceId}
                className={`${styles.card} ${isSelected ? styles.cardSelected : ''} ${phase === 'putOnBottom' ? styles.cardSelectable : ''}`}
                style={{
                  transform: `rotate(${fanAngle}deg) translateY(${fanY}px)`,
                  zIndex: i,
                }}
                onClick={phase === 'putOnBottom' ? () => toggleCardForBottom(card.instanceId) : undefined}
                onMouseEnter={(e) => { if (cardData) showCardHover(cardData, e.clientX, e.clientY); }}
                onMouseMove={(e) => { if (cardData) showCardHover(cardData, e.clientX, e.clientY); }}
                onMouseLeave={() => hideCardHover()}
              >
                <img
                  className={styles.cardImage}
                  src={imageUrl}
                  alt={card.cardDataId}
                  loading="lazy"
                />
                {isSelected && <div className={styles.selectedBadge}>{selectedForBottom.indexOf(card.instanceId) + 1}</div>}
              </div>
            );
          })}
        </div>

        <div className={styles.buttons}>
          {phase === 'decide' ? (
            <>
              <button className={styles.keepButton} onClick={onKeep}>
                Keep{mulliganCount > 0 ? ` (${handSizeAfterKeep} cards)` : ''}
              </button>
              {handSizeAfterKeep > 1 && (
                <button className={styles.mulliganButton} onClick={onMulligan}>
                  Mulligan
                </button>
              )}
            </>
          ) : (
            <button
              className={styles.confirmButton}
              disabled={selectedForBottom.length !== putOnBottomCount}
              onClick={handleConfirmBottom}
            >
              Put on bottom ({selectedForBottom.length}/{putOnBottomCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
