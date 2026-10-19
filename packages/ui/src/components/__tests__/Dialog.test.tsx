import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button';
import { Dialog } from '../Dialog';

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Invite people</Button>
      <Dialog
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="Invite people"
        description="They will get an email with a link."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button>Send invites</Button>
          </>
        }
      >
        <input aria-label="Email" />
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('renders a labelled modal into document.body and focuses the first field', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Invite people' }));
    const dialog = screen.getByRole('dialog', { name: 'Invite people' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('They will get an email with a link.');
    expect(dialog.closest('.ht-overlay')?.parentElement).toBe(document.body);
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('traps focus with Tab and Shift+Tab', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Invite people' }));
    const dialog = screen.getByRole('dialog');
    const close = screen.getByRole('button', { name: 'Close' });
    const send = screen.getByRole('button', { name: 'Send invites' });

    send.focus();
    fireEvent.keyDown(send, { key: 'Tab' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(send).toHaveFocus();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('closes on Escape and returns focus to the trigger', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const trigger = screen.getByRole('button', { name: 'Invite people' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Email' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes from the close button', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Invite people' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
