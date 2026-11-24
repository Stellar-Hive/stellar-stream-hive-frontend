import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StreamPreview from './StreamPreview';

// Mock any heavy dependencies that StreamPreview may pull in.
// These mocks are intentionally permissive so the test focuses on
// the numeric rendering logic rather than surrounding infrastructure.
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

describe('StreamPreview', () => {
  describe('valid inputs', () => {
    it('renders the per-second, per-hour and per-day rate for a 7-decimal token', () => {
      // 1000 tokens over 10 days => 100 tokens/day
      // 100 tokens/day => 100 / 86400 tokens/second
      // With 7 decimals: 100 * 10^7 = 1_000_000_000 stroops/day
      // per second (floored): 1_000_000_000 / 86400 = 11574 stroops/sec
      // => 0.0011574 tokens/sec
      // per hour (floored): 1_000_000_000 / 24 = 41_666_666 stroops/hr
      // => 4.1666666 tokens/hr
      render(
        <StreamPreview
          amount={BigInt('10000000000')} // 1000 tokens * 10^7
          duration={BigInt(864000)} // 10 days in seconds
          decimals={7}
          symbol="USDC"
        />,
      );

      // Total amount
      expect(screen.getByText(/1,?000/)).toBeInTheDocument();

      // Per-day rate: 100 tokens/day
      expect(screen.getByText(/100/)).toBeInTheDocument();

      // Per-second rate should be floored, not rounded up.
      // 1_000_000_000 / 86400 = 11574.074... => floored to 11574 stroops
      expect(screen.getByText(/0\.0011574/)).toBeInTheDocument();

      // Per-hour rate: 41_666_666 stroops => 4.1666666 tokens
      expect(screen.getByText(/4\.1666666/)).toBeInTheDocument();
    });

    it('renders the rate for a 0-decimal token', () => {
      // 86400 tokens over 1 day => 1 token/second
      render(
        <StreamPreview
          amount={BigInt(86400)}
          duration={BigInt(86400)}
          decimals={0}
          symbol="XLM"
        />,
      );

      expect(screen.getByText(/86,?400/)).toBeInTheDocument();
      // 1 token per second
      expect(screen.getByText(/^1$/)).toBeInTheDocument();
      // 3600 tokens per hour
      expect(screen.getByText(/3,?600/)).toBeInTheDocument();
    });

    it('floors the per-second rate instead of rounding up', () => {
      // 1 token (with 0 decimals) over 3 seconds.
      // per-second = 1/3 = 0.333... => floored to 0
      render(
        <StreamPreview
          amount={BigInt(1)}
          duration={BigInt(3)}
          decimals={0}
          symbol="XLM"
        />,
      );

      // The per-second rate must be 0 (floored), never 1.
      const perSecond = screen.getByTestId('rate-per-second');
      expect(perSecond).toHaveTextContent('0');
      expect(perSecond).not.toHaveTextContent('1');
    });

    it('floors a fractional per-second rate for a 2-decimal token', () => {
      // 100 tokens (2 decimals => 10000 stroops) over 3 seconds.
      // per-second = 10000/3 = 3333.33... stroops => floored to 3333
      // => 33.33 tokens/sec
      render(
        <StreamPreview
          amount={BigInt(10000)}
          duration={BigInt(3)}
          decimals={2}
          symbol="USDC"
        />,
      );

      const perSecond = screen.getByTestId('rate-per-second');
      expect(perSecond).toHaveTextContent('33.33');
      expect(perSecond).not.toHaveTextContent('33.34');
    });
  });

  describe('invalid inputs', () => {
    it('shows the placeholder when the amount is empty', () => {
      render(
        <StreamPreview
          amount={BigInt(0)}
          duration={BigInt(86400)}
          decimals={7}
          symbol="USDC"
        />,
      );

      expect(screen.getByText(/enter/i)).toBeInTheDocument();
      expect(screen.queryByTestId('rate-per-second')).not.toBeInTheDocument();
      expect(screen.queryByTestId('rate-per-hour')).not.toBeInTheDocument();
      expect(screen.queryByTestId('rate-per-day')).not.toBeInTheDocument();
    });

    it('shows the placeholder when the duration is zero', () => {
      render(
        <StreamPreview
          amount={BigInt('10000000000')}
          duration={BigInt(0)}
          decimals={7}
          symbol="USDC"
        />,
      );

      expect(screen.getByText(/enter/i)).toBeInTheDocument();
      expect(screen.queryByTestId('rate-per-second')).not.toBeInTheDocument();
    });

    it('shows the placeholder when the duration is negative', () => {
      render(
        <StreamPreview
          amount={BigInt('10000000000')}
          duration={BigInt(-1)}
          decimals={7}
          symbol="USDC"
        />,
      );

      expect(screen.getByText(/enter/i)).toBeInTheDocument();
      expect(screen.queryByTestId('rate-per-second')).not.toBeInTheDocument();
    });

    it('shows the placeholder when the symbol is missing', () => {
      render(
        <StreamPreview
          amount={BigInt('10000000000')}
          duration={BigInt(86400)}
          decimals={7}
          symbol=""
        />,
      );

      expect(screen.getByText(/enter/i)).toBeInTheDocument();
      expect(screen.queryByTestId('rate-per-second')).not.toBeInTheDocument();
    });
  });
});