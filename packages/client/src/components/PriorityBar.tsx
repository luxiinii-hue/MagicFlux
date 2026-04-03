import { useEffect } from 'react';
import type { FC } from 'react';
import styles from './PriorityBar.module.css';

interface PriorityBarProps {
  readonly hasPriority: boolean;
  readonly onPassPriority: () => void;
  readonly statusText: string;
}

export const PriorityBar: FC<PriorityBarProps> = ({
  hasPriority,
  onPassPriority,
  statusText,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && hasPriority) {
        e.preventDefault();
        onPassPriority();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPriority, onPassPriority]);

  return (
    <div className={styles.bar}>
      <span className={styles.status}>{statusText}</span>
      <button
        className={styles.passButton}
        disabled={!hasPriority}
        onClick={onPassPriority}
        aria-label="Pass Priority"
      >
        Pass Priority
        <span className={styles.shortcut}>[Space]</span>
      </button>
    </div>
  );
};
