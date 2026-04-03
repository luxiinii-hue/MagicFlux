import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Battlefield } from '../../src/components/Battlefield';
import { SERRA_ANGEL_DATA, PLAINS_DATA, createMockCardInstance } from '../../src/mocks/mock-cards';
import type { CardData, CardInstance } from '@magic-flux/types';
import { ZoneType } from '@magic-flux/types';

describe('Battlefield', () => {
  const cardDataMap: Record<string, CardData> = {
    [SERRA_ANGEL_DATA.id]: SERRA_ANGEL_DATA,
    [PLAINS_DATA.id]: PLAINS_DATA,
  };

  const angel = createMockCardInstance(SERRA_ANGEL_DATA.id, 'angel-1', 'p1', ZoneType.Battlefield, {
    modifiedPower: 4, modifiedToughness: 4,
  });
  const plains = createMockCardInstance(PLAINS_DATA.id, 'plains-1', 'p1', ZoneType.Battlefield);
  const cards: CardInstance[] = [angel, plains];

  it('should render all cards for the player', () => {
    render(<Battlefield cards={cards} cardDataMap={cardDataMap} selectedCards={[]} onCardClick={() => {}} />);
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('should mark selected cards', () => {
    const { container } = render(
      <Battlefield cards={cards} cardDataMap={cardDataMap} selectedCards={['angel-1']} onCardClick={() => {}} />
    );
    expect(container.querySelectorAll('.selected').length).toBe(1);
  });

  it('should render empty battlefield', () => {
    const { container } = render(
      <Battlefield cards={[]} cardDataMap={cardDataMap} selectedCards={[]} onCardClick={() => {}} />
    );
    expect(container.querySelector('.grid')).toBeTruthy();
  });
});
