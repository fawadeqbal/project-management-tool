import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { DASHBOARD_WIDGETS, type DashboardDto, type DashboardWidgetId, type ReportRangeDto } from '@hearth/contracts';
import { humanizeTimeAgo } from '@hearth/domain';
import { Button, EmptyState, SegmentedControl, Skeleton } from '@hearth/ui';
import { ApiError } from '@/shared/api/http';
import { useRegisterCommands, type Command } from '@/shared/commands';
import { useToast } from '@/shared/toast';
import { useUpgradePrompt } from '@/features/billing';
import { dashboardApi, dashboardKeys, useDashboard } from '../api';
import { KpiRow } from '../components/KpiRow';
import { ProjectHealthTable } from '../components/ProjectHealthTable';
import { ScheduleDialog } from '../components/ScheduleDialog';
import { SortableWidget } from '../components/SortableWidget';
import { StatusMixCard } from '../components/StatusMixCard';
import { ThroughputChart } from '../components/ThroughputChart';
import styles from '../dashboard.module.css';

const RANGES = [
  { id: '2w', label: '2W' },
  { id: '6w', label: '6W' },
  { id: 'q', label: 'Quarter' },
];
const isRange = (v: string | null): v is ReportRangeDto => v === '2w' || v === '6w' || v === 'q';

const WIDGET_META: Record<DashboardWidgetId, { label: string; wide: boolean }> = {
  kpis: { label: 'Key numbers', wide: true },
  throughput: { label: 'Created vs completed', wide: false },
  'status-mix': { label: 'Open work by status', wide: false },
  'project-health': { label: 'Project health', wide: true },
};

function DashboardSkeleton() {
  return (
    <div className={styles.grid} aria-busy="true" aria-label="Loading dashboard">
      <div className={`${styles.kpis} ${styles.widgetWide}`}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={108} radius={10} />
        ))}
      </div>
      <Skeleton height={300} radius={10} className={styles.widgetHalf} />
      <Skeleton height={300} radius={10} className={styles.widgetHalf} />
      <Skeleton height={200} radius={10} className={styles.widgetWide} />
    </div>
  );
}

/** Dashboards (Dashboard.dc.html): KPIs, created vs completed, status mix, project health. */
export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const range: ReportRangeDto = isRange(params.get('range')) ? (params.get('range') as ReportRangeDto) : '6w';
  const projectId = params.get('project') ?? undefined;
  const { data, isLoading, error, refetch, isFetching } = useDashboard(range, projectId);
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<DashboardWidgetId[]>([...DASHBOARD_WIDGETS]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [, setTick] = useState(0);
  const client = useQueryClient();
  const { show } = useToast();
  const upgrade = useUpgradePrompt({ onPreview: () => setEditing(false) });

  const serverLayout = data?.layout.join(',');
  useEffect(() => {
    if (serverLayout && !editing) setOrder(serverLayout.split(',') as DashboardWidgetId[]);
  }, [serverLayout, editing]);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const saveLayout = useMutation<{ layout: DashboardWidgetId[] }, ApiError, DashboardWidgetId[]>({
    mutationFn: async (w) => {
      try {
        return await dashboardApi.saveLayout(w);
      } catch (e) {
        throw ApiError.from(e);
      }
    },
    onSuccess: ({ layout }) => {
      client.setQueriesData<DashboardDto>({ queryKey: dashboardKeys.all }, (old) => (old ? { ...old, layout } : old));
      setEditing(false);
      show({ message: 'Layout saved' });
    },
    onError: (e) => {
      if (!upgrade.handleError(e)) show({ message: e.message, tone: 'danger', icon: 'alert' });
      if (data) setOrder(data.layout);
    },
  });

  const schedule = useMutation<unknown, ApiError, string[]>({
    mutationFn: async (r) => {
      try {
        return await dashboardApi.schedule(r);
      } catch (e) {
        throw ApiError.from(e);
      }
    },
    onSuccess: (_d, r) => {
      setScheduleOpen(false);
      void client.invalidateQueries({ queryKey: dashboardKeys.all });
      show({ message: `Weekly email scheduled for ${r.length} ${r.length === 1 ? 'person' : 'people'}` });
    },
    onError: (e) => {
      setScheduleOpen(false);
      if (!upgrade.handleError(e)) show({ message: e.message, tone: 'danger', icon: 'alert' });
    },
  });

  const share = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      show({ message: 'Link copied — teammates see the same range.' });
    } catch {
      show({ message: `Copy this link: ${url}`, tone: 'info', durationMs: 12_000 });
    }
  };

  const setRange = (r: string) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.set('range', r);
        return next;
      },
      { replace: true },
    );

  const commands = useMemo<Command[]>(
    () => [
      { id: 'dashboard.range.2w', title: 'Dashboard range: 2 weeks', group: 'Actions', icon: 'calendar', run: () => setRange('2w') },
      { id: 'dashboard.range.6w', title: 'Dashboard range: 6 weeks', group: 'Actions', icon: 'calendar', run: () => setRange('6w') },
      { id: 'dashboard.range.q', title: 'Dashboard range: Quarter', group: 'Actions', icon: 'calendar', run: () => setRange('q') },
      { id: 'dashboard.edit-layout', title: 'Edit dashboard layout', group: 'Actions', icon: 'settings', run: () => setEditing(true) },
      { id: 'dashboard.schedule', title: 'Schedule dashboard email', group: 'Actions', icon: 'clock', run: () => setScheduleOpen(true) },
      { id: 'dashboard.share', title: 'Copy dashboard link', group: 'Actions', icon: 'link', run: () => void share() },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setters are stable; share reads location at call time
    [],
  );
  useRegisterCommands(commands);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((o) => arrayMove(o, o.indexOf(active.id as DashboardWidgetId), o.indexOf(over.id as DashboardWidgetId)));
  };

  const widget = (id: DashboardWidgetId, d: DashboardDto): ReactNode => {
    switch (id) {
      case 'kpis':
        return <KpiRow kpis={d.kpis} />;
      case 'throughput':
        return <ThroughputChart data={d} />;
      case 'status-mix':
        return <StatusMixCard mix={d.statusMix} blockedNote={d.blockedNote} />;
      case 'project-health':
        return <ProjectHealthTable rows={d.projects} />;
    }
  };

  const subtitle = data
    ? `${data.projectCount} project${data.projectCount === 1 ? '' : 's'} · ${data.rangeLabel} · updated ${humanizeTimeAgo(new Date(data.generatedAt), new Date())}`
    : 'Loading…';

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{data?.title ?? 'Dashboard'}</h1>
          <span className={styles.subtitle} aria-live="polite">
            {subtitle}
            {isFetching && !isLoading ? ' · refreshing' : ''}
          </span>
        </div>
        <SegmentedControl label="Date range" options={RANGES} value={range} onChange={setRange} />
        {editing ? (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(false);
                if (data) setOrder(data.layout);
              }}
            >
              Cancel
            </Button>
            <Button icon="check" loading={saveLayout.isPending} onClick={() => saveLayout.mutate(order)}>
              Save layout
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" icon="clock" onClick={() => setScheduleOpen(true)}>
              Schedule email
            </Button>
            <Button variant="secondary" icon="link" onClick={() => void share()}>
              Share
            </Button>
            <Button variant="ghost" icon="settings" onClick={() => setEditing(true)} disabled={!data}>
              Edit layout
            </Button>
          </>
        )}
      </div>

      {editing ? (
        <p className={styles.editHint} role="status">
          Drag widgets by their handle to rearrange — or focus a handle, press Space, and use the arrow keys.
        </p>
      ) : null}

      {isLoading ? <DashboardSkeleton /> : null}
      {error && !data ? (
        <EmptyState icon="alert" title="The dashboard didn’t load" description={error.message} primaryAction={<Button onClick={() => void refetch()}>Try again</Button>} />
      ) : null}
      {data ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className={styles.grid}>
              {order.map((id) => (
                <SortableWidget key={id} id={id} label={WIDGET_META[id].label} wide={WIDGET_META[id].wide} editing={editing}>
                  {widget(id, data)}
                </SortableWidget>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : null}

      <ScheduleDialog open={scheduleOpen} initial={data?.schedule?.recipients ?? []} busy={schedule.isPending} onClose={() => setScheduleOpen(false)} onSubmit={(r) => schedule.mutate(r)} />
      {upgrade.element}
    </div>
  );
}
