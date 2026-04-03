import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameLog } from '../../src/components/GameLog';

describe('GameLog', () => {
  it('should render log messages', () => {
    const entries = [
      { message: 'Turn 1 begins' },
      { message: 'Alice plays Plains' },
    ];
    render(<GameLog entries={entries} />);
    expect(screen.getByText('Turn 1 begins')).toBeTruthy();
    expect(screen.getByText('Alice plays Plains')).toBeTruthy();
  });

  it('should show empty state', () => {
    render(<GameLog entries={[]} />);
    expect(screen.getByText(/no events/i)).toBeTruthy();
  });
});
