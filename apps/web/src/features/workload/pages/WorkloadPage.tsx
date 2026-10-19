import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { Button, EmptyState, KpiTile, SegmentedControl, Select, Skeleton, ViewTabs, type ViewTab } from '@hearth/ui';
import type { WorkloadDto, WorkloadPersonDto, WorkloadUnitDto } from '@hearth/contracts';
import { useRegisterCommands } from '@/shared/commands';
import type { Command } from '@/shared/commands/command';
import { useHotkey } from '@/shared/hotkeys/use-hotkey';
import { useRealtimeEvent } from '@/shared/realtime';
import { useQueryClient } from '@tanstack/react-query';
import { AssigneePicker } from '@/shared/tasks/pickers';
import { useTeams } from '@/shared/workspace/hooks';
import { PlanGateDialog } from '@/features/sprints';
import { useReassign, useWorkload, workloadKeys, type WorkloadParams } from '../api';
import { CellPopover, type OpenCell } from '../components/CellPopover';
import { SuggestionCard } from '../components/SuggestionCard';
import { TimeOffDialog } from '../components/TimeOffDialog';
import { WorkloadGrid } from '../components/WorkloadGrid';
import { WorkloadLegend } from '../components/WorkloadLegend';
import { isoToday, rangeFor } from '../lib/days';
import { firstName, formatAmount, listNames, unitWord } from '../lib/workload-format';
import styles from '../workload.module.css';

const UNITS = [
  { id: 'hours', label: 'Hours' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'points', label: 'Points' },
] as const;

export const PROJECT_VIEW_TABS: ViewTab[] = [
  { id: 'list', label: 'List', icon: 'list' },
  { id: 'board', label: 'Board', icon: 'board' },
  { id: 'timeline', label: 'Timeline', icon: 'timeline' },
  { id: 'workload', label: 'Workload', icon: 'workload' },
];
const viewPath = (projectId: string, id: string) => `/projects/${projectId}/${id}`;

const isUnit = (v: string | null): v is WorkloadUnitDto => v === 'hours' || v === 'tasks' || v === 'points';

/** KPI chips answer the PM's first question: who is overloaded this week? */
function SummaryChips({ w }: { w: WorkloadDto }) {
  const s = w.summary;
  const weekDays = new Set(w.days.slice(0, 5).map((d) => d.date));
  const overThisWeek = s.overCapacity.filter((o) => o.days.some((d) => weekDays.has(d)));
  const unit = w.unit;
  return (
    <div className={styles.kpis}>
      <KpiTile label="Team capacity used" value={`${s.capacityUsedPct}%`} sub={`${formatAmount(s.planned, unit)} of ${formatAmount(s.capacity, unit)} planned`} />
      <KpiTile
        label="Over capacity"
        icon={overThisWeek.length ? 'alert' : undefined}
        value={overThisWeek.length ? `${overThisWeek.length} ${overThisWeek.length === 1 ? 'person' : 'people'}` : 'No one'}
        valueTone={overThisWeek.length ? 'warning' : 'neutral'}
        sub={overThisWeek.length ? overThisWeek.map((o) => `${firstName(o.user.name)} (${o.label})`).join(', ') : 'Everyone fits this week'}
      />
      <KpiTile
        label="Free capacity"
        value={formatAmount(s.freeCapacity, unit)}
        sub={s.freeBy.length ? `Mostly ${listNames(s.freeBy.slice(0, 3).map((f) => firstName(f.user.name)))}` : 'Nobody has room'}
      />
      <KpiTile
        label="Time off"
        value={s.timeOff.length ? `${s.timeOff.length} ${s.timeOff.length === 1 ? 'person' : 'people'}` : 'No one'}
        sub={s.timeOff.length ? s.timeOff.map((t) => `${firstName(t.user.name)} · ${t.label}`).join(', ') : 'Everyone is in'}
      />
    </div>
  );
}

export function WorkloadPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const weekOffset = Number(params.get('week') ?? 0) || 0;
  const unitParam = params.get('unit');
  const unit: WorkloadUnitDto = isUnit(unitParam) ? unitParam : 'hours';
  const teamId = params.get('team') ?? undefined;
  const { data: teams = [] } = useTeams();

  const query = useMemo<WorkloadParams>(() => ({ ...rangeFor(new Date(), weekOffset), unit, projectId, teamId }), [weekOffset, unit, projectId, teamId]);
  const workload = useWorkload(query);
  const reassign = useReassign();
  const w = workload.data;
  const client = useQueryClient();
  const refresh = () => void client.invalidateQueries({ queryKey: workloadKeys.all });
  // Someone else reassigns, reschedules or adds time off → the grid follows.
  useRealtimeEvent('task.', refresh);
  useRealtimeEvent('time_off.', refresh);
  useRealtimeEvent('capacity.', refresh);

  const [openCell, setOpenCell] = useState<OpenCell | null>(null);
  const [pickerTask, setPickerTask] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [timeOffOpen, setTimeOffOpen] = useState(false);
  const anchorRef = useRef<HTMLElement | null>(null);

  const setParam = (key: string, value: string | null) =>
    setParams((p) => {
      const next = new URLSearchParams(p);
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
      return next;
    });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const taskId = active.data.current?.taskId as string | undefined;
    const toUserId = over?.data.current?.userId as string | undefined;
    if (!w || !taskId || !toUserId || active.data.current?.fromUserId === toUserId) return;
    setOpenCell(null);
    reassign(w, taskId, toUserId);
  };

  const suggestion = w?.suggestions.find((s) => !dismissed.has(s.id));

  const commands = useMemo<Command[]>(
    () => [
      { id: 'workload.time-off', title: 'Add time off', group: 'Actions', icon: 'calendar', keywords: ['vacation', 'holiday', 'leave', 'workload'], run: () => setTimeOffOpen(true) },
      {
        id: 'workload.next-range',
        title: 'Workload: next two weeks',
        group: 'Navigate',
        icon: 'arrow-right',
        run: () => setParam('week', String(weekOffset + 1)),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParam is stable enough for the palette
    [weekOffset],
  );
  useRegisterCommands(commands);
  useHotkey('T', () => setParam('week', null));

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <main className={styles.page}>
        <PlanGateDialog />
        <header className={styles.header}>
          <h1 className={styles.h1}>Workload</h1>
          <span className={styles.subtitle}>
            {w ? `${w.range.label} · ${unit === 'hours' ? 'hours planned vs. daily capacity' : `${unit} planned per day`}` : ' '}
          </span>
          <span className={styles.grow} />
          <SegmentedControl label="Unit" options={UNITS} value={unit} onChange={(id) => setParam('unit', id === 'hours' ? null : id)} />
          {projectId ? (
            <ViewTabs tabs={PROJECT_VIEW_TABS} value="workload" onChange={(id) => void navigate(viewPath(projectId, id))} />
          ) : null}
        </header>
        <div className={styles.toolbar}>
          <div className={styles.rangeNav} role="group" aria-label="Date range">
            <Button size="sm" variant="secondary" icon="chevron-right" className={styles.flip} aria-label="Previous two weeks" onClick={() => setParam('week', String(weekOffset - 1))} />
            <Button size="sm" variant="secondary" onClick={() => setParam('week', null)} disabled={weekOffset === 0} title="Today (T)">
              Today
            </Button>
            <Button size="sm" variant="secondary" icon="chevron-right" aria-label="Next two weeks" onClick={() => setParam('week', String(weekOffset + 1))} />
          </div>
          <Select
            label="Team"
            hideLabel
            value={teamId ?? ''}
            onChange={(e) => setParam('team', e.target.value || null)}
            options={[{ value: '', label: 'All teams' }, ...teams.map((t) => ({ value: t.id, label: t.name }))]}
            className={styles.teamSelect}
          />
          <span className={styles.grow} />
          <Button size="sm" variant="secondary" icon="calendar" onClick={() => setTimeOffOpen(true)}>
            Add time off
          </Button>
        </div>

        {!w ? (
          <div aria-busy="true" aria-label="Loading workload" className={styles.loading}>
            <Skeleton height={84} />
            <Skeleton height={320} />
          </div>
        ) : w.people.length === 0 ? (
          <EmptyState icon="users" title="No one to show" description="Nobody in this team or project has work planned in these two weeks. Try All teams." />
        ) : (
          <>
            <SummaryChips w={w} />
            {suggestion ? (
              <SuggestionCard
                suggestion={suggestion}
                onAccept={() => {
                  setDismissed((d) => new Set(d).add(suggestion.id));
                  reassign(w, suggestion.task.id, suggestion.to.id);
                }}
                onDismiss={() => setDismissed((d) => new Set(d).add(suggestion.id))}
              />
            ) : null}
            <WorkloadGrid
              workload={w}
              onOpenCell={(p: WorkloadPersonDto, date, el) => {
                anchorRef.current = el;
                setOpenCell({ userId: p.user.id, date });
              }}
            />
            <WorkloadLegend />
            <CellPopover
              open={openCell}
              anchorRef={anchorRef}
              workload={w}
              onClose={() => setOpenCell(null)}
              onReassign={(taskId) => {
                setOpenCell(null);
                setPickerTask(taskId);
              }}
            />
            <AssigneePicker
              open={!!pickerTask}
              onOpenChange={(o) => !o && setPickerTask(null)}
              anchorRef={anchorRef}
              value={pickerTask ? (w.tasks[pickerTask]?.assigneeId ?? null) : null}
              onChange={(id) => {
                if (pickerTask && id) reassign(w, pickerTask, id);
                setPickerTask(null);
              }}
            />
            <p className={styles.srOnly} aria-live="polite">
              {w.summary.overCapacity.length
                ? `${w.summary.overCapacity.length} over capacity: ${w.summary.overCapacity.map((o) => `${o.user.name} ${o.label}`).join(', ')}.`
                : `No one is over capacity. ${Math.round(w.summary.freeCapacity)} ${unitWord(Math.round(w.summary.freeCapacity), unit)} free.`}
            </p>
          </>
        )}
        {timeOffOpen ? <TimeOffDialog onClose={() => setTimeOffOpen(false)} defaultDate={isoToday()} /> : null}
      </main>
    </DndContext>
  );
}
