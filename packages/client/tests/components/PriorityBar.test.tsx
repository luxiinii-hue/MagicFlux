import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PriorityBar } from '../../src/components/PriorityBar';

describe('PriorityBar', () => {
  it('should show pass priority button when player has priority', () => {
    render(<PriorityBar hasPriority onPassPriority={() => {}} statusText="Your turn" />);
    expect(screen.getByRole('button', { name: /pass priority/i })).toBeTruthy();
  });

  it('should disable button when player does not have priority', () => {
    render(<PriorityBar hasPriority={false} onPassPriority={() => {}} statusText="Opponent's turn" />);
    const btn = screen.getByRole('button', { name: /pass priority/i });
    expect(btn).toBeDisabled();
  });

  it('should call onPassPriority when button is clicked', () => {
    const handler = vi.fn();
    render(<PriorityBar hasPriority onPassPriority={handler} statusText="Your turn" />);
    fireEvent.click(screen.getByRole('button', { name: /pass priority/i }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should display status text', () => {
    render(<PriorityBar hasPriority={false} onPassPriority={() => {}} statusText="Waiting for Bob" />);
    expect(screen.getByText('Waiting for Bob')).toBeTruthy();
  });
});
