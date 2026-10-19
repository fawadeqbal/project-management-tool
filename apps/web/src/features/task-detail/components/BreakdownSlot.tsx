import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Button, Icon, Popover, TaskCheckbox } from '@hearth/ui';
import type { AcceptSuggestionResultDto, AiSuggestionDto, TaskDetailDto } from '@hearth/contracts';
import { queryKeys } from '@/shared/api/query-keys';
import { useRegisterCommands } from '@/shared/commands';
import type { Command } from '@/shared/commands/command';
import { useOptimisticMutation } from '@/shared/hooks/useOptimisticMutation';
import { useToast } from '@/shared/toast';
import { aiApi, aiKeys, dropSuggestion, usePendingSuggestions } from './AiSummarySlot';

export interface BreakdownSlotProps {
  task: TaskDetailDto;
  /** Adds a subtask by hand (kept for callers; AI subtasks are created server-side in one go). */
  onAddSubtask: (title: string) => void;
}

const card: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  padding: '12px 14px',
  width: 'min(380px, calc(100vw - 32px))',
  background: 'var(--brand-subtle)',
  border: '1px dashed var(--border-focus)',
  borderRadius: 10,
};
const list: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};
const item: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 14,
  padding: '3px 0',
};

/**
 * "Break down" next to Subtasks: asks the AI for 3–6 subtasks, shows them labelled with their
 * source and checkboxes, and creates only the chosen ones on "Add N subtasks". Discard drops it.
 */
export function BreakdownSlot({ task }: BreakdownSlotProps) {
  const { show } = useToast();
  const { data: pending = [] } = usePendingSuggestions(task.id);
  const suggestion = pending.find((s) => s.kind === 'breakdown') ?? null;
  const proposed = useMemo(() => suggestion?.breakdown?.subtasks ?? [], [suggestion]);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);

  useEffect(() => setChosen(new Set(proposed.map((_, i) => i))), [proposed]);

  const generate = useOptimisticMutation<AiSuggestionDto, { taskId: string }>({
    mutationFn: ({ taskId }) => aiApi.breakDown(taskId),
    affects: ({ taskId }) => [aiKeys.suggestions(taskId)],
    onSuccess: (s, { taskId }, c) => {
      c.setQueryData<AiSuggestionDto[]>(aiKeys.suggestions(taskId), (l = []) => [
        s,
        ...l.filter((x) => x.kind !== 'breakdown'),
      ]);
      setOpen(true);
    },
    errorMessage: (e) =>
      e.kind === 'limit_reached' ? e.message : `We couldn’t break this task down. ${e.message}`,
  });

  const accept = useOptimisticMutation<
    AcceptSuggestionResultDto,
    { taskId: string; id: string; titles: string[] }
  >({
    mutationFn: ({ id, titles }) => aiApi.accept(id, { subtasks: titles }),
    affects: ({ taskId }) => [aiKeys.suggestions(taskId), queryKeys.taskRoot, queryKeys.tasks.all],
    apply: (c, { taskId, id }) => dropSuggestion(c, taskId, id),
    errorMessage: (e) => `The subtasks weren’t added. ${e.message}`,
  });

  const discard = useOptimisticMutation<AiSuggestionDto, { taskId: string; id: string }>({
    mutationFn: ({ id }) => aiApi.discard(id),
    affects: ({ taskId }) => [aiKeys.suggestions(taskId)],
    apply: (c, { taskId, id }) => dropSuggestion(c, taskId, id),
  });

  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'ai.break-down-task',
        title: 'Break down task',
        group: 'AI',
        icon: 'sparkles',
        keywords: ['ai', 'subtasks', 'split', 'plan'],
        run: () => (suggestion ? setOpen(true) : generate.mutate({ taskId: task.id })),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registered while this task's detail is open
    [task.id, suggestion],
  );
  useRegisterCommands(commands);

  const titles = proposed.filter((_, i) => chosen.has(i));
  const add = () => {
    if (!suggestion || !titles.length) return;
    accept.mutate(
      { taskId: task.id, id: suggestion.id, titles },
      {
        onSuccess: (res) =>
          show({
            message: `Added ${res.createdSubtasks?.length ?? titles.length} subtasks`,
            icon: 'sparkles',
          }),
      },
    );
    setOpen(false);
  };
  const toggle = (i: number) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <Popover
      open={open && !!suggestion}
      onOpenChange={setOpen}
      align="end"
      renderTrigger={(p) => (
        <Button
          {...p}
          aria-haspopup={suggestion ? 'dialog' : undefined}
          variant="ghost"
          size="sm"
          icon="sparkles"
          loading={generate.isPending}
          onClick={() => (suggestion ? setOpen(!open) : generate.mutate({ taskId: task.id }))}
        >
          {generate.isPending
            ? 'Breaking down…'
            : suggestion
              ? `Review ${proposed.length} suggested`
              : 'Break down'}
        </Button>
      )}
    >
      {suggestion ? (
        <section aria-label="Suggested subtasks" style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, flexWrap: 'wrap' }}>
            <Icon name="sparkles" style={{ color: 'var(--brand-primary)' }} />
            <strong style={{ fontWeight: 600, color: 'var(--text-link)' }}>Suggested subtasks</strong>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>· {suggestion.source}</span>
          </div>
          <ul style={list}>
            {proposed.map((title, i) => (
              <li key={`${i}-${title}`} style={item}>
                <TaskCheckbox
                  checked={chosen.has(i)}
                  label={`Include “${title}”`}
                  onChange={() => toggle(i)}
                />
                <span style={{ color: chosen.has(i) ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                  {title}
                </span>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Button variant="secondary" size="sm" onClick={add} disabled={!titles.length || accept.isPending}>
              {titles.length
                ? `Add ${titles.length} subtask${titles.length === 1 ? '' : 's'}`
                : 'Pick subtasks to add'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                discard.mutate({ taskId: task.id, id: suggestion.id });
              }}
            >
              Discard
            </Button>
          </div>
        </section>
      ) : null}
    </Popover>
  );
}
