import type { FC } from 'react';
import type { GameSettings, AutoPassSettings } from '../state/settings';
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

      {settings.autoPassPriority && (
        <div className={styles.subSection}>
          <p className={styles.subHeading}>Auto-Pass Rules</p>
          {([
            ['stopAtMainPhase', 'Stop at my main phases'],
            ['stopAtAttackers', 'Stop at declare attackers'],
            ['stopAtBlockers', 'Stop at declare blockers'],
            ['yieldWhenNoActions', 'Yield when no possible actions'],
            ['stopOnOpponentSpell', 'Stop when opponent casts a spell'],
            ['stopWithInstants', 'Stop when I have instants'],
          ] as [keyof AutoPassSettings, string][]).map(([key, label]) => (
            <div key={key} className={styles.row}>
              <span className={styles.label}>{label}</span>
              <button
                className={toggleClass(settings.autoPassConfig[key])}
                onClick={() => onUpdate({
                  ...settings,
                  autoPassConfig: { ...settings.autoPassConfig, [key]: !settings.autoPassConfig[key] },
                })}
              >
                {settings.autoPassConfig[key] ? 'ON' : 'OFF'}
              </button>
            </div>
          ))}
        </div>
      )}

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

      <div className={styles.row}>
        <span className={styles.label}>Targeting visuals</span>
        <select
          className={styles.select}
          value={settings.targetingVisuals}
          onChange={(e) =>
            onUpdate({
              ...settings,
              targetingVisuals: e.target.value as GameSettings['targetingVisuals'],
            })
          }
        >
          <option value="full">Full (arrows + glow)</option>
          <option value="subtle">Subtle (glow only)</option>
          <option value="off">Off</option>
        </select>
      </div>
    </div>
  );
};
