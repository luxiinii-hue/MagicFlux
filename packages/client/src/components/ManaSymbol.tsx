import type { FC, SVGProps } from 'react';
import type { ManaColor } from '@magic-flux/types';

interface ManaSymbolProps extends SVGProps<SVGSVGElement> {
  readonly color: ManaColor;
  /** Diameter in pixels. Default: 22 */
  readonly size?: number;
  readonly faded?: boolean;
}

// Base colors matching the existing ManaPoolDisplay palette
const FILL: Record<ManaColor, string> = {
  W: '#f9fae5',
  U: '#4a90c4',
  B: '#4a3d3a',
  R: '#c84a1e',
  G: '#2a7a3a',
  C: '#8a8a8a',
};

// Border ring colors — slightly deeper than fill for definition on dark bg
const STROKE: Record<ManaColor, string> = {
  W: '#c8c890',
  U: '#2060a0',
  B: '#8a7870',
  R: '#9a2a00',
  G: '#1a5a28',
  C: '#5a5a5a',
};

// Icon foreground color — light on dark fills, dark on light fills
const ICON_COLOR: Record<ManaColor, string> = {
  W: '#5a5a20',
  U: '#d0e8f8',
  B: '#d0beb8',
  R: '#ffd0a0',
  G: '#a8e8b0',
  C: '#e0e0e0',
};

/**
 * Renders the inner icon path for a given mana color.
 * All paths are drawn on a 20x20 viewBox (inside a 24x24 circle).
 */
const ManaIcon: FC<{ color: ManaColor; fill: string }> = ({ color, fill }) => {
  switch (color) {
    case 'W':
      // Sun: central circle + 8 rays
      return (
        <g fill={fill}>
          <circle cx="12" cy="12" r="3" />
          {/* 8 rays at 45° intervals */}
          {Array.from({ length: 8 }, (_, i) => {
            const angle = (i * 45 * Math.PI) / 180;
            const x1 = 12 + Math.cos(angle) * 5;
            const y1 = 12 + Math.sin(angle) * 5;
            const x2 = 12 + Math.cos(angle) * 8.5;
            const y2 = 12 + Math.sin(angle) * 8.5;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={fill}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            );
          })}
        </g>
      );

    case 'U':
      // Water drop
      return (
        <path
          fill={fill}
          d="M12 4 C12 4 6.5 10 6.5 14 A5.5 5.5 0 0 0 17.5 14 C17.5 10 12 4 12 4Z"
        />
      );

    case 'B':
      // Skull: rounded head + jaw + eye sockets
      return (
        <g fill={fill}>
          {/* Head */}
          <ellipse cx="12" cy="11" rx="5.5" ry="5" />
          {/* Jaw */}
          <rect x="9" y="15" width="6" height="3" rx="1" />
          {/* Jaw gap */}
          <rect x="11.25" y="15.5" width="1.5" height="2.5" fill={FILL['B']} />
          {/* Eye sockets */}
          <circle cx="10" cy="11" r="1.5" fill={FILL['B']} />
          <circle cx="14" cy="11" r="1.5" fill={FILL['B']} />
        </g>
      );

    case 'R':
      // Flame
      return (
        <path
          fill={fill}
          d="M12 4.5 C10.5 7 8 8.5 8 11.5 C8 15 10 18 12 19 C14 18 16 15 16 11.5 C16 9.5 14.5 8 14 6.5 C13.5 8.5 12.5 9.5 11.5 10.5 C11.5 8.5 12 6 12 4.5Z"
        />
      );

    case 'G':
      // Tree: trunk + triangle canopy layers
      return (
        <g fill={fill}>
          {/* Trunk */}
          <rect x="11" y="16" width="2" height="3" rx="0.5" />
          {/* Bottom canopy */}
          <polygon points="12,7 7.5,14 16.5,14" />
          {/* Top canopy */}
          <polygon points="12,4.5 8.5,10.5 15.5,10.5" />
        </g>
      );

    case 'C':
      // Diamond (colorless)
      return (
        <polygon
          fill={fill}
          points="12,5 17,11 12,19 7,11"
        />
      );
  }
};

export const ManaSymbol: FC<ManaSymbolProps> = ({
  color,
  size = 22,
  faded = false,
  style,
  ...svgProps
}) => {
  const fill = FILL[color];
  const stroke = STROKE[color];
  const iconColor = ICON_COLOR[color];

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`${color} mana`}
      role="img"
      style={{ opacity: faded ? 0.3 : 1, flexShrink: 0, ...style }}
      {...svgProps}
    >
      {/* Outer ring */}
      <circle cx="12" cy="12" r="11" fill={fill} stroke={stroke} strokeWidth="1.5" />
      {/* Inner icon */}
      <ManaIcon color={color} fill={iconColor} />
    </svg>
  );
};
