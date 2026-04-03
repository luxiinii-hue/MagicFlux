import { useContext, useCallback } from 'react';
import { AnimationContext } from './AnimationProvider';

export function useCardPosition(instanceId: string): (el: HTMLElement | null) => void {
  const ctx = useContext(AnimationContext);

  return useCallback((el: HTMLElement | null) => {
    if (!ctx) return;

    if (el) {
      const rect = el.getBoundingClientRect();
      ctx.registry.set(instanceId, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
    } else {
      ctx.registry.remove(instanceId);
    }
  }, [ctx, instanceId]);
}
