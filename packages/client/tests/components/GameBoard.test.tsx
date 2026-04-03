import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameBoard } from '../../src/components/GameBoard';
import { createMockGameState, MOCK_CARD_DATA_MAP } from '../../src/mocks/mock-state';

describe('GameBoard', () => {
  const state = createMockGameState();
  const viewingPlayerId = 'player-1';

  it('should render both player panels', () => {
    render(
      <GameBoard gameState={state} cardDataMap={MOCK_CARD_DATA_MAP} viewingPlayerId={viewingPlayerId} selectedCards={[]} onCardClick={() => {}} />
    );
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getAllByText('Bob').length).toBeGreaterThanOrEqual(1);
  });

  it('should render cards on the battlefield', () => {
    render(
      <GameBoard gameState={state} cardDataMap={MOCK_CARD_DATA_MAP} viewingPlayerId={viewingPlayerId} selectedCards={[]} onCardClick={() => {}} />
    );
    const images = screen.getAllByRole('img');
    // 3 on p1 battlefield + 3 on p2 battlefield + 2 in p1 hand = 8
    expect(images.length).toBe(8);
  });

  it('should show opponent hand as card count', () => {
    render(
      <GameBoard gameState={state} cardDataMap={MOCK_CARD_DATA_MAP} viewingPlayerId={viewingPlayerId} selectedCards={[]} onCardClick={() => {}} />
    );
    expect(screen.getByText('4 cards')).toBeTruthy();
  });
});
