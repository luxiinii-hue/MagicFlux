export interface GameSettings {
  autoPayMana: boolean;
  cardHoverZoom: boolean;
  animationSpeed: 'normal' | 'fast' | 'off';
}

const DEFAULTS: GameSettings = {
  autoPayMana: true,
  cardHoverZoom: true,
  animationSpeed: 'normal',
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
