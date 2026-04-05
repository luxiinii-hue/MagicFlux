import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhaseIndicator } from '../../src/components/PhaseIndicator';
import { Phase, Step } from '@magic-flux/types';

describe('PhaseIndicator', () => {
  it('should show the turn number', () => {
    render(<PhaseIndicator phase={Phase.PreCombatMain} step={null} turnNumber={5} activePlayerName="Alice" />);
    expect(screen.getByText(/Turn 5/)).toBeTruthy();
  });

  it('should show the active player name', () => {
    render(<PhaseIndicator phase={Phase.Combat} step={Step.DeclareAttackers} turnNumber={1} activePlayerName="Bob" />);
    expect(screen.getByText(/Bob/)).toBeTruthy();
  });

  it('should display all major phases', () => {
    render(<PhaseIndicator phase={Phase.Beginning} step={Step.Upkeep} turnNumber={1} activePlayerName="Alice" />);
    expect(screen.getByText('Begin')).toBeTruthy();
    expect(screen.getByText('Main 1')).toBeTruthy();
    expect(screen.getByText('Combat')).toBeTruthy();
    expect(screen.getByText('Main 2')).toBeTruthy();
    expect(screen.getByText('End')).toBeTruthy();
  });

  it('should show step sub-track for Beginning phase', () => {
    render(<PhaseIndicator phase={Phase.Beginning} step={Step.Upkeep} turnNumber={1} activePlayerName="Alice" />);
    expect(screen.getByText('Untap')).toBeTruthy();
    expect(screen.getByText('Upkeep')).toBeTruthy();
    expect(screen.getByText('Draw')).toBeTruthy();
  });

  it('should show step sub-track for Combat phase', () => {
    render(<PhaseIndicator phase={Phase.Combat} step={Step.DeclareAttackers} turnNumber={1} activePlayerName="Alice" />);
    expect(screen.getByText('Attackers')).toBeTruthy();
    expect(screen.getByText('Blockers')).toBeTruthy();
    expect(screen.getByText('Damage')).toBeTruthy();
  });

  it('should not show step sub-track for Main phases', () => {
    render(<PhaseIndicator phase={Phase.PreCombatMain} step={null} turnNumber={1} activePlayerName="Alice" />);
    expect(screen.queryByText('Untap')).toBeNull();
    expect(screen.queryByText('Attackers')).toBeNull();
  });
});
