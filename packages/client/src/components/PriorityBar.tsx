import { useEffect, useRef } from 'react';
import type { FC } from 'react';
import type { PlayerAction, ClientGameState } from '@magic-flux/types';
import { shouldAutoPass } from '../interaction/auto-pass';
import styles from './PriorityBar.module.css';

interface PriorityBarProps {
  readonly hasPriority: boolean;
  readonly onPassPriority: () => void;
  readonly statusText: string;
  readonly autoPass: boolean;
  readonly onToggleAutoPass: () => void;
  readonly gameState: ClientGameState;
  readonly viewingPlayerId: string;
  readonly legalActions: readonly PlayerAction[];
}

export const PriorityBar: FC<PriorityBarProps> = ({
  hasPriority,
  onPassPriority,
  statusText,
  autoPass,
  onToggleAutoPass,
  gameState,
  viewingPlayerId,
  legalActions,
}) => {
  // Track whether we've already scheduled an auto-pass for this priority window.
  // Use a ref for the timer so re-renders don't cancel it.
  const autoPassTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPriorityPlayer = useRef<string | null>(null);

  useEffect(() => {
    const currentPriorityPlayer = gameState.priorityPlayerId;

    // Priority changed — reset auto-pass state
    if (currentPriorityPlayer !== lastPriorityPlayer.current) {
      lastPriorityPlayer.current = currentPriorityPlayer;
      if (autoPassTimer.current) {
        clearTimeout(autoPassTimer.current);
        autoPassTimer.current = null;
      }
    }

    if (!autoPass || !hasPriority) return;

    // Don't schedule if one is already pending
    if (autoPassTimer.current) return;

    const shouldPass = shouldAutoPass(gameState, viewingPlayerId, legalActions);

    if (shouldPass) {
      autoPassTimer.current = setTimeout(() => {
        autoPassTimer.current = null;
        onPassPriority();
      }, 100);
    }

    // No cleanup — we intentionally let the timer survive re-renders
  }); // No dependency array — run on every render to catch state changes

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoPassTimer.current) clearTimeout(autoPassTimer.current);
    };
  }, []);

  // Space bar to pass priority
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

  // Compute label based on what auto-pass would do right now
  let autoPassLabel = 'Auto-pass OFF';
  if (autoPass) {
    if (hasPriority) {
      const wouldPass = shouldAutoPass(gameState, viewingPlayerId, legalActions);
      autoPassLabel = wouldPass ? 'Auto-pass (passing...)' : 'Auto-pass (stopped)';
    } else {
      autoPassLabel = 'Auto-pass ON';
    }
  }

  return (
    <div className={styles.bar}>
      <span className={styles.status}>{statusText}</span>
      <div className={styles.controls}>
        <button
          className={`${styles.autoPassButton} ${autoPass ? styles.autoPassOn : ''}`}
          onClick={onToggleAutoPass}
          title="Smart auto-pass: skips non-interactive phases, stops for decisions. (F2)"
        >
          {autoPassLabel}
        </button>
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
    </div>
  );
};
