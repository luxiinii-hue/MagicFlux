import { useEffect, useRef } from 'react';
import type { FC } from 'react';
import styles from './GameLog.module.css';

interface LogEntry {
  readonly message: string;
}

interface GameLogProps {
  readonly entries: readonly LogEntry[];
}

export const GameLog: FC<GameLogProps> = ({ entries }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  return (
    <div className={styles.log}>
      <div className={styles.header}>Game Log</div>
      {entries.length === 0 ? (
        <div className={styles.empty}>No events yet</div>
      ) : (
        entries.map((entry, i) => (
          <div key={i} className={styles.entry}>
            {entry.message}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
};
