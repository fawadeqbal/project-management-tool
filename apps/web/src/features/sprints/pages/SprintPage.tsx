import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AvatarGroup, Badge, Button, EmptyState, Select, Skeleton } from '@hearth/ui';
import type { RetrospectiveDto, SprintSummaryDto, SprintTaskDto } from '@hearth/contracts';
import type { Command } from '@/shared/commands/command';
import { useRegisterCommands } from '@/shared/commands';
import { useRealtimeEvent } from '@/shared/realtime';
import { useQueryClient } from '@tanstack/react-query';
import { sprintKeys, useBacklog, useSprintDetail, useSprintMutations, useSprints } from '../api';
import { BacklogList } from '../components/BacklogList';
import { BurndownChart } from '../components/BurndownChart';
import { CapacityPanel } from '../components/CapacityPanel';
import { CompleteSprintDialog } from '../components/CompleteSprintDialog';
import { EditSprintDialog } from '../components/EditSprintDialog';
import { RetrospectivePanel } from '../components/RetrospectivePanel';
import { SprintTaskList } from '../components/SprintTaskList';
import { PlanGateDialog, UpgradeBanner } from '../plan-gate';
import styles from '../sprints.module.css';

/** Active sprint first, then the next planned one, then the latest. */
export const defaultSprint = (sprints: readonly SprintSummaryDto[]): SprintSummaryDto | undefined =>
  sprints.find((s) => s.status === 'ACTIVE') ??
  sprints.find((s) => s.status === 'PLANNED') ??
  sprints[sprints.length - 1];

const STATUS_TONE = { ACTIVE: 'info', PLANNED: 'neutral', COMPLETED: 'success' } as const;

export function SprintPage() {
  const { projectId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const client = useQueryClient();
  const sprints = useSprints(projectId);
  const list = useMemo(() => sprints.data ?? [], [sprints.data]);
  const selected = list.find((s) => s.id === params.get('sprint')) ?? defaultSprint(list);
  const detail = useSprintDetail(selected?.id);
  const backlog = useBacklog(projectId);
  const mutations = useSprintMutations(projectId);
  const [completing, setCompleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [retro, setRetro] = useState<RetrospectiveDto | null>(null);
  const focusedBacklog = useRef<SprintTaskDto | null>(null);

  useRealtimeEvent('sprint.', () => void client.invalidateQueries({ queryKey: sprintKeys.all }));
  useRealtimeEvent('task.', () => void client.invalidateQueries({ queryKey: sprintKeys.all }));

  const d = detail.data;
  const sprint = d?.sprint;
  const nextPlanned = list.find((s) => s.status === 'PLANNED' && sprint && s.number > sprint.number) ?? null;
  // "Add to sprint" targets the open sprint on screen.
  const target = sprint && sprint.status !== 'COMPLETED' ? sprint : null;

  const selectSprint = (id: string) =>
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.set('sprint', id);
      return next;
    });

  const addToSprint = useCallback(
    (task: SprintTaskDto) => {
      if (target) mutations.addToSprint(target.id, target.name, task);
    },
    [mutations, target],
  );

  const complete = async (moveTo: 'backlog' | 'next') => {
    if (!sprint) return;
    const result = await mutations.complete(sprint.id, moveTo);
    setCompleting(false);
    if (result) setRetro(result);
  };

  const commands = useMemo<Command[]>(() => {
    const out: Command[] = [];
    if (sprint?.status === 'PLANNED')
      out.push({
        id: 'sprints.start',
        title: `Start ${sprint.name}`,
        group: 'Actions',
        icon: 'zap',
        keywords: ['sprint', 'begin'],
        run: () => void mutations.start(sprint.id),
      });
    if (sprint?.status === 'ACTIVE')
      out.push({
        id: 'sprints.complete',
        title: `Complete ${sprint.name}`,
        group: 'Actions',
        icon: 'check',
        keywords: ['sprint', 'finish', 'retro'],
        run: () => setCompleting(true),
      });
    if (target)
      out.push({
        id: 'sprints.add-to-sprint',
        title: `Add to ${target.name}`,
        group: 'Tasks',
        icon: 'plus',
        shortcut: ['Shift+S'],
        keywords: ['sprint', 'plan', 'backlog'],
        isAvailable: () => !!focusedBacklog.current,
        run: () => {
          if (focusedBacklog.current) addToSprint(focusedBacklog.current);
        },
      });
    out.push({
      id: 'sprints.plan',
      title: 'Plan next sprint',
      group: 'Actions',
      icon: 'calendar',
      keywords: ['sprint', 'new'],
      run: () => void mutations.plan(),
    });
    return out;
  }, [sprint, target, mutations, addToSprint]);
  useRegisterCommands(commands);

  if (sprints.isLoading || (selected && detail.isLoading)) {
    return (
      <main className={styles.page} aria-busy="true" aria-label="Loading sprint">
        <Skeleton height={30} width="40%" />
        <Skeleton height={220} />
      </main>
    );
  }

  if (!selected || !d || !sprint) {
    return (
      <main className={styles.page}>
        <PlanGateDialog />
        <UpgradeBanner feature="sprints">
          Planning sprints is part of Business. You can still look around.
        </UpgradeBanner>
        <EmptyState
          icon="zap"
          title="No sprints yet"
          description="Plan a two-week sprint, pull work in from the backlog and watch the burndown."
          primaryAction={<Button onClick={() => void mutations.plan()}>Plan first sprint</Button>}
        />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <PlanGateDialog />
      <header className={styles.header}>
        <div className={styles.heading}>
          <div className={styles.titleRow}>
            <h1 className={styles.h1}>{sprint.name}</h1>
            <Badge tone={STATUS_TONE[sprint.status]}>{d.header.statusLabel}</Badge>
          </div>
          <p className={styles.goal}>
            {sprint.goal ? (
              <>
                <strong>Goal:</strong> {sprint.goal} ·{' '}
              </>
            ) : (
              <>
                <button type="button" className={styles.linkButton} onClick={() => setEditing(true)}>
                  Add a sprint goal
                </button>{' '}
                ·{' '}
              </>
            )}
            {d.header.dateLabel}
          </p>
        </div>
        <Select
          label="Sprint"
          hideLabel
          value={sprint.id}
          onChange={(e) => selectSprint(e.target.value)}
          options={[...list]
            .reverse()
            .map((s) => ({
              value: s.id,
              label: `${s.name} · ${s.status === 'ACTIVE' ? 'Active' : s.status === 'PLANNED' ? 'Planned' : 'Completed'}`,
            }))}
          className={styles.switcher}
        />
        {d.header.people.length ? (
          <AvatarGroup
            people={d.header.people.map((p) => ({
              initials: p.initials,
              name: p.name,
              color: p.avatarColor,
            }))}
            size={28}
          />
        ) : null}
        {sprint.status !== 'COMPLETED' ? (
          <Button variant="ghost" icon="pencil" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : null}
        <Link to={`/projects/${projectId}/board`} className={styles.secondaryLink}>
          <Button variant="secondary" icon="board" tabIndex={-1}>
            Sprint board
          </Button>
        </Link>
        {sprint.status === 'PLANNED' ? (
          <Button icon="zap" loading={mutations.isStarting} onClick={() => void mutations.start(sprint.id)}>
            Start sprint
          </Button>
        ) : null}
        {sprint.status === 'ACTIVE' ? (
          <Button onClick={() => setCompleting(true)}>Complete sprint</Button>
        ) : null}
        {sprint.status === 'COMPLETED' && !nextPlanned ? (
          <Button variant="secondary" icon="plus" onClick={() => void mutations.plan()}>
            Plan next sprint
          </Button>
        ) : null}
      </header>

      <UpgradeBanner feature="sprints">
        Sprint planning is part of Business — you can keep viewing the burndown and backlog.
      </UpgradeBanner>
      {retro ? <RetrospectivePanel retro={retro} onDismiss={() => setRetro(null)} /> : null}

      <div className={styles.columns}>
        <div className={styles.main}>
          <SprintTaskList
            detail={d}
            onMoveToBacklog={target ? (t) => mutations.moveToBacklog(target.id, target.name, t) : undefined}
          />
          <BacklogList
            tasks={backlog.data ?? []}
            targetName={target?.name ?? null}
            onRank={(input) => void mutations.rank(input)}
            onAddToSprint={addToSprint}
            onFocusTask={(t) => {
              focusedBacklog.current = t;
            }}
          />
        </div>
        <aside className={styles.aside}>
          <BurndownChart burndown={d.burndown} />
          <CapacityPanel capacity={d.capacity} velocity={d.velocity} />
        </aside>
      </div>

      {completing ? (
        <CompleteSprintDialog
          open
          detail={d}
          nextSprintName={nextPlanned?.name ?? null}
          busy={mutations.isCompleting}
          onClose={() => setCompleting(false)}
          onConfirm={(m) => void complete(m)}
        />
      ) : null}
      {editing ? (
        <EditSprintDialog
          sprint={sprint}
          onClose={() => setEditing(false)}
          onSave={(input) => void mutations.update(sprint.id, input)}
        />
      ) : null}
    </main>
  );
}
