import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameLog } from '../../src/components/GameLog';

const mockEntry = (type: string, extra: Record<string, unknown> = {}) => ({
  event: { type, timestamp: Date.now(), ...extra } as any,
  message: `raw: ${type}`,
});

describe('GameLog', () => {
  it('should render formatted log messages', () => {
    const entries = [
      mockEntry('turnBegan', { turnNumber: 1, activePlayerId: 'p1' }),
    ];
    render(<GameLog entries={entries} gameState={null} cardDataMap={{}} />);
    expect(screen.getByText(/Turn 1/)).toBeTruthy();
  });

  it('should show empty state', () => {
    render(<GameLog entries={[]} gameState={null} cardDataMap={{}} />);
    expect(screen.getByText(/no events/i)).toBeTruthy();
  });

  it('should filter out mana events', () => {
    const entries = [
      mockEntry('manaAdded', { playerId: 'p1' }),
    ];
    render(<GameLog entries={entries} gameState={null} cardDataMap={{}} />);
    expect(screen.getByText(/no events/i)).toBeTruthy();
  });
});
