import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button';
import { DropdownMenu, type DropdownMenuSection } from '../DropdownMenu';

function setup() {
  const onCopy = vi.fn();
  const onDuplicate = vi.fn();
  const onArchive = vi.fn();
  const onDelete = vi.fn();
  const sections: DropdownMenuSection[] = [
    {
      id: 'task',
      heading: 'Task',
      items: [
        { id: 'copy', label: 'Copy link', icon: 'link', shortcut: 'L', onSelect: onCopy },
        { id: 'dup', label: 'Duplicate', icon: 'copy', disabled: true, onSelect: onDuplicate },
        { id: 'archive', label: 'Archive', icon: 'archive', onSelect: onArchive },
      ],
    },
    { id: 'danger', items: [{ id: 'delete', label: 'Delete task', icon: 'trash', danger: true, onSelect: onDelete }] },
  ];
  render(
    <DropdownMenu
      label="Task actions"
      trigger={<Button variant="ghost" icon="more" aria-label="More actions" />}
      items={sections}
    />,
  );
  const trigger = screen.getByRole('button', { name: 'More actions' });
  return { trigger, onCopy, onDuplicate, onArchive, onDelete };
}

describe('DropdownMenu', () => {
  it('opens from the trigger with ARIA wiring and highlights the first item', () => {
    const { trigger } = setup();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox', { name: 'Task actions' });
    expect(trigger).toHaveAttribute('aria-controls', listbox.id);
    expect(listbox).toHaveFocus();
    expect(screen.getByRole('option', { name: /Copy link/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('navigates with arrows (skipping disabled items) and selects with Enter', () => {
    const { trigger, onArchive, onDuplicate } = setup();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    const archive = screen.getByRole('option', { name: /Archive/ });
    expect(archive).toHaveAttribute('aria-selected', 'true');
    expect(listbox).toHaveAttribute('aria-activedescendant', archive.id);
    fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(onArchive).toHaveBeenCalledTimes(1);
    expect(onDuplicate).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('ArrowUp wraps to the last item; End/Home jump', () => {
    const { trigger, onDelete } = setup();
    fireEvent.click(trigger);
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'ArrowUp' });
    expect(screen.getByRole('option', { name: /Delete task/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(listbox, { key: 'Home' });
    expect(screen.getByRole('option', { name: /Copy link/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(listbox, { key: 'End' });
    fireEvent.keyDown(listbox, { key: ' ' });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('supports typeahead', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'd' });
    // "Duplicate" is disabled, so typeahead lands on "Delete task".
    expect(screen.getByRole('option', { name: /Delete task/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('closes on Escape and returns focus to the trigger', () => {
    const { trigger, onCopy } = setup();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(onCopy).not.toHaveBeenCalled();
  });

  it('closes on outside click and selects with the pointer', () => {
    const { trigger, onCopy } = setup();
    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: /Copy link/ }));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });
});
