import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardView } from '../../src/components/CardView';
import { SERRA_ANGEL_DATA, createMockCardInstance } from '../../src/mocks/mock-cards';
import { ZoneType } from '@magic-flux/types';

describe('CardView', () => {
  const cardData = SERRA_ANGEL_DATA;
  const instance = createMockCardInstance(cardData.id, 'angel-1', 'p1', ZoneType.Battlefield, {
    modifiedPower: 4,
    modifiedToughness: 4,
  });

  it('should render a card with its name as alt text', () => {
    render(<CardView cardData={cardData} instance={instance} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', 'Serra Angel');
  });

  it('should apply tapped class when card is tapped', () => {
    const tapped = { ...instance, tapped: true };
    const { container } = render(<CardView cardData={cardData} instance={tapped} />);
    expect(container.firstElementChild).toHaveClass('tapped');
  });

  it('should show power/toughness for creatures', () => {
    render(<CardView cardData={cardData} instance={instance} />);
    expect(screen.getByText('4/4')).toBeTruthy();
  });

  it('should show counters when present', () => {
    const withCounters = { ...instance, counters: { '+1/+1': 2 } };
    render(<CardView cardData={cardData} instance={withCounters} />);
    expect(screen.getByText('+1/+1: 2')).toBeTruthy();
  });

  it('should apply selected class when selected', () => {
    const { container } = render(<CardView cardData={cardData} instance={instance} selected />);
    expect(container.firstElementChild).toHaveClass('selected');
  });

  it('should apply highlighted class when highlighted', () => {
    const { container } = render(<CardView cardData={cardData} instance={instance} highlighted />);
    expect(container.firstElementChild).toHaveClass('highlighted');
  });
});
