import type { FC } from 'react';
import type { ManaPool, ManaColor } from '@magic-flux/types';
import { ManaSymbol } from './ManaSymbol';
import styles from './ManaPoolDisplay.module.css';

interface ManaPoolDisplayProps {
  readonly pool: ManaPool;
}

const MANA_COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];

export const ManaPoolDisplay: FC<ManaPoolDisplayProps> = ({ pool }) => {
  return (
    <div className={styles.pool}>
      {MANA_COLORS.map((color) => (
        <div
          key={color}
          data-testid={`mana-${color}`}
          className={styles.manaSlot}
        >
          <ManaSymbol color={color} size={22} faded={pool[color] === 0} />
          {pool[color] > 0 && (
            <span className={styles.count}>{pool[color]}</span>
          )}
        </div>
      ))}
    </div>
  );
};
