import type { FC } from 'react';
import type { ManaPool, ManaColor } from '@magic-flux/types';
import styles from './ManaPoolDisplay.module.css';

interface ManaPoolDisplayProps {
  readonly pool: ManaPool;
}

const MANA_COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];

export const ManaPoolDisplay: FC<ManaPoolDisplayProps> = ({ pool }) => {
  return (
    <div className={styles.pool}>
      {MANA_COLORS.map((color) => (
        <span
          key={color}
          data-testid={`mana-${color}`}
          className={`${styles.mana} ${styles[color]} ${pool[color] === 0 ? styles.empty : ''}`}
        >
          {pool[color]}
        </span>
      ))}
    </div>
  );
};
