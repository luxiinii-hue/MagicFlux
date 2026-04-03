import { createContext, useState, useMemo, useCallback, type ReactNode } from 'react';
import { createCardPositionRegistry, type AnimationEffect, type CardPositionRegistry } from './types';

const DEFAULT_DURATION = 1000;

export interface AnimationContextValue {
  readonly registry: CardPositionRegistry;
  readonly effects: readonly AnimationEffect[];
  addEffect(effect: AnimationEffect): void;
  removeEffect(id: string): void;
  clearEffects(): void;
}

export const AnimationContext = createContext<AnimationContextValue | null>(null);

export function AnimationProvider({ children }: { children: ReactNode }) {
  const registry = useMemo(() => createCardPositionRegistry(), []);
  const [effects, setEffects] = useState<AnimationEffect[]>([]);

  const removeEffect = useCallback((id: string) => {
    setEffects((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const addEffect = useCallback((effect: AnimationEffect) => {
    setEffects((prev) => [...prev, effect]);
    const duration = effect.duration ?? DEFAULT_DURATION;
    if (duration > 0) {
      setTimeout(() => removeEffect(effect.id), duration);
    }
  }, [removeEffect]);

  const clearEffects = useCallback(() => {
    setEffects([]);
  }, []);

  const value = useMemo<AnimationContextValue>(() => ({
    registry,
    effects,
    addEffect,
    removeEffect,
    clearEffects,
  }), [registry, effects, addEffect, removeEffect, clearEffects]);

  return (
    <AnimationContext.Provider value={value}>
      {children}
    </AnimationContext.Provider>
  );
}
