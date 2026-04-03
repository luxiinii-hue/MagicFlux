import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StackDisplay } from '../../src/components/StackDisplay';
import type { StackItem, CardData } from '@magic-flux/types';
import { LIGHTNING_BOLT_DATA } from '../../src/mocks/mock-cards';

describe('StackDisplay', () => {
  const mockItem: StackItem = {
    id: 'stack-1',
    sourceCardInstanceId: 'bolt-1',
    ability: { id: 'spell-1', type: 'spell', sourceCardInstanceId: 'bolt-1', effects: [], zones: [] },
    controller: 'p1',
    targets: [{ requirementId: 't1', targetId: 'p2', targetType: 'player' }],
    isSpell: true,
    isCopy: false,
    choices: null,
  };

  const cardDataMap: Record<string, CardData> = {
    [LIGHTNING_BOLT_DATA.id]: LIGHTNING_BOLT_DATA,
  };
  const instanceToCardDataId: Record<string, string> = {
    'bolt-1': LIGHTNING_BOLT_DATA.id,
  };

  it('should render stack items', () => {
    render(
      <StackDisplay items={[mockItem]} cardDataMap={cardDataMap} instanceToCardDataId={instanceToCardDataId} playerNames={{ p1: 'Alice' }} />
    );
    expect(screen.getByText(/Lightning Bolt/)).toBeTruthy();
  });

  it('should show empty message when stack is empty', () => {
    render(
      <StackDisplay items={[]} cardDataMap={cardDataMap} instanceToCardDataId={instanceToCardDataId} playerNames={{}} />
    );
    expect(screen.getByText(/stack is empty/i)).toBeTruthy();
  });
});
