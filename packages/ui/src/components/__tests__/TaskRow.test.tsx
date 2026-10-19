import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardCard } from '../BoardCard';
import { GroupHeader } from '../GroupHeader';
import { TaskRow } from '../TaskRow';

describe('TaskRow', () => {
  it('is focusable and opens on Enter and click, but not from the checkbox', () => {
    const onOpen = vi.fn();
    const onToggleDone = vi.fn();
    render(
      <TaskRow id="HRT-142" title="Write onboarding copy" status="in-progress" priority="high" onOpen={onOpen} onToggleDone={onToggleDone} />,
    );
    const row = screen.getByRole('row', { name: 'HRT-142 Write onboarding copy' });
    expect(row).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark HRT-142 as done' }));
    expect(onToggleDone).toHaveBeenCalledWith(true);
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('hides tag and due in compact mode', () => {
    render(<TaskRow id="HRT-1" title="T" tag="Design" due="Today" compact />);
    expect(screen.queryByText('Design')).not.toBeInTheDocument();
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
  });
});

describe('GroupHeader', () => {
  it('renders a real toggle button with aria-expanded', () => {
    const onToggle = vi.fn();
    const onAdd = vi.fn();
    render(<GroupHeader label="Today" count={3} collapsed onToggle={onToggle} onAdd={onAdd} />);
    const toggle = screen.getByRole('button', { name: /^Today/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Add task to Today' }));
    expect(onAdd).toHaveBeenCalled();
  });
});

describe('BoardCard', () => {
  it('forwards ref and extra props, and activates with Enter', () => {
    const ref = { current: null as HTMLDivElement | null };
    const onClick = vi.fn();
    render(<BoardCard ref={ref} id="HRT-188" title="Pricing page" comments={2} data-dnd="x" onClick={onClick} />);
    const card = screen.getByRole('button', { name: /HRT-188/ });
    expect(ref.current).toBe(card);
    expect(card).toHaveAttribute('data-dnd', 'x');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
