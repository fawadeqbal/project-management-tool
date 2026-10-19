import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Priority, PriorityIcon } from '../Priority';
import { StatusIcon, StatusPill } from '../Status';
import { STATUS_LABELS, toUiPriority, toUiStatus } from '../../types';

describe('StatusPill', () => {
  it.each([
    ['todo', 'To do'],
    ['in-progress', 'In progress'],
    ['in-review', 'In review'],
    ['blocked', 'Blocked'],
    ['done', 'Done'],
  ] as const)('labels %s as "%s"', (status, label) => {
    render(<StatusPill status={status} />);
    expect(screen.getByText(label)).toHaveClass('ht-status');
  });

  it('accepts a custom label', () => {
    render(<StatusPill status="done" label="Shipped" />);
    expect(screen.getByText('Shipped')).toBeInTheDocument();
  });

  it('StatusIcon is decorative unless labelled', () => {
    const { rerender } = render(<StatusIcon status="blocked" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    rerender(<StatusIcon status="blocked" label />);
    expect(screen.getByRole('img', { name: 'Blocked' })).toBeInTheDocument();
  });
});

describe('Priority', () => {
  it('icon announces the level', () => {
    render(<PriorityIcon level="urgent" />);
    expect(screen.getByRole('img', { name: 'Priority: Urgent' })).toBeInTheDocument();
  });

  it('shows the label text and hides the redundant icon name', () => {
    render(<Priority level="none" showLabel />);
    expect(screen.getByText('No priority')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('without label exposes the icon name', () => {
    render(<Priority level="medium" />);
    expect(screen.getByRole('img', { name: 'Priority: Medium' })).toBeInTheDocument();
  });
});

describe('mappers', () => {
  it('maps domain enums to UI values', () => {
    expect(toUiStatus('IN_PROGRESS')).toBe('in-progress');
    expect(toUiStatus('DONE')).toBe('done');
    expect(toUiPriority('URGENT')).toBe('urgent');
    expect(toUiPriority('NONE')).toBe('none');
    expect(STATUS_LABELS[toUiStatus('IN_REVIEW')]).toBe('In review');
  });
});
