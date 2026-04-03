export interface CardRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface AnimationEffect {
  readonly id: string;
  readonly type: 'targetingLine' | 'attackArrow' | 'blockLine' | 'floatingText' | 'damageFlash';
  readonly from?: { x: number; y: number };
  readonly to?: { x: number; y: number };
  readonly text?: string;
  readonly color?: string;
  readonly duration?: number;
}

export interface CardPositionRegistry {
  set(instanceId: string, rect: CardRect): void;
  get(instanceId: string): CardRect | undefined;
  remove(instanceId: string): void;
  snapshot(): Map<string, CardRect>;
}

export function createCardPositionRegistry(): CardPositionRegistry {
  const map = new Map<string, CardRect>();
  return {
    set: (id, rect) => map.set(id, rect),
    get: (id) => map.get(id),
    remove: (id) => { map.delete(id); },
    snapshot: () => new Map(map),
  };
}
