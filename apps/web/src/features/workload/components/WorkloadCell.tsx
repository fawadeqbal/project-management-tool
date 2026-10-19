import { forwardRef, type KeyboardEvent } from 'react';
import { Icon } from '@hearth/ui';
import type { WorkloadCellDto, WorkloadUnitDto } from '@hearth/contracts';
import { cellTitle, formatAmount } from '../lib/workload-format';
import styles from '../workload.module.css';

interface Props {
  cell: WorkloadCellDto;
  unit: WorkloadUnitDto;
  dayLabel: string;
  focused: boolean;
  weekStart: boolean;
  onOpen: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onFocus: () => void;
}

/**
 * One person-day: the number is always shown, the lightness scale reinforces it, over capacity
 * adds a warning icon and time off is hatched with "Off" — never color alone.
 */
export const WorkloadCell = forwardRef<HTMLButtonElement, Props>(function WorkloadCell({ cell, unit, dayLabel, focused, weekStart, onOpen, onKeyDown, onFocus }, ref) {
  const off = cell.state === 'off';
  const label = cellTitle(cell, unit, dayLabel);
  return (
    <div role="gridcell" className={weekStart ? styles.cellWrapWeek : styles.cellWrap}>
      <button
        ref={ref}
        type="button"
        className={styles.cell}
        data-state={cell.state}
        tabIndex={focused ? 0 : -1}
        aria-label={label}
        aria-haspopup={off ? undefined : 'dialog'}
        title={label}
        onClick={off ? undefined : onOpen}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
      >
        {cell.state === 'over' ? <Icon name="alert" size={12} aria-hidden="true" data-testid="over-icon" /> : null}
        {off ? 'Off' : formatAmount(cell.planned, unit)}
      </button>
    </div>
  );
});
