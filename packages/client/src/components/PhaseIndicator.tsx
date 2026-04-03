import type { FC } from 'react';
import { Phase, Step } from '@magic-flux/types';
import styles from './PhaseIndicator.module.css';

interface PhaseIndicatorProps {
  readonly phase: Phase;
  readonly step: Step | null;
  readonly turnNumber: number;
  readonly activePlayerName: string;
}

const PHASE_LABELS: { phase: Phase; label: string }[] = [
  { phase: Phase.Beginning, label: 'Begin' },
  { phase: Phase.PreCombatMain, label: 'Main 1' },
  { phase: Phase.Combat, label: 'Combat' },
  { phase: Phase.PostCombatMain, label: 'Main 2' },
  { phase: Phase.Ending, label: 'End' },
];

const STEP_LABELS: Record<string, string> = {
  [Step.Untap]: 'Untap',
  [Step.Upkeep]: 'Upkeep',
  [Step.Draw]: 'Draw',
  [Step.BeginningOfCombat]: 'Begin Combat',
  [Step.DeclareAttackers]: 'Attackers',
  [Step.DeclareBlockers]: 'Blockers',
  [Step.FirstStrikeDamage]: 'First Strike',
  [Step.CombatDamage]: 'Damage',
  [Step.EndOfCombat]: 'End Combat',
  [Step.EndStep]: 'End Step',
  [Step.Cleanup]: 'Cleanup',
};

export const PhaseIndicator: FC<PhaseIndicatorProps> = ({
  phase,
  step,
  turnNumber,
  activePlayerName,
}) => {
  return (
    <div className={styles.indicator}>
      <div className={styles.header}>
        Turn {turnNumber} — {activePlayerName}
      </div>
      <div className={styles.track}>
        {PHASE_LABELS.map(({ phase: p, label }) => (
          <div
            key={p}
            className={`${styles.phase} ${p === phase ? styles.phaseActive : ''}`}
            data-active={p === phase ? 'true' : 'false'}
          >
            {label}
          </div>
        ))}
      </div>
      {step && <div className={styles.step}>{STEP_LABELS[step] ?? step}</div>}
    </div>
  );
};
