import type { FC } from 'react';
import type { GameSettings } from '../state/settings';
import styles from './SettingsPanel.module.css';

interface SettingsPanelProps {
  readonly settings: GameSettings;
  readonly onUpdate: (settings: GameSettings) => void;
}

export const SettingsPanel: FC<SettingsPanelProps> = ({ settings, onUpdate }) => {
  const toggleClass = (active: boolean) =>
    active ? `${styles.toggle} ${styles.toggleActive}` : styles.toggle;

  return (
    <div className={styles.panel}>
      <p className={styles.heading}>Settings</p>

      <div className={styles.row}>
        <span className={styles.label}>Auto-pay mana</span>
        <button
          className={toggleClass(settings.autoPayMana)}
          onClick={() => onUpdate({ ...settings, autoPayMana: !settings.autoPayMana })}
        >
          {settings.autoPayMana ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Auto-pass priority [F2]</span>
        <button
          className={toggleClass(settings.autoPassPriority)}
          onClick={() => onUpdate({ ...settings, autoPassPriority: !settings.autoPassPriority })}
        >
          {settings.autoPassPriority ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Card hover zoom</span>
        <button
          className={toggleClass(settings.cardHoverZoom)}
          onClick={() => onUpdate({ ...settings, cardHoverZoom: !settings.cardHoverZoom })}
        >
          {settings.cardHoverZoom ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Animation speed</span>
        <select
          className={styles.select}
          value={settings.animationSpeed}
          onChange={(e) =>
            onUpdate({
              ...settings,
              animationSpeed: e.target.value as GameSettings['animationSpeed'],
            })
          }
        >
          <option value="normal">Normal</option>
          <option value="fast">Fast</option>
          <option value="off">Off</option>
        </select>
      </div>
    </div>
  );
};
