import type { FC } from 'react';
import { Phase } from '@magic-flux/types';

interface PhaseIconProps {
  readonly phase: Phase;
  readonly active: boolean;
  readonly size?: number;
}

/**
 * Small flat icon for each game phase.
 * Designed for 16x16 display inside the PhaseIndicator track.
 */
export const PhaseIcon: FC<PhaseIconProps> = ({ phase, active, size = 14 }) => {
  const color = active ? '#ffffff' : '#666688';

  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {phase === Phase.Beginning && (
        // Sunrise: semicircle + rays
        <g stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none">
          {/* Horizon line */}
          <line x1="1" y1="11" x2="15" y2="11" />
          {/* Sun arc */}
          <path d="M3,11 A5,5 0 0,1 13,11" />
          {/* Rays */}
          <line x1="8" y1="4" x2="8" y2="2.5" />
          <line x1="11.5" y1="5.5" x2="12.5" y2="4.5" />
          <line x1="4.5" y1="5.5" x2="3.5" y2="4.5" />
          <line x1="13" y1="8" x2="14.5" y2="8" />
          <line x1="3" y1="8" x2="1.5" y2="8" />
        </g>
      )}

      {phase === Phase.PreCombatMain && (
        // Scroll / spell book
        <g fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="10" height="11" rx="1.5" />
          <line x1="5.5" y1="6.5" x2="10.5" y2="6.5" />
          <line x1="5.5" y1="9" x2="10.5" y2="9" />
          <line x1="5.5" y1="11.5" x2="8.5" y2="11.5" />
        </g>
      )}

      {phase === Phase.Combat && (
        // Crossed swords
        <g stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none">
          <line x1="3" y1="3" x2="13" y2="13" />
          <line x1="13" y1="3" x2="3" y2="13" />
          {/* Crossguard hints */}
          <line x1="5.5" y1="5.5" x2="3.5" y2="7.5" />
          <line x1="10.5" y1="5.5" x2="12.5" y2="7.5" />
        </g>
      )}

      {phase === Phase.PostCombatMain && (
        // Scroll with a checkmark — second main, actions taken
        <g fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="10" height="11" rx="1.5" />
          <line x1="5.5" y1="6.5" x2="10.5" y2="6.5" />
          <polyline points="5.5,10 7.5,12 10.5,8.5" />
        </g>
      )}

      {phase === Phase.Ending && (
        // Crescent moon
        <path
          d="M10 4 A5 5 0 1 0 10 12 A3.5 3.5 0 1 1 10 4Z"
          fill={color}
          stroke="none"
        />
      )}
    </svg>
  );
};
