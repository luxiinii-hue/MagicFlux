import { useContext, useState, useEffect, type FC } from 'react';
import { AnimationContext } from './AnimationProvider';
import type { AnimationEffect } from './types';

const OVERLAY_STYLE: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  zIndex: 1000,
};

function renderEffect(effect: AnimationEffect): React.ReactNode {
  switch (effect.type) {
    case 'targetingLine': {
      if (!effect.from || !effect.to) return null;
      return (
        <line
          key={effect.id}
          x1={effect.from.x}
          y1={effect.from.y}
          x2={effect.to.x}
          y2={effect.to.y}
          stroke={effect.color ?? '#4090e0'}
          strokeWidth={2}
          strokeDasharray="4,4"
        />
      );
    }
    case 'attackArrow': {
      if (!effect.from || !effect.to) return null;
      return (
        <line
          key={effect.id}
          x1={effect.from.x}
          y1={effect.from.y}
          x2={effect.to.x}
          y2={effect.to.y}
          stroke={effect.color ?? '#f0c040'}
          strokeWidth={2}
        />
      );
    }
    case 'blockLine': {
      if (!effect.from || !effect.to) return null;
      return (
        <line
          key={effect.id}
          x1={effect.from.x}
          y1={effect.from.y}
          x2={effect.to.x}
          y2={effect.to.y}
          stroke={effect.color ?? '#e04040'}
          strokeWidth={2}
        />
      );
    }
    case 'floatingText': {
      if (!effect.from) return null;
      return (
        <text
          key={effect.id}
          x={effect.from.x}
          y={effect.from.y}
          fill={effect.color ?? '#ff4444'}
          fontSize={18}
          fontWeight="bold"
          textAnchor="middle"
        >
          {effect.text ?? ''}
        </text>
      );
    }
    case 'damageFlash':
      return null;
    default:
      return null;
  }
}

export const AnimationOverlay: FC = () => {
  const ctx = useContext(AnimationContext);
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    function handleResize() {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!ctx || ctx.effects.length === 0) {
    return null;
  }

  return (
    <svg
      style={OVERLAY_STYLE}
      viewBox={`0 0 ${viewport.width} ${viewport.height}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {ctx.effects.map(renderEffect)}
    </svg>
  );
};
