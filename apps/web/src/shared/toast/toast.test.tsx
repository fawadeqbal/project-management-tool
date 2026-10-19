import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastRegion, useToastStore } from './index';

describe('toasts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.getState().clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Undo invokes onAction and dismisses the toast', () => {
    const onAction = vi.fn();
    render(<ToastRegion />);
    act(() => {
      useToastStore.getState().show({ message: 'HRT-129 marked as done', action: 'Undo', onAction });
    });
    expect(screen.getByText('HRT-129 marked as done')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('HRT-129 marked as done')).not.toBeInTheDocument();
  });

  it('auto-dismisses after 8 seconds by default', () => {
    render(<ToastRegion />);
    act(() => {
      useToastStore.getState().show({ message: 'Saved' });
    });
    act(() => {
      vi.advanceTimersByTime(7_900);
    });
    expect(screen.getByText('Saved')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('pauses while hovered and resumes with the remaining time', () => {
    render(<ToastRegion />);
    act(() => {
      useToastStore.getState().show({ message: 'Moved', durationMs: 1000 });
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    const toast = screen.getByText('Moved').closest('[data-tone]')!;
    fireEvent.mouseEnter(toast);
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByText('Moved')).toBeInTheDocument();
    fireEvent.mouseLeave(toast);
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(screen.queryByText('Moved')).not.toBeInTheDocument();
  });

  it('lives in a polite live region', () => {
    render(<ToastRegion />);
    expect(screen.getByRole('region', { name: 'Notifications' })).toHaveAttribute('aria-live', 'polite');
  });
});
