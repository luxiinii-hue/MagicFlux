/**
 * Trigger notification toast — slides in when a triggered ability
 * goes on the stack, shows the source card and effect description.
 * Auto-dismisses after a few seconds.
 */

import { useState, useEffect, useRef } from 'react';
import type { FC } from 'react';
import type { GameEvent, CardData, ClientGameState } from '@magic-flux/types';
import { getCardImageUrl } from '../rendering/card-images';
import styles from './TriggerToast.module.css';

interface TriggerToastEntry {
  readonly id: string;
  readonly cardName: string;
  readonly imageUrl: string;
  readonly message: string;
  readonly timestamp: number;
}

interface TriggerToastProps {
  readonly gameLog: readonly { event: GameEvent; message: string }[];
  readonly gameState: ClientGameState | null;
  readonly cardDataMap: Readonly<Record<string, CardData>>;
}

export const TriggerToast: FC<TriggerToastProps> = ({
  gameLog,
  gameState,
  cardDataMap,
}) => {
  const [toasts, setToasts] = useState<TriggerToastEntry[]>([]);
  const lastLogLength = useRef(0);

  useEffect(() => {
    if (gameLog.length <= lastLogLength.current) {
      lastLogLength.current = gameLog.length;
      return;
    }

    // Check new log entries for trigger events
    const newEntries = gameLog.slice(lastLogLength.current);
    lastLogLength.current = gameLog.length;

    const newToasts: TriggerToastEntry[] = [];
    for (const entry of newEntries) {
      if (entry.event.type === 'abilityTriggered') {
        const cardInstanceId = (entry.event as any).cardInstanceId;
        const card = gameState?.cardInstances[cardInstanceId];
        const cardData = card ? cardDataMap[card.cardDataId] : undefined;
        const cardName = cardData?.name ?? card?.cardDataId ?? 'Unknown';
        const imageUrl = cardData ? getCardImageUrl(cardData.imageUris, 'small') : '';

        newToasts.push({
          id: `toast_${Date.now()}_${cardInstanceId}`,
          cardName,
          imageUrl,
          message: `Triggered: ${cardName}`,
          timestamp: Date.now(),
        });
      }
    }

    if (newToasts.length > 0) {
      setToasts((prev) => [...prev, ...newToasts].slice(-5)); // Keep last 5
    }
  }, [gameLog.length, gameState, cardDataMap]);

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 4000);
    return () => clearTimeout(timer);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast, i) => (
        <div
          key={toast.id}
          className={styles.toast}
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          {toast.imageUrl && (
            <img className={styles.cardImage} src={toast.imageUrl} alt={toast.cardName} />
          )}
          <div className={styles.content}>
            <div className={styles.label}>Triggered Ability</div>
            <div className={styles.cardName}>{toast.cardName}</div>
          </div>
          <div className={styles.lightning}>&#9889;</div>
        </div>
      ))}
    </div>
  );
};
