import { loadSettings, getAnimationDuration } from '../state/settings';

export function useAnimationDuration(baseMs: number): number {
  const settings = loadSettings();
  return getAnimationDuration(baseMs, settings.animationSpeed);
}
