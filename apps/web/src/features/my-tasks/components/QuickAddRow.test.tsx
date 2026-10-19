import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuickAddRow } from './QuickAddRow';

describe('QuickAddRow', () => {
  it('previews recognized tokens as chips while typing', () => {
    render(<QuickAddRow onSubmit={vi.fn()} />);
    const input = screen.getByRole('textbox', { name: /Add a task/ });
    fireEvent.change(input, { target: { value: 'Draft retro agenda @sara #website !high tomorrow' } });
    const chips = within(screen.getByRole('list', { name: 'Recognized details' })).getAllByRole('listitem');
    expect(chips.map((c) => c.textContent)).toEqual(['Assignee@sara', 'Project#website', 'PriorityHigh', 'DueTomorrow']);
  });

  it('shows no chips for plain text', () => {
    render(<QuickAddRow onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Add a task/ }), { target: { value: 'Just a title' } });
    expect(screen.queryByRole('list', { name: 'Recognized details' })).not.toBeInTheDocument();
  });

  it('submits the raw text on Enter and clears', () => {
    const onSubmit = vi.fn();
    render(<QuickAddRow onSubmit={onSubmit} />);
    const input = screen.getByRole('textbox', { name: /Add a task/ });
    fireEvent.change(input, { target: { value: 'Ship pricing !urgent' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('Ship pricing !urgent');
    expect(input).toHaveValue('');
  });
});
