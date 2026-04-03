import type { FC } from 'react';

interface LifeIconProps {
  readonly size?: number;
  /** Pulse animation when life is critically low (≤5) */
  readonly critical?: boolean;
}

/**
 * Heart icon for life total display.
 * Uses a classic SVG heart path that looks clean at small sizes.
 */
export const LifeIcon: FC<LifeIconProps> = ({ size = 14, critical = false }) => {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={critical ? { animation: 'lifePulse 0.8s ease-in-out infinite' } : undefined}
    >
      <path
        d="M8 14 C8 14 2 9.5 2 5.5 A3.5 3.5 0 0 1 8 3.5 A3.5 3.5 0 0 1 14 5.5 C14 9.5 8 14 8 14Z"
        fill={critical ? '#e05050' : '#c04060'}
        stroke={critical ? '#ff8080' : '#903050'}
        strokeWidth="0.8"
      />
    </svg>
  );
};
