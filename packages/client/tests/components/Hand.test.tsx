import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hand } from '../../src/components/Hand';
import { LIGHTNING_BOLT_DATA, PLAINS_DATA, createMockCardInstance } from '../../src/mocks/mock-cards';
import type { CardData } from '@magic-flux/types';
import { ZoneType } from '@magic-flux/types';

describe('Hand', () => {
  const cardDataMap: Record<string, CardData> = {
    [LIGHTNING_BOLT_DATA.id]: LIGHTNING_BOLT_DATA,
    [PLAINS_DATA.id]: PLAINS_DATA,
  };

  const bolt = createMockCardInstance(LIGHTNING_BOLT_DATA.id, 'bolt-1', 'p1', ZoneType.Hand);
  const plains = createMockCardInstance(PLAINS_DATA.id, 'plains-h', 'p1', ZoneType.Hand);

  it('should render cards when showing own hand', () => {
    render(<Hand cards={[bolt, plains]} cardDataMap={cardDataMap} isOwner cardCount={2} onCardClick={() => {}} />);
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('should show card count for opponent hand', () => {
    render(<Hand cards={null} cardDataMap={cardDataMap} isOwner={false} cardCount={4} onCardClick={() => {}} />);
    expect(screen.getByText('4 cards')).toBeTruthy();
  });

  it('should say 1 card for singular', () => {
    render(<Hand cards={null} cardDataMap={cardDataMap} isOwner={false} cardCount={1} onCardClick={() => {}} />);
    expect(screen.getByText('1 card')).toBeTruthy();
  });
});
