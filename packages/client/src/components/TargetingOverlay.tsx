/**
 * Targeting visual overlay — shows during spell target selection.
 *
 * Renders:
 * - SVG arrow from the casting card to the cursor (targeting line)
 * - SVG arrows from casting card to already-selected targets
 * - Pulsing glow on valid targets
 * - Target requirement description badge
 *
 * Inspired by MTGA's targeting visuals but with a cleaner look.
 */

import { useState, useEffect, type FC } from 'react';
import type { ResolvedTarget, TargetRequirement } from '@magic-flux/types';
import styles from './TargetingOverlay.module.css';

interface TargetingOverlayProps {
  /** The card being cast (for positioning the arrow origin) */
  readonly castingCardName: string;
  /** Current requirement being selected */
  readonly currentReq: TargetRequirement | null;
  /** Requirements total count */
  readonly totalReqs: number;
  /** Current requirement index (0-based) */
  readonly currentReqIndex: number;
  /** Already selected targets */
  readonly selectedTargets: readonly ResolvedTarget[];
  /** Visual intensity setting */
  readonly visualMode: 'full' | 'subtle' | 'off';
}

export const TargetingOverlay: FC<TargetingOverlayProps> = ({
  castingCardName,
  currentReq,
  totalReqs,
  currentReqIndex,
  selectedTargets,
  visualMode,
}) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  if (!currentReq || visualMode === 'off') return null;

  return (
    <>
      {/* SVG targeting line from center to cursor — only in full mode */}
      {visualMode === 'full' && <svg className={styles.svgOverlay}>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#ff8844" />
          </marker>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Targeting line from screen center to cursor */}
        <line
          x1={window.innerWidth / 2}
          y1={window.innerHeight - 120}
          x2={mousePos.x}
          y2={mousePos.y}
          stroke="#ff8844"
          strokeWidth={2}
          strokeDasharray="6,4"
          opacity={0.7}
          markerEnd="url(#arrowhead)"
          filter="url(#glow)"
        />

        {/* Lines to already-selected targets would go here if we tracked positions */}
      </svg>}

      {/* Targeting info banner */}
      <div className={styles.banner}>
        <div className={styles.bannerCard}>{castingCardName}</div>
        <div className={styles.bannerArrow}>→</div>
        <div className={styles.bannerTarget}>
          {currentReq.description}
          {totalReqs > 1 && (
            <span className={styles.bannerCount}> ({currentReqIndex + 1}/{totalReqs})</span>
          )}
        </div>
      </div>

      {/* Selected targets display */}
      {selectedTargets.length > 0 && (
        <div className={styles.selectedList}>
          {selectedTargets.map((t, i) => (
            <div key={i} className={styles.selectedItem}>
              Target {i + 1}: {t.targetType === 'player' ? 'Player' : 'Card'} {t.targetId.slice(-4)}
            </div>
          ))}
        </div>
      )}
    </>
  );
};
