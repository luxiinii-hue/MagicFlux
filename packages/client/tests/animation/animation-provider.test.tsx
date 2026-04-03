import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnimationProvider } from '../../src/animation/AnimationProvider';

describe('AnimationProvider', () => {
  it('should render children', () => {
    render(
      <AnimationProvider>
        <div>child content</div>
      </AnimationProvider>
    );
    expect(screen.getByText('child content')).toBeTruthy();
  });
});
