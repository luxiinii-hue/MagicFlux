import type { FC } from 'react';
import { Phase, Step } from '@magic-flux/types';
import { PhaseIcon } from './PhaseIcon';
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

/** Steps within each phase, shown as a sub-track when that phase is active */
const PHASE_STEPS: Record<string, { step: Step; label: string }[]> = {
  [Phase.Beginning]: [
    { step: Step.Untap, label: 'Untap' },
    { step: Step.Upkeep, label: 'Upkeep' },
    { step: Step.Draw, label: 'Draw' },
  ],
  [Phase.Combat]: [
    { step: Step.BeginningOfCombat, label: 'Begin' },
    { step: Step.DeclareAttackers, label: 'Attackers' },
    { step: Step.DeclareBlockers, label: 'Blockers' },
    { step: Step.CombatDamage, label: 'Damage' },
    { step: Step.EndOfCombat, label: 'End' },
  ],
  [Phase.Ending]: [
    { step: Step.EndStep, label: 'End Step' },
    { step: Step.Cleanup, label: 'Cleanup' },
  ],
};

export const PhaseIndicator: FC<PhaseIndicatorProps> = ({
  phase,
  step,
  turnNumber,
  activePlayerName,
}) => {
  const activeSteps = PHASE_STEPS[phase];

  return (
    <div className={styles.indicator}>
      <div className={styles.header}>
        {activePlayerName}'s Turn {turnNumber}
      </div>
      <div className={styles.track}>
        {PHASE_LABELS.map(({ phase: p, label }) => {
          const isActive = p === phase;
          return (
            <div
              key={p}
              className={`${styles.phase} ${isActive ? styles.phaseActive : ''}`}
            >
              <PhaseIcon phase={p} active={isActive} size={14} />
              <span>{label}</span>
            </div>
          );
        })}
      </div>
      {activeSteps && activeSteps.length > 0 && (
        <div className={styles.stepTrack}>
          {activeSteps.map(({ step: s, label }) => {
            const isCurrent = s === step;
            const isPast = step ? activeSteps.findIndex(x => x.step === step) > activeSteps.findIndex(x => x.step === s) : false;
            return (
              <div
                key={s}
                className={`${styles.stepItem} ${isCurrent ? styles.stepActive : ''} ${isPast ? styles.stepPast : ''}`}
              >
                <div className={styles.stepDot} />
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
