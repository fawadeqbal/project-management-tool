import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TaskCheckbox } from '../TaskCheckbox';

describe('TaskCheckbox', () => {
  it('exposes checkbox semantics with a default label', () => {
    render(<TaskCheckbox />);
    const box = screen.getByRole('checkbox', { name: 'Mark complete' });
    expect(box).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange with the next value', () => {
    const onChange = vi.fn();
    render(<TaskCheckbox checked={false} label="Mark HRT-1 as done" onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark HRT-1 as done' }));
    expect(onChange).toHaveBeenCalledWith(true, expect.anything());
  });

  it('toggles aria-checked when controlled', () => {
    function Harness() {
      const [checked, setChecked] = useState(false);
      return <TaskCheckbox checked={checked} onChange={setChecked} />;
    }
    render(<Harness />);
    const box = screen.getByRole('checkbox');
    fireEvent.click(box);
    expect(box).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(box);
    expect(box).toHaveAttribute('aria-checked', 'false');
  });
});
