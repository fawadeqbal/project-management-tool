import { useRef, useState, type KeyboardEvent } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Avatar, ProgressBar } from '@hearth/ui';
import type { WorkloadDto, WorkloadPersonDto } from '@hearth/contracts';
import { WorkloadCell } from './WorkloadCell';
import styles from '../workload.module.css';

export interface CellPos {
  row: number;
  col: number;
}

interface Props {
  workload: WorkloadDto;
  /** Called with the cell element so popovers can anchor to it. */
  onOpenCell: (person: WorkloadPersonDto, date: string, el: HTMLElement) => void;
}

/**
 * One row per person × one cell per working day. Arrow keys move focus (roving tabindex),
 * Home/End jump within a row, Enter opens the day's tasks. Rows accept dropped task chips.
 */
export function WorkloadGrid({ workload, onOpenCell }: Props) {
  const [focus, setFocus] = useState<CellPos>({ row: 0, col: Math.max(0, workload.days.findIndex((d) => d.isToday)) });
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const rows = workload.people.length;
  const cols = workload.days.length;
  const at = (p: CellPos) => cellRefs.current.get(`${p.row}:${p.col}`);
  const safe = { row: Math.min(focus.row, Math.max(0, rows - 1)), col: Math.min(focus.col, Math.max(0, cols - 1)) };

  const move = (e: KeyboardEvent<HTMLButtonElement>, pos: CellPos) => {
    const deltas: Record<string, [number, number]> = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
    let next: CellPos | null = null;
    if (deltas[e.key]) {
      const [dr, dc] = deltas[e.key]!;
      next = { row: Math.max(0, Math.min(rows - 1, pos.row + dr)), col: Math.max(0, Math.min(cols - 1, pos.col + dc)) };
    } else if (e.key === 'Home') next = { row: pos.row, col: 0 };
    else if (e.key === 'End') next = { row: pos.row, col: cols - 1 };
    if (!next) return;
    e.preventDefault();
    setFocus(next);
    at(next)?.focus();
  };

  const template = { gridTemplateColumns: `minmax(180px, 220px) repeat(${cols}, minmax(52px, 1fr)) 96px` };

  return (
    <div className={styles.gridScroll}>
      <div role="grid" aria-label="Team workload" aria-rowcount={rows + 1} aria-colcount={cols + 2} className={styles.grid}>
        <div role="row" className={styles.headRow} style={template}>
          <div role="columnheader" className={styles.personHead}>
            Person
          </div>
          {workload.days.map((d) => (
            <div
              role="columnheader"
              key={d.date}
              className={d.weekStart ? styles.dayHeadWeek : styles.dayHead}
              data-today={d.isToday || undefined}
              aria-label={d.isToday ? `${d.label}, today` : d.label}
            >
              {d.label}
            </div>
          ))}
          <div role="columnheader" className={styles.loadHead}>
            Load
          </div>
        </div>
        {workload.people.map((p, row) => (
          <PersonRow key={p.user.id} person={p} template={template}>
            {p.cells.map((c, col) => (
              <WorkloadCell
                key={c.date}
                ref={(el) => {
                  if (el) cellRefs.current.set(`${row}:${col}`, el);
                  else cellRefs.current.delete(`${row}:${col}`);
                }}
                cell={c}
                unit={workload.unit}
                dayLabel={workload.days[col]?.label ?? c.date}
                weekStart={!!workload.days[col]?.weekStart}
                focused={safe.row === row && safe.col === col}
                onFocus={() => setFocus({ row, col })}
                onOpen={() => {
                  const el = at({ row, col });
                  if (el) onOpenCell(p, c.date, el);
                }}
                onKeyDown={(e) => move(e, { row, col })}
              />
            ))}
          </PersonRow>
        ))}
      </div>
    </div>
  );
}

function PersonRow({ person, template, children }: { person: WorkloadPersonDto; template: { gridTemplateColumns: string }; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `person:${person.user.id}`, data: { userId: person.user.id } });
  const over = person.loadPct > 100;
  return (
    <div ref={setNodeRef} role="row" className={isOver ? styles.rowDropping : styles.row} style={template} aria-label={`${person.user.name}, ${person.loadPct}% load`}>
      <div role="rowheader" className={styles.person}>
        <Avatar initials={person.user.initials} name={person.user.name} color={person.user.avatarColor} size={32} />
        <span className={styles.personText}>
          <span className={styles.personName}>{person.user.name}</span>
          <span className={styles.personRole}>{person.jobTitle ?? `${person.capacityHoursPerDay}h a day`}</span>
        </span>
      </div>
      {children}
      <div role="gridcell" className={styles.load}>
        <span className={over ? styles.loadOver : styles.loadValue}>{person.loadPct}%</span>
        <span className={styles.loadBar}>
          <ProgressBar value={Math.min(100, person.loadPct)} height={4} label={`${person.user.name}’s load`} />
        </span>
      </div>
    </div>
  );
}
