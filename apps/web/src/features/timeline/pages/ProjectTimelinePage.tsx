import { useMemo, useRef, useState } from 'react';
import { Button, EmptyState, SegmentedControl, Skeleton } from '@hearth/ui';
import type { TimelineRowDto } from '@hearth/contracts';
import { ProjectFilterBar, useProjectContext, useProjectFilters, matchesProjectFilters } from '@/features/projects';
import { usePermission } from '@/shared/auth/use-permission';
import { useTaskPanel } from '@/shared/tasks/useTaskPanel';
import { useTimeline } from '../api';
import { AddMilestoneDialog } from '../components/AddMilestoneDialog';
import { TimelineChart } from '../components/TimelineChart';
import { TimelineTaskList } from '../components/TimelineTaskList';
import { useScheduleDrafts } from '../components/use-schedule-drafts';
import { chartRange, makeScale, ZOOM_OPTIONS, type Zoom } from '../timeline-scale';
import styles from '../timeline.module.css';

const ZOOM_KEY = 'hearth.timeline.zoom';
const readZoom = (): Zoom => {
  try {
    const z = window.localStorage.getItem(ZOOM_KEY);
    return z === 'day' || z === 'month' || z === 'quarter' ? z : 'week';
  } catch {
    return 'week';
  }
};

/** Project timeline (Timeline.dc.html): sections, bars, baselines, milestones, dependencies, critical path. */
export function ProjectTimelinePage() {
  const { project, projectId } = useProjectContext();
  const { filters } = useProjectFilters(projectId);
  const { data: timeline, isLoading, isError, refetch } = useTimeline(projectId);
  const panel = useTaskPanel();
  const canEdit = usePermission('tasks.edit');
  const canManage = usePermission('projects.manage');
  const [zoom, setZoomState] = useState<Zoom>(readZoom);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [addingMilestone, setAddingMilestone] = useState(false);
  const { drafts, setDraft, commit, nudge, upgradeElement } = useScheduleDrafts(projectId);
  const bodyRef = useRef<HTMLDivElement>(null);

  const setZoom = (z: string) => {
    setZoomState(z as Zoom);
    try {
      window.localStorage.setItem(ZOOM_KEY, z);
    } catch {
      /* per-viewer convenience only */
    }
  };

  const rows = useMemo<TimelineRowDto[]>(() => {
    if (!timeline) return [];
    const out: TimelineRowDto[] = [];
    let hidden = false;
    for (const r of timeline.rows) {
      if (r.kind === 'section') {
        hidden = collapsed.has(r.id);
        out.push(r);
        continue;
      }
      if (hidden) continue;
      if (r.kind === 'task' && !matchesProjectFilters({ status: r.status, priority: 'NONE', assigneeId: r.assignee?.id ?? null }, { ...filters, priorities: [] })) continue;
      out.push(r);
    }
    return out;
  }, [timeline, collapsed, filters]);

  const scale = useMemo(() => {
    if (!timeline) return null;
    const range = chartRange(timeline, zoom);
    return makeScale(range.from, range.to, zoom);
  }, [timeline, zoom]);

  const scrollToToday = () => {
    if (!timeline || !scale) return;
    const el = bodyRef.current?.querySelector<HTMLElement>('[data-testid="timeline-chart"]');
    el?.scrollTo?.({ left: Math.max(0, scale.x(timeline.today) - 120), behavior: 'smooth' });
  };

  return (
    <>
      <ProjectFilterBar projectId={projectId} members={project.members}>
        <SegmentedControl options={ZOOM_OPTIONS} value={zoom} onChange={setZoom} label="Zoom" />
        <Button variant="secondary" size="sm" onClick={scrollToToday}>
          Today
        </Button>
        <span className={styles.legend} aria-label="Legend">
          <span className={styles.legendItem}>
            <span className={styles.legendCritical} />
            Critical path
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendTask} />
            Task
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendBaseline} />
            Baseline
          </span>
          <span className={styles.legendItem}>
            <span className={styles.diamondSm} />
            Milestone
          </span>
        </span>
        {canManage ? (
          <Button variant="secondary" size="sm" icon="plus" onClick={() => setAddingMilestone(true)}>
            Add milestone
          </Button>
        ) : null}
      </ProjectFilterBar>

      {isLoading ? (
        <Skeleton height={420} radius={10} />
      ) : isError || !timeline || !scale ? (
        <EmptyState
          icon="alert"
          title="We couldn’t load the timeline"
          description="Check your connection and try again."
          primaryAction={
            <Button variant="secondary" icon="undo" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState icon="timeline" title="Nothing scheduled yet" description="Give tasks a start and due date and they appear here, with their dependencies." />
      ) : (
        <div ref={bodyRef} className={styles.gantt} aria-label={`${project.name} timeline`} role="group">
          <TimelineTaskList
            rows={rows}
            collapsed={collapsed}
            onToggleSection={(id) => setCollapsed((c) => (c.has(id) ? new Set([...c].filter((x) => x !== id)) : new Set([...c, id])))}
            onOpen={(key) => panel.open(key)}
          />
          <TimelineChart
            timeline={timeline}
            rows={rows}
            scale={scale}
            zoom={zoom}
            drafts={drafts}
            canEdit={canEdit}
            onDraft={(r, d) => setDraft(r.id, d)}
            onCommit={(r, d) => void commit(r, d)}
            onNudge={nudge}
            onOpen={(r) => panel.open(r.key)}
          />
        </div>
      )}
      <AddMilestoneDialog projectId={projectId} open={addingMilestone} onClose={() => setAddingMilestone(false)} />
      {upgradeElement}
    </>
  );
}
