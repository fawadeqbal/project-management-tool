import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { Button, Icon, Textarea } from '@hearth/ui';
import {
  AI_ROUTES,
  type AcceptSuggestionInput,
  type AcceptSuggestionResultDto,
  type AiSuggestionDto,
  type TaskDetailDto,
} from '@hearth/contracts';
import { http } from '@/shared/api/http';
import { queryKeys } from '@/shared/api/query-keys';
import { useAuthStore } from '@/shared/auth/auth-store';
import { usePermission } from '@/shared/auth/use-permission';
import { useRegisterCommands } from '@/shared/commands';
import type { Command } from '@/shared/commands/command';
import { useOptimisticMutation } from '@/shared/hooks/useOptimisticMutation';
import { patchTaskDetail } from '@/shared/tasks/task-cache';
import { useToast } from '@/shared/toast';

/** AI context API (used by the summary card and the Break down slot). Output is always a suggestion. */
export const aiApi = {
  suggestions: (taskId: string) => http.get<AiSuggestionDto[]>(AI_ROUTES.suggestions(taskId)),
  summarize: (taskId: string) => http.post<AiSuggestionDto>(AI_ROUTES.summary(taskId)),
  breakDown: (taskId: string) => http.post<AiSuggestionDto>(AI_ROUTES.breakdown(taskId)),
  accept: (id: string, edited?: AcceptSuggestionInput['edited']) =>
    http.post<AcceptSuggestionResultDto>(AI_ROUTES.accept(id), edited ? { edited } : {}),
  discard: (id: string) => http.post<AiSuggestionDto>(AI_ROUTES.discard(id)),
};

export const aiKeys = { suggestions: (taskId: string) => ['ai', 'suggestions', taskId] as const };

export function usePendingSuggestions(taskId: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: aiKeys.suggestions(taskId),
    queryFn: () => aiApi.suggestions(taskId),
    enabled: !!token && !taskId.startsWith('optimistic-'),
    staleTime: 60_000,
  });
}

/** Removes a suggestion from the pending cache (accept/discard are optimistic). */
export const dropSuggestion = (client: QueryClient, taskId: string, id: string) =>
  client.setQueryData<AiSuggestionDto[]>(aiKeys.suggestions(taskId), (list) =>
    list?.filter((s) => s.id !== id),
  );

const SUMMARY_PREFIX = 'Summary: ';

const card: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  padding: '12px 14px',
  borderRadius: 10,
  background: 'var(--brand-subtle)',
  border: '1px dashed var(--border-focus)',
};
const head: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, flexWrap: 'wrap' };
const text: CSSProperties = { margin: 0, fontSize: 13, lineHeight: '19px' };
const row: CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap' };

export interface AiSummarySlotProps {
  task: TaskDetailDto;
}

/**
 * "AI summary" (TaskPanel.dc.html): labelled, names its source, and only reaches the task when
 * someone clicks Add to description (optionally after Edit). Discard drops it. With no pending
 * summary, a quiet "Summarize with AI" button generates one.
 */
export function AiSummarySlot({ task }: AiSummarySlotProps) {
  const { show } = useToast();
  const canEdit = usePermission('tasks.edit');
  const { data: pending = [] } = usePendingSuggestions(task.id);
  const summary = pending.find((s) => s.kind === 'summary') ?? null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setEditing(false);
    setDraft(summary?.summary?.text ?? '');
  }, [summary?.id, summary?.summary?.text]);

  const generate = useOptimisticMutation<AiSuggestionDto, { taskId: string }>({
    mutationFn: ({ taskId }) => aiApi.summarize(taskId),
    affects: ({ taskId }) => [aiKeys.suggestions(taskId)],
    onSuccess: (s, { taskId }, c) =>
      c.setQueryData<AiSuggestionDto[]>(aiKeys.suggestions(taskId), (list = []) => [
        s,
        ...list.filter((x) => x.kind !== 'summary'),
      ]),
    errorMessage: (e) =>
      e.kind === 'limit_reached' ? e.message : `We couldn’t summarize this task. ${e.message}`,
  });

  const accept = useOptimisticMutation<
    AcceptSuggestionResultDto,
    { taskId: string; suggestion: AiSuggestionDto; text?: string }
  >({
    mutationFn: ({ suggestion, text: edited }) =>
      aiApi.accept(suggestion.id, edited !== undefined ? { text: edited } : undefined),
    affects: ({ taskId }) => [aiKeys.suggestions(taskId), queryKeys.taskRoot],
    apply: (c, { taskId, suggestion, text: edited }) => {
      dropSuggestion(c, taskId, suggestion.id);
      const block = `${SUMMARY_PREFIX}${(edited ?? suggestion.summary?.text ?? '').trim()}`;
      patchTaskDetail(c, taskId, (d) => ({
        ...d,
        description: d.description?.trim() ? `${d.description.trimEnd()}\n\n${block}` : block,
      }));
    },
    onSuccess: (res, { taskId }, c) => {
      if (res.description !== undefined)
        patchTaskDetail(c, taskId, (d) => ({ ...d, description: res.description ?? d.description }));
    },
    errorMessage: (e) => `The summary wasn’t added. ${e.message}`,
  });

  const discard = useOptimisticMutation<AiSuggestionDto, { taskId: string; id: string }>({
    mutationFn: ({ id }) => aiApi.discard(id),
    affects: ({ taskId }) => [aiKeys.suggestions(taskId)],
    apply: (c, { taskId, id }) => dropSuggestion(c, taskId, id),
    errorMessage: (e) => `We couldn’t discard the summary. ${e.message}`,
  });

  const run = () => generate.mutate({ taskId: task.id });
  const add = () => {
    if (!summary) return;
    const edited = editing && draft.trim() !== summary.summary?.text ? draft.trim() : undefined;
    if (editing && !draft.trim()) return;
    accept.mutate(
      { taskId: task.id, suggestion: summary, text: edited },
      { onSuccess: () => show({ message: 'Summary added to the description', icon: 'sparkles' }) },
    );
  };

  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'ai.summarize-task',
        title: 'Summarize task with AI',
        group: 'AI',
        icon: 'sparkles',
        keywords: ['ai', 'summary', 'tldr', 'catch up'],
        run: () => generate.mutate({ taskId: task.id }),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registered while this task's detail is open
    [task.id],
  );
  useRegisterCommands(commands);

  if (!summary) {
    return (
      <div>
        <Button variant="ghost" size="sm" icon="sparkles" loading={generate.isPending} onClick={run}>
          {generate.isPending ? 'Summarizing…' : 'Summarize with AI'}
        </Button>
      </div>
    );
  }

  return (
    <section aria-label="AI summary" style={card}>
      <div style={head}>
        <Icon name="sparkles" style={{ color: 'var(--brand-primary)' }} />
        <strong style={{ fontWeight: 600, color: 'var(--text-link)' }}>AI summary</strong>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>· {summary.source}</span>
      </div>
      {editing ? (
        <Textarea
          label="Edit the summary"
          hideLabel
          rows={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          maxLength={5000}
        />
      ) : (
        <p style={text}>{summary.summary?.text}</p>
      )}
      <div style={row}>
        {canEdit ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={add}
            disabled={accept.isPending || (editing && !draft.trim())}
          >
            Add to description
          </Button>
        ) : null}
        {canEdit && !editing ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : null}
        {editing ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(false);
              setDraft(summary.summary?.text ?? '');
            }}
          >
            Cancel edit
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => discard.mutate({ taskId: task.id, id: summary.id })}>
          Discard
        </Button>
      </div>
    </section>
  );
}
