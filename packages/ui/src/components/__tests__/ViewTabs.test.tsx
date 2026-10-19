import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ViewTabs, type ViewTab } from '../ViewTabs';

const tabs: ViewTab[] = [
  { id: 'list', label: 'List', icon: 'list' },
  { id: 'board', label: 'Board', icon: 'board' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar-view' },
];

describe('ViewTabs', () => {
  it('renders tablist/tab roles with roving tabindex', () => {
    render(<ViewTabs tabs={tabs} value="board" label="Project views" />);
    expect(screen.getByRole('tablist', { name: 'Project views' })).toBeInTheDocument();
    const [list, board, calendar] = screen.getAllByRole('tab');
    expect(board).toHaveAttribute('aria-selected', 'true');
    expect(board).toHaveAttribute('tabindex', '0');
    expect(list).toHaveAttribute('tabindex', '-1');
    expect(calendar).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowRight / ArrowLeft move focus and call onChange, wrapping around', () => {
    const onChange = vi.fn();
    render(<ViewTabs tabs={tabs} value="list" onChange={onChange} />);
    const list = screen.getByRole('tab', { name: 'List' });
    list.focus();
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('board');
    expect(screen.getByRole('tab', { name: 'Board' })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Board' }), { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('calendar');

    // Wrapping back to the already-selected tab moves focus without a redundant onChange.
    onChange.mockClear();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Calendar' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'List' })).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ArrowLeft from the first tab wraps to the last', () => {
    function Harness() {
      const [value, setValue] = useState('list');
      return <ViewTabs tabs={tabs} value={value} onChange={setValue} />;
    }
    render(<Harness />);
    const list = screen.getByRole('tab', { name: 'List' });
    list.focus();
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    const calendar = screen.getByRole('tab', { name: 'Calendar' });
    expect(calendar).toHaveFocus();
    expect(calendar).toHaveAttribute('aria-selected', 'true');
    expect(calendar).toHaveAttribute('tabindex', '0');
  });

  it('clicking a tab selects it', () => {
    const onChange = vi.fn();
    render(<ViewTabs tabs={tabs} value="list" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));
    expect(onChange).toHaveBeenCalledWith('calendar');
  });
});
