import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from '../SegmentedControl';

const options = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
];

describe('SegmentedControl', () => {
  it('renders radiogroup semantics', () => {
    render(<SegmentedControl options={options} value="week" onChange={() => undefined} label="Range" />);
    expect(screen.getByRole('radiogroup', { name: 'Range' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Week' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Week' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Day' })).toHaveAttribute('tabindex', '-1');
  });

  it('selects on click and with arrow keys', () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={options} value="week" onChange={onChange} label="Range" />);
    fireEvent.click(screen.getByRole('radio', { name: 'Month' }));
    expect(onChange).toHaveBeenLastCalledWith('month');
    const week = screen.getByRole('radio', { name: 'Week' });
    week.focus();
    fireEvent.keyDown(week, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('day');
    expect(screen.getByRole('radio', { name: 'Day' })).toHaveFocus();
  });
});
