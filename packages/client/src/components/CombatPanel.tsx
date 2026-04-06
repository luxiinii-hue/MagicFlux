import type { FC } from 'react';
import type { ClientGameState, CardData } from '@magic-flux/types';
import styles from './CombatPanel.module.css';

interface CombatPanelProps {
  readonly mode: 'declareAttackers' | 'declareBlockers';
  readonly gameState: ClientGameState;
  readonly cardDataMap: Readonly<Record<string, CardData>>;
  readonly viewingPlayerId: string;
  readonly selectedAttackerIds: readonly string[];
  readonly blockerAssignments: Readonly<Record<string, string>>;
  readonly pendingBlockerId: string | null;
  readonly onConfirmAttackers: () => void;
  readonly onConfirmBlockers: () => void;
  readonly onCancel: () => void;
}

function cardName(instanceId: string, gameState: ClientGameState, cardDataMap: Readonly<Record<string, CardData>>): string {
  const card = gameState.cardInstances[instanceId];
  if (!card) return instanceId;
  return cardDataMap[card.cardDataId]?.name ?? card.cardDataId;
}

export const CombatPanel: FC<CombatPanelProps> = ({
  mode,
  gameState,
  cardDataMap,
  viewingPlayerId,
  selectedAttackerIds,
  blockerAssignments,
  pendingBlockerId,
  onConfirmAttackers,
  onConfirmBlockers,
  onCancel,
}) => {
  if (mode === 'declareAttackers') {
    return (
      <div className={styles.panel}>
        <div className={styles.banner}>
          <span className={styles.swords}>&#9876;</span> Declare Attackers
        </div>
        <div className={styles.instructions}>
          Click your untapped creatures to toggle them as attackers
        </div>
        {selectedAttackerIds.length > 0 && (
          <div className={styles.attackerList}>
            {selectedAttackerIds.map((id) => (
              <span key={id} className={styles.attackerTag}>
                {cardName(id, gameState, cardDataMap)}
              </span>
            ))}
          </div>
        )}
        <div className={styles.info}>
          {selectedAttackerIds.length === 0
            ? 'No attackers selected'
            : `${selectedAttackerIds.length} creature${selectedAttackerIds.length > 1 ? 's' : ''} attacking`
          }
        </div>
        <div className={styles.buttons}>
          <button className={styles.cancelButton} onClick={onCancel}>
            Skip Combat
          </button>
          <button className={styles.confirmButton} onClick={onConfirmAttackers} disabled={selectedAttackerIds.length === 0}>
            Confirm Attack
          </button>
        </div>
      </div>
    );
  }

  // Declare Blockers
  const blockerCount = Object.keys(blockerAssignments).length;
  const attackerCount = gameState.combatState
    ? Object.keys(gameState.combatState.attackers).length
    : 0;

  return (
    <div className={styles.panel}>
      <div className={styles.banner}>
        <span className={styles.shield}>&#9632;</span> Declare Blockers
      </div>

      {/* Step-by-step instructions */}
      <div className={styles.instructions}>
        {pendingBlockerId
          ? <><span className={styles.step}>Step 2:</span> Click an <span className={styles.highlight}>attacking creature</span> to block it</>
          : <><span className={styles.step}>Step 1:</span> Click one of <span className={styles.highlight}>your creatures</span> to select as blocker</>
        }
      </div>

      {/* Show what's attacking */}
      <div className={styles.combatInfo}>
        {attackerCount} attacker{attackerCount !== 1 ? 's' : ''} incoming
        {blockerCount > 0 && ` — ${blockerCount} blocked`}
      </div>

      {/* Show assignments */}
      {blockerCount > 0 && (
        <div className={styles.assignmentList}>
          {Object.entries(blockerAssignments).map(([blockerId, attackerId]) => (
            <div key={blockerId} className={styles.assignment}>
              <span className={styles.blockerName}>{cardName(blockerId, gameState, cardDataMap)}</span>
              <span className={styles.blocksArrow}>blocks</span>
              <span className={styles.attackerName}>{cardName(attackerId, gameState, cardDataMap)}</span>
            </div>
          ))}
        </div>
      )}

      {pendingBlockerId && (
        <div className={styles.pendingLabel}>
          Selected: <strong>{cardName(pendingBlockerId, gameState, cardDataMap)}</strong> — now click an attacker
        </div>
      )}

      <div className={styles.buttons}>
        <button className={styles.cancelButton} onClick={onCancel}>
          Cancel
        </button>
        <button className={styles.confirmButton} onClick={onConfirmBlockers}>
          {blockerCount === 0 ? 'No Blocks' : 'Confirm Blocks'}
        </button>
      </div>
    </div>
  );
};
