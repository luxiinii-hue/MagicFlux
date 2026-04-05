export interface AutoPassSettings {
  /** Stop at your main phases */
  stopAtMainPhase: boolean;
  /** Stop at declare attackers on your turn */
  stopAtAttackers: boolean;
  /** Stop at declare blockers on opponent's turn */
  stopAtBlockers: boolean;
  /** Auto-pass when only pass/concede are available */
  yieldWhenNoActions: boolean;
  /** Stop when opponent casts a spell (to respond) */
  stopOnOpponentSpell: boolean;
  /** Stop when you have instant-speed plays available */
  stopWithInstants: boolean;
}

export interface GameSettings {
  autoPayMana: boolean;
  autoPassPriority: boolean;
  autoPassConfig: AutoPassSettings;
  cardHoverZoom: boolean;
  animationSpeed: 'normal' | 'fast' | 'off';
  targetingVisuals: 'full' | 'subtle' | 'off';
}

const DEFAULT_AUTO_PASS: AutoPassSettings = {
  stopAtMainPhase: true,
  stopAtAttackers: true,
  stopAtBlockers: true,
  yieldWhenNoActions: true,
  stopOnOpponentSpell: true,
  stopWithInstants: true,
};

const DEFAULTS: GameSettings = {
  autoPayMana: true,
  autoPassPriority: false,
  autoPassConfig: DEFAULT_AUTO_PASS,
  cardHoverZoom: true,
  animationSpeed: 'normal',
  targetingVisuals: 'full',
};

const STORAGE_KEY = 'magic-flux-settings';

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: GameSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getAnimationDuration(base: number, speed: GameSettings['animationSpeed']): number {
  switch (speed) {
    case 'fast': return base / 2;
    case 'off': return 0;
    default: return base;
  }
}
