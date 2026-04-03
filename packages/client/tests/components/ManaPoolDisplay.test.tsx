import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ManaPoolDisplay } from '../../src/components/ManaPoolDisplay';
import type { ManaPool } from '@magic-flux/types';

describe('ManaPoolDisplay', () => {
  it('should display non-zero mana counts', () => {
    const pool: ManaPool = { W: 2, U: 0, B: 0, R: 1, G: 0, C: 0 };
    render(<ManaPoolDisplay pool={pool} />);
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('should show all six mana colors', () => {
    const pool: ManaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    const { container } = render(<ManaPoolDisplay pool={pool} />);
    const items = container.querySelectorAll('[data-testid^="mana-"]');
    expect(items.length).toBe(6);
  });

  it('should render the correct color test ids', () => {
    const pool: ManaPool = { W: 1, U: 1, B: 1, R: 1, G: 1, C: 1 };
    render(<ManaPoolDisplay pool={pool} />);
    expect(screen.getByTestId('mana-W')).toBeTruthy();
    expect(screen.getByTestId('mana-U')).toBeTruthy();
    expect(screen.getByTestId('mana-B')).toBeTruthy();
    expect(screen.getByTestId('mana-R')).toBeTruthy();
    expect(screen.getByTestId('mana-G')).toBeTruthy();
    expect(screen.getByTestId('mana-C')).toBeTruthy();
  });
});
