import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Icon, ICON_NAMES, type IconName } from '../Icon';

afterEach(() => vi.restoreAllMocks());

describe('Icon', () => {
  it('ships all 61 icons, including status glyphs', () => {
    expect(ICON_NAMES).toHaveLength(61);
    expect(ICON_NAMES).toEqual(expect.arrayContaining(['status-todo', 'status-progress', 'status-review', 'status-blocked', 'status-done']));
  });

  it('renders every icon as an SVG with child shapes', () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      const svg = container.querySelector('svg');
      expect(svg, name).not.toBeNull();
      expect(svg?.childElementCount, name).toBeGreaterThan(0);
      unmount();
    }
  });

  it('is decorative by default and an img when labelled', () => {
    const { container, rerender } = render(<Icon name="bell" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    rerender(<Icon name="bell" label="Notifications" />);
    expect(screen.getByRole('img', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('scales stroke width with size', () => {
    const { container } = render(<Icon name="plus" size={24} />);
    expect(container.querySelector('svg')).toHaveAttribute('stroke-width', '1.6');
  });

  it('renders nothing for an unknown name, and never injects markup', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const bogus = '<img src=x onerror=alert(1)>' as IconName;
    const { container } = render(<Icon name={bogus} />);
    expect(container.innerHTML).toBe('');
    const proto = '__proto__' as IconName;
    const second = render(<Icon name={proto} />);
    expect(second.container.innerHTML).toBe('');
  });
});
