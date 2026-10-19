import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../Button';

afterEach(() => vi.restoreAllMocks());

describe('Button', () => {
  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)('applies the %s variant class', (variant) => {
    render(<Button variant={variant}>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('ht-btn', `ht-btn-${variant}`);
  });

  it('defaults to type="button" and primary/md', () => {
    render(<Button>Go</Button>);
    const button = screen.getByRole('button', { name: 'Go' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('ht-btn-primary');
    expect(button).not.toHaveClass('ht-btn-sm');
  });

  it('applies size classes', () => {
    render(<Button size="lg">Big</Button>);
    expect(screen.getByRole('button')).toHaveClass('ht-btn-lg');
  });

  it('sets aria-busy and shows a spinner while loading', () => {
    const { container } = render(<Button loading>Saving</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('.ht-spin')).not.toBeNull();
  });

  it('is disabled when disabled', () => {
    render(<Button disabled>Nope</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('passes aria-label through for icon-only buttons and does not warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<Button icon="x" variant="ghost" aria-label="Close panel" />);
    const button = screen.getByRole('button', { name: 'Close panel' });
    expect(button).toHaveClass('ht-btn-icon');
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns in dev when an icon-only button has no accessible name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<Button icon="more" />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('aria-label'));
  });

  it('forwards refs and extra props', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(
      <Button ref={ref} data-testid="b" className="extra" type="submit">
        Submit
      </Button>,
    );
    expect(ref.current).toBe(screen.getByTestId('b'));
    expect(ref.current).toHaveClass('extra');
    expect(ref.current).toHaveAttribute('type', 'submit');
  });
});
