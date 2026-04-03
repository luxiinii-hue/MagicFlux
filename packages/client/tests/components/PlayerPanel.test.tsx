import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlayerPanel } from '../../src/components/PlayerPanel';
import type { Player } from '@magic-flux/types';

const mockPlayer: Player = {
  id: 'p1', name: 'Alice', life: 18, poisonCounters: 2,
  manaPool: { W: 1, U: 0, B: 0, R: 0, G: 0, C: 0 },
  hasLost: false, hasConceded: false, commanderDamageReceived: {},
  commanderId: null, commanderTax: 0, energyCounters: 0,
  experienceCounters: 0, landsPlayedThisTurn: 1, maxLandsPerTurn: 1,
  drewFromEmptyLibrary: false,
};

describe('PlayerPanel', () => {
  it('should display player name', () => {
    render(<PlayerPanel player={mockPlayer} isActive={false} hasPriority={false} libraryCount={50} />);
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  it('should display life total', () => {
    render(<PlayerPanel player={mockPlayer} isActive={false} hasPriority={false} libraryCount={50} />);
    expect(screen.getByText('18')).toBeTruthy();
  });

  it('should display poison counters when non-zero', () => {
    render(<PlayerPanel player={mockPlayer} isActive={false} hasPriority={false} libraryCount={50} />);
    expect(screen.getByText(/poison/i)).toBeTruthy();
  });

  it('should display library count', () => {
    render(<PlayerPanel player={mockPlayer} isActive={false} hasPriority={false} libraryCount={50} />);
    expect(screen.getByText(/50/)).toBeTruthy();
  });

  it('should highlight active player', () => {
    const { container } = render(<PlayerPanel player={mockPlayer} isActive hasPriority={false} libraryCount={50} />);
    expect(container.firstElementChild).toHaveClass('active');
  });

  it('should indicate priority', () => {
    const { container } = render(<PlayerPanel player={mockPlayer} isActive={false} hasPriority libraryCount={50} />);
    expect(container.firstElementChild).toHaveClass('hasPriority');
  });
});
