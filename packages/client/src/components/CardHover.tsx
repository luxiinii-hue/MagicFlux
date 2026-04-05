import { useState, useEffect } from 'react';
import type { FC } from 'react';
import type { CardData } from '@magic-flux/types';
import { getCardImageUrl } from '../rendering/card-images';
import styles from './CardHover.module.css';

interface CardHoverProps {
  readonly enabled: boolean;
}

interface HoverTarget {
  readonly cardData: CardData;
  readonly x: number;
  readonly y: number;
}

/**
 * Global card hover preview. Renders a large card image near the cursor
 * when hovering over a card. Other components dispatch hover events via
 * the exported showCardHover / hideCardHover functions.
 */

let hoverListener: ((target: HoverTarget | null) => void) | null = null;

export function showCardHover(cardData: CardData, x: number, y: number): void {
  hoverListener?.({ cardData, x, y });
}

export function hideCardHover(): void {
  hoverListener?.(null);
}

export const CardHover: FC<CardHoverProps> = ({ enabled }) => {
  const [target, setTarget] = useState<HoverTarget | null>(null);

  useEffect(() => {
    hoverListener = setTarget;
    return () => { hoverListener = null; };
  }, []);

  if (!enabled || !target) return null;

  const imageUrl = getCardImageUrl(target.cardData.imageUris, 'large');

  // Position: prefer right side of cursor, flip to left if too close to edge
  const viewportWidth = window.innerWidth;
  const previewWidth = 300;
  const left = target.x + previewWidth + 20 > viewportWidth
    ? target.x - previewWidth - 10
    : target.x + 20;
  const top = Math.max(10, Math.min(target.y - 100, window.innerHeight - 430));

  return (
    <div className={styles.preview} style={{ left, top }}>
      <img
        className={styles.image}
        src={imageUrl}
        alt={target.cardData.name}
      />
      <div className={styles.name}>{target.cardData.name}</div>
    </div>
  );
};
