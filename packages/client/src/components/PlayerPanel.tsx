import type { FC } from 'react';
import type { Player } from '@magic-flux/types';
import { ManaPoolDisplay } from './ManaPoolDisplay';
import { LifeIcon } from './LifeIcon';
import styles from './PlayerPanel.module.css';

interface PlayerPanelProps {
  readonly player: Player;
  readonly isActive: boolean;
  readonly hasPriority: boolean;
  readonly libraryCount: number;
  readonly targetable?: boolean;
  readonly onClick?: () => void;
}

export const PlayerPanel: FC<PlayerPanelProps> = ({
  player,
  isActive,
  hasPriority,
  libraryCount,
  targetable = false,
  onClick,
}) => {
  const classNames = [
    styles.panel,
    isActive ? styles.active : '',
    hasPriority ? styles.hasPriority : '',
    targetable ? styles.targetable : '',
  ].filter(Boolean).join(' ');

  const isCritical = player.life <= 5;

  return (
    <div className={classNames} onClick={targetable ? onClick : undefined} role={targetable ? 'button' : undefined}>
      <span className={styles.name}>{player.name}</span>
      <div className={styles.lifeDisplay}>
        <LifeIcon size={14} critical={isCritical} />
        <span className={`${styles.life} ${isCritical ? styles.lifeCritical : ''}`}>
          {player.life}
        </span>
      </div>
      <ManaPoolDisplay pool={player.manaPool} />
      <div className={styles.info}>
        <span className={styles.libraryCount}>Lib: {libraryCount}</span>
        {player.poisonCounters > 0 && (
          <span className={styles.poison}>Poison: {player.poisonCounters}</span>
        )}
      </div>
    </div>
  );
};
