import { useRef, type KeyboardEvent, type RefObject } from 'react';
import { Icon, Kbd, Popover } from '@hearth/ui';
import type { TaskDto, TaskStatusDto } from '@hearth/contracts';
import { STATUS_META, TASK_STATUSES } from '@hearth/domain';
import { STATUS_ICON } from '@/shared/tasks/meta';
import styles from './board.module.css';

export interface MoveToMenuProps {
  task: TaskDto;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onMove: (status: TaskStatusDto) => void;
  onReorder: (where: 'top' | 'bottom') => void;
}

/** "Move to…" (M): the keyboard alternative to dragging a card. ↑/↓ to choose, Enter to move. */
export function MoveToMenu({ task, anchorRef, onClose, onMove, onReorder }: MoveToMenuProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };
  const choose = (fn: () => void) => () => {
    onClose();
    fn();
    requestAnimationFrame(() => anchorRef.current?.focus());
  };
  return (
    <Popover open onOpenChange={(open) => !open && onClose()} anchorRef={anchorRef} align="start">
      <div ref={listRef} role="menu" aria-label={`Move ${task.key} to`} className={styles.moveMenu} onKeyDown={onKeyDown}>
        <div className={styles.moveHeading}>Move {task.key} to…</div>
        {TASK_STATUSES.map((s) => (
          <button key={s} type="button" role="menuitem" className={styles.moveItem} disabled={s === task.status} onClick={choose(() => onMove(s))}>
            <Icon name={STATUS_ICON[s].icon} style={{ color: STATUS_ICON[s].color }} />
            <span className={styles.grow}>{STATUS_META[s].label}</span>
            {s === task.status ? <span className={styles.moveHint}>Current</span> : null}
          </button>
        ))}
        <div className={styles.moveDivider} role="separator" />
        <button type="button" role="menuitem" className={styles.moveItem} onClick={choose(() => onReorder('top'))}>
          <Icon name="arrow-up-right" />
          <span className={styles.grow}>Top of column</span>
        </button>
        <button type="button" role="menuitem" className={styles.moveItem} onClick={choose(() => onReorder('bottom'))}>
          <Icon name="arrow-right" />
          <span className={styles.grow}>Bottom of column</span>
        </button>
        <p className={styles.moveFoot}>
          Tip: <Kbd keys={['Alt', '←']} /> <Kbd keys={['Alt', '→']} /> move between columns
        </p>
      </div>
    </Popover>
  );
}
