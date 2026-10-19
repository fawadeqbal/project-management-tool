import { act, fireEvent, render, screen } from '@testing-library/react';
import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Input } from '../Input';
import { NavItem } from '../NavItem';
import { Switch } from '../Switch';
import { Toast } from '../Toast';
import { Tooltip } from '../Tooltip';
import { KpiTile } from '../KpiTile';
import { Badge } from '../Badge';

afterEach(() => vi.useRealTimers());

describe('Input', () => {
  it('links a visible label, hint and error to the input', () => {
    const { rerender } = render(<Input label="Email" hint="We never share it." />);
    const input = screen.getByRole('textbox', { name: 'Email' });
    expect(input).toHaveAccessibleDescription('We never share it.');
    rerender(<Input label="Email" error="Enter an email like name@company.com" />);
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription(
      'Enter an email like name@company.com',
    );
  });

  it('supports an aria-only label', () => {
    render(<Input label="Search" hideLabel icon="search" shortcut="/" />);
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByText('Search')).toHaveClass('ht-sr-only');
  });
});

describe('NavItem', () => {
  it('renders an anchor with aria-current by default', () => {
    render(<NavItem label="Inbox" icon="inbox" href="/inbox" count={4} active />);
    const link = screen.getByRole('link', { name: /Inbox/ });
    expect(link).toHaveAttribute('href', '/inbox');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('accepts a custom link component (router Link) and passes `to` through', () => {
    const FakeLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }>(
      function FakeLink({ to, ...rest }, ref) {
        return <a ref={ref} href={to} data-router="yes" {...rest} />;
      },
    );
    render(<NavItem linkComponent={FakeLink} to="/projects/1" label="Website" dot="violet" />);
    const link = screen.getByRole('link', { name: 'Website' });
    expect(link).toHaveAttribute('href', '/projects/1');
    expect(link).toHaveAttribute('data-router', 'yes');
  });
});

describe('Switch', () => {
  it('toggles with role=switch and a visible label', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Email digests" />);
    const sw = screen.getByRole('switch', { name: 'Email digests' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Toast', () => {
  it('is a polite live region with action and dismiss', () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    render(<Toast message="HRT-129 marked as done" onAction={onAction} onDismiss={onDismiss} />);
    expect(screen.getByRole('status')).toHaveTextContent('HRT-129 marked as done');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onAction).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('Tooltip', () => {
  it('shows after the delay on focus and is wired with aria-describedby', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Copy link">
        <button type="button" aria-label="Copy">
          c
        </button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Copy' });
    const tip = screen.getByRole('tooltip', { hidden: true });
    expect(button).toHaveAttribute('aria-describedby', tip.id);
    expect(tip).not.toBeVisible();
    fireEvent.focus(button);
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(tip).not.toBeVisible();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(tip).toBeVisible();
    fireEvent.blur(button);
    expect(tip).not.toBeVisible();
  });
});

describe('KpiTile and Badge', () => {
  it('render label, value, delta and sub', () => {
    render(
      <KpiTile
        label="Tasks completed"
        value="251"
        delta="+8%"
        deltaTone="success"
        sub="vs. previous 6 weeks"
      />,
    );
    expect(screen.getByText('251')).toHaveClass('ht-kpi-value');
    expect(screen.getByText('+8%')).toHaveClass('ht-kpi-delta-success');
    render(
      <Badge tone="warning" icon="clock">
        Approval due tomorrow
      </Badge>,
    );
    expect(screen.getByText('Approval due tomorrow')).toHaveClass('ht-badge-warning');
  });
});
