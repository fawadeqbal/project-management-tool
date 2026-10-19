import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  INBOX_ROUTES,
  type ApprovalDecisionValue,
  type ApprovalDetailDto,
  type InboxBulkAction,
  type InboxCountsDto,
  type InboxDto,
  type InboxItemDto,
  type InboxTabDto,
  type InboxTriageResultDto,
  type SnoozePresetDto,
} from '@hearth/contracts';
import { INBOX_TABS, type NotificationType } from '@hearth/domain';
import { http } from '@/shared/api/http';
import { queryKeys } from '@/shared/api/query-keys';
import { useOptimisticMutation } from '@/shared/hooks/useOptimisticMutation';

export const inboxApi = {
  list: (tab: InboxTabDto, unread: boolean) =>
    http.get<InboxDto>(INBOX_ROUTES.list, { tab, unread: unread || undefined }),
  read: (id: string) => http.post<InboxTriageResultDto>(INBOX_ROUTES.read(id)),
  unread: (id: string) => http.post<InboxTriageResultDto>(INBOX_ROUTES.unread(id)),
  archive: (id: string) => http.post<InboxTriageResultDto>(INBOX_ROUTES.archive(id)),
  unarchive: (id: string) => http.post<InboxTriageResultDto>(INBOX_ROUTES.unarchive(id)),
  snooze: (id: string, preset: SnoozePresetDto) =>
    http.post<InboxTriageResultDto>(INBOX_ROUTES.snooze(id), { preset }),
  unsnooze: (id: string) => http.post<InboxTriageResultDto>(INBOX_ROUTES.unsnooze(id)),
  bulk: (ids: string[], action: InboxBulkAction) =>
    http.post<InboxTriageResultDto>(INBOX_ROUTES.bulk, { ids, action }),
  approval: (id: string) => http.get<ApprovalDetailDto>(INBOX_ROUTES.approval(id)),
  decide: (id: string, decision: ApprovalDecisionValue, note: string | null) =>
    http.post<ApprovalDetailDto>(INBOX_ROUTES.decide(id), { decision, note }),
};

export const inboxKeys = {
  all: queryKeys.inbox,
  lists: () => [...queryKeys.inbox, 'list'] as const,
  list: (tab: InboxTabDto, unread: boolean) => [...queryKeys.inbox, 'list', tab, unread] as const,
  approval: (id: string) => [...queryKeys.inbox, 'approval', id] as const,
};

export function useInbox(tab: InboxTabDto, unread: boolean) {
  return useQuery({
    queryKey: inboxKeys.list(tab, unread),
    queryFn: () => inboxApi.list(tab, unread),
    placeholderData: (prev) => prev,
  });
}

export function useApproval(id: string | null | undefined) {
  return useQuery({
    queryKey: inboxKeys.approval(id ?? ''),
    queryFn: () => inboxApi.approval(id!),
    enabled: !!id,
  });
}

// ── Optimistic cache helpers ────────────────────────────────

const tabsOf = (type: NotificationType): (keyof InboxCountsDto)[] =>
  (Object.entries(INBOX_TABS) as [keyof typeof INBOX_TABS, readonly NotificationType[] | null][])
    .filter(([, types]) => types && types.includes(type))
    .map(([tab]) => tab as keyof InboxCountsDto);

/** Adjusts tab counts for an item changing read state or leaving the list. */
const adjustCounts = (
  counts: InboxCountsDto,
  item: InboxItemDto,
  change: { unreadDelta: number; visibleDelta: number },
): InboxCountsDto => {
  const next = {
    ...counts,
    all: Math.max(0, counts.all + change.visibleDelta),
    unread: Math.max(0, counts.unread + change.unreadDelta),
  };
  for (const tab of tabsOf(item.type)) next[tab] = Math.max(0, next[tab] + change.unreadDelta);
  return next;
};

/** Applies `fn` to every item in every cached inbox list (remove by returning null). */
export const patchInboxItems = (
  client: QueryClient,
  ids: readonly string[],
  fn: (item: InboxItemDto) => InboxItemDto | null,
): void => {
  const set = new Set(ids);
  for (const [key, data] of client.getQueriesData<InboxDto>({ queryKey: inboxKeys.lists() })) {
    if (!data) continue;
    let counts = data.counts;
    const items: InboxItemDto[] = [];
    for (const item of data.items) {
      if (!set.has(item.id)) {
        items.push(item);
        continue;
      }
      const next = fn(item);
      const unreadDelta = (next ? Number(next.unread) : 0) - Number(item.unread);
      counts = adjustCounts(counts, item, { unreadDelta, visibleDelta: next ? 0 : -1 });
      // In the Unread filter an item marked read stays put until the next refresh, so it doesn't jump away.
      if (next) items.push(next);
    }
    client.setQueryData<InboxDto>(key, { items, counts });
  }
};

const affects = () => [inboxKeys.lists(), queryKeys.shell];

export type TriageVars =
  | {
      action: 'read' | 'unread' | 'archive' | 'unarchive' | 'unsnooze';
      ids: string[];
      restore?: InboxItemDto[];
    }
  | { action: 'snooze'; ids: string[]; preset: SnoozePresetDto };

const run = (v: TriageVars): Promise<InboxTriageResultDto> => {
  if (v.action === 'snooze')
    return v.ids.length === 1
      ? inboxApi.snooze(v.ids[0]!, v.preset)
      : Promise.all(v.ids.map((id) => inboxApi.snooze(id, v.preset))).then((r) => r[0]!);
  if (v.ids.length > 1) return inboxApi.bulk(v.ids, v.action);
  const id = v.ids[0]!;
  return inboxApi[v.action](id);
};

/** Puts archived/snoozed items back into the cached lists they came from (for Undo). */
const restoreItems = (client: QueryClient, items: InboxItemDto[]) => {
  for (const [key, data] of client.getQueriesData<InboxDto>({ queryKey: inboxKeys.lists() })) {
    if (!data) continue;
    const tab = key[3] as InboxTabDto;
    const types = INBOX_TABS[tab] as readonly string[] | null;
    const fits = items.filter(
      (i) => (!types || types.includes(i.type)) && !data.items.some((x) => x.id === i.id),
    );
    if (!fits.length) continue;
    let counts = data.counts;
    for (const i of fits)
      counts = adjustCounts(counts, i, { unreadDelta: Number(i.unread), visibleDelta: 1 });
    const merged = [...data.items, ...fits].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    client.setQueryData<InboxDto>(key, { items: merged, counts });
  }
};

/** Every inbox triage action, optimistic with rollback (snapshot → apply → request → invalidate). */
export function useInboxTriage() {
  const client = useQueryClient();
  const mutation = useOptimisticMutation<InboxTriageResultDto, TriageVars>({
    mutationKey: ['inbox', 'triage'],
    mutationFn: run,
    affects,
    apply: (c, v) => {
      switch (v.action) {
        case 'read':
          return patchInboxItems(c, v.ids, (i) => ({ ...i, unread: false }));
        case 'unread':
          return patchInboxItems(c, v.ids, (i) => ({ ...i, unread: true }));
        case 'archive':
        case 'snooze':
          return patchInboxItems(c, v.ids, () => null);
        case 'unarchive':
        case 'unsnooze':
          return v.restore ? restoreItems(c, v.restore) : undefined;
      }
    },
    errorMessage: (e, v) =>
      e.kind === 'network'
        ? e.message
        : `We couldn’t ${v.action === 'snooze' ? 'snooze' : v.action === 'archive' ? 'archive' : 'update'} that. ${e.message}`,
  });
  return {
    mutate: (v: TriageVars) => mutation.mutateAsync(v).catch(() => undefined),
    client,
    isPending: mutation.isPending,
  };
}

/** Approve / request changes, optimistic on the approval detail. */
export function useDecideApproval(meId: string | undefined) {
  return useOptimisticMutation<
    ApprovalDetailDto,
    { id: string; decision: ApprovalDecisionValue; note: string | null }
  >({
    mutationFn: ({ id, decision, note }) => inboxApi.decide(id, decision, note),
    affects: ({ id }) => [inboxKeys.approval(id)],
    apply: (c, { id, decision, note }) =>
      c.setQueryData<ApprovalDetailDto>(inboxKeys.approval(id), (d) => {
        if (!d) return d;
        const approvers = d.approvers.map((a) =>
          a.user.id === meId
            ? {
                ...a,
                decision,
                note,
                label: decision === 'APPROVED' ? 'Approved' : 'Changes requested',
                decidedAt: new Date().toISOString(),
              }
            : a,
        );
        const approvedCount = approvers.filter((a) => a.decision === 'APPROVED').length;
        const status = approvers.some((a) => a.decision === 'CHANGES_REQUESTED')
          ? 'CHANGES_REQUESTED'
          : approvedCount === approvers.length
            ? 'APPROVED'
            : 'PENDING';
        return {
          ...d,
          approvers,
          approvedCount,
          status,
          myDecision: decision,
          canDecide: status === 'PENDING' && d.canDecide,
          progressLabel: `${approvedCount} of ${d.approverCount} approval${d.approverCount === 1 ? '' : 's'}`,
          dueLabel:
            status === 'APPROVED'
              ? 'Approved'
              : status === 'CHANGES_REQUESTED'
                ? 'Changes requested'
                : d.dueLabel,
          dueTone: status === 'PENDING' ? d.dueTone : 'default',
        };
      }),
    onSuccess: (data, { id }, c) => c.setQueryData(inboxKeys.approval(id), data),
    errorMessage: (e) => `Your decision wasn’t saved. ${e.message}`,
  });
}
