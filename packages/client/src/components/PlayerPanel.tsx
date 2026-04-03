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
}

export const PlayerPanel: FC<PlayerPanelProps> = ({
  player,
  isActive,
  hasPriority,
  libraryCount,
}) => {
  const classNames = [
    styles.panel,
    isActive ? styles.active : '',
    hasPriority ? styles.hasPriority : '',
  ].filter(Boolean).join(' ');

  const isCritical = player.life <= 5;

  return (
    <div className={classNames}>
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
