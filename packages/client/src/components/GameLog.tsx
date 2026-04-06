import { useEffect, useRef } from 'react';
import type { FC } from 'react';
import type { GameEvent, ClientGameState, CardData } from '@magic-flux/types';
import { formatLogEntry, LOG_COLORS, type FormattedLogEntry } from '../rendering/log-formatter';
import styles from './GameLog.module.css';

interface RawLogEntry {
  readonly event: GameEvent;
  readonly message: string;
}

interface GameLogProps {
  readonly entries: readonly RawLogEntry[];
  readonly gameState: ClientGameState | null;
  readonly cardDataMap: Readonly<Record<string, CardData>>;
}

export const GameLog: FC<GameLogProps> = ({ entries, gameState, cardDataMap }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  // Format entries with card/player names and filtering
  const formatted: FormattedLogEntry[] = [];
  for (const entry of entries) {
    const result = formatLogEntry(entry.event, entry.message, gameState, cardDataMap);
    if (result) formatted.push(result);
  }

  return (
    <div className={styles.log}>
      {formatted.length === 0 ? (
        <div className={styles.empty}>No events yet</div>
      ) : (
        formatted.map((entry, i) => (
          <div
            key={i}
            className={`${styles.entry} ${entry.category === 'phase' ? styles.phaseEntry : ''}`}
            style={{ color: LOG_COLORS[entry.category] }}
          >
            {entry.message}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
};
