import type { FC } from 'react';
import type { ClientGameState, CardInstance, PlayerAction } from '@magic-flux/types';
import styles from './CombatPanel.module.css';

interface CombatPanelProps {
  readonly mode: 'declareAttackers' | 'declareBlockers';
  readonly gameState: ClientGameState;
  readonly viewingPlayerId: string;
  readonly selectedAttackerIds: readonly string[];
  readonly blockerAssignments: Readonly<Record<string, string>>;
  readonly onConfirmAttackers: () => void;
  readonly onConfirmBlockers: () => void;
  readonly onCancel: () => void;
}

export const CombatPanel: FC<CombatPanelProps> = ({
  mode,
  gameState,
  viewingPlayerId,
  selectedAttackerIds,
  blockerAssignments,
  onConfirmAttackers,
  onConfirmBlockers,
  onCancel,
}) => {
  if (mode === 'declareAttackers') {
    return (
      <div className={styles.panel}>
        <div className={styles.banner}>
          Declare Attackers — click creatures to attack
        </div>
        <div className={styles.info}>
          {selectedAttackerIds.length === 0
            ? 'No attackers selected (pass combat to skip)'
            : `${selectedAttackerIds.length} creature${selectedAttackerIds.length > 1 ? 's' : ''} attacking`
          }
        </div>
        <div className={styles.buttons}>
          <button className={styles.cancelButton} onClick={onCancel}>
            Cancel
          </button>
          <button className={styles.confirmButton} onClick={onConfirmAttackers}>
            {selectedAttackerIds.length === 0 ? 'Skip Combat' : 'Confirm Attack'}
          </button>
        </div>
      </div>
    );
  }

  const blockerCount = Object.keys(blockerAssignments).length;

  return (
    <div className={styles.panel}>
      <div className={styles.banner}>
        Declare Blockers — click your creatures, then click an attacker
      </div>
      <div className={styles.info}>
        {blockerCount === 0
          ? 'No blockers assigned'
          : `${blockerCount} blocker${blockerCount > 1 ? 's' : ''} assigned`
        }
      </div>
      <div className={styles.buttons}>
        <button className={styles.cancelButton} onClick={onCancel}>
          Cancel
        </button>
        <button className={styles.confirmButton} onClick={onConfirmBlockers}>
          {blockerCount === 0 ? 'Take Damage' : 'Confirm Blocks'}
        </button>
      </div>
    </div>
  );
};
