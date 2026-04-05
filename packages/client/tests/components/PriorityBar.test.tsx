import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PriorityBar } from '../../src/components/PriorityBar';
import type { ClientGameState } from '@magic-flux/types';
import { Phase } from '@magic-flux/types';

const mockGameState: ClientGameState = {
  gameId: 'test',
  players: [
    { id: 'p1', name: 'Alice', life: 20, poisonCounters: 0, manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, hasLost: false, hasConceded: false, commanderDamageReceived: {}, commanderId: null, commanderTax: 0, energyCounters: 0, experienceCounters: 0, landsPlayedThisTurn: 0, maxLandsPerTurn: 1, drewFromEmptyLibrary: false },
    { id: 'p2', name: 'Bob', life: 20, poisonCounters: 0, manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, hasLost: false, hasConceded: false, commanderDamageReceived: {}, commanderId: null, commanderTax: 0, energyCounters: 0, experienceCounters: 0, landsPlayedThisTurn: 0, maxLandsPerTurn: 1, drewFromEmptyLibrary: false },
  ],
  cardInstances: {},
  zones: {},
  turnState: { turnNumber: 1, activePlayerId: 'p1', phase: Phase.PreCombatMain, step: null, hasDeclaredAttackers: false, hasDeclaredBlockers: false, priorityPassedWithoutAction: [] },
  activePlayerId: 'p1',
  priorityPlayerId: 'p1',
  stack: [],
  stackItems: {},
  turnNumber: 1,
  gameOver: false,
  winners: [],
  losers: [],
  continuousEffects: [],
  combatState: null,
  format: 'standard',
};

const defaultProps = {
  hasPriority: true,
  onPassPriority: () => {},
  statusText: 'Your turn',
  autoPass: false,
  onToggleAutoPass: () => {},
  gameState: mockGameState,
  viewingPlayerId: 'p1',
  legalActions: [{ type: 'passPriority' as const }],
};

describe('PriorityBar', () => {
  it('should show pass priority button when player has priority', () => {
    render(<PriorityBar {...defaultProps} />);
    expect(screen.getByRole('button', { name: /pass priority/i })).toBeTruthy();
  });

  it('should disable button when player does not have priority', () => {
    render(<PriorityBar {...defaultProps} hasPriority={false} statusText="Opponent's turn" />);
    const btn = screen.getByRole('button', { name: /pass priority/i });
    expect(btn).toBeDisabled();
  });

  it('should call onPassPriority when button is clicked', () => {
    const handler = vi.fn();
    render(<PriorityBar {...defaultProps} onPassPriority={handler} />);
    fireEvent.click(screen.getByRole('button', { name: /pass priority/i }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should display status text', () => {
    render(<PriorityBar {...defaultProps} hasPriority={false} statusText="Waiting for Bob" />);
    expect(screen.getByText('Waiting for Bob')).toBeTruthy();
  });

  it('should show auto-pass OFF by default', () => {
    render(<PriorityBar {...defaultProps} />);
    expect(screen.getByText('Auto-pass OFF')).toBeTruthy();
  });

  it('should show auto-pass ON when enabled and no priority', () => {
    render(<PriorityBar {...defaultProps} autoPass hasPriority={false} />);
    expect(screen.getByText('Auto-pass ON')).toBeTruthy();
  });

  it('should call onToggleAutoPass when auto-pass button is clicked', () => {
    const handler = vi.fn();
    render(<PriorityBar {...defaultProps} onToggleAutoPass={handler} />);
    fireEvent.click(screen.getByText('Auto-pass OFF'));
    expect(handler).toHaveBeenCalledOnce();
  });
});
