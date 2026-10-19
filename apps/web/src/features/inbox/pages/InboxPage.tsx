import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Skeleton, ViewTabs } from '@hearth/ui';
import type { InboxItemDto, InboxTabDto, SnoozePresetDto } from '@hearth/contracts';
import { useRegisterCommands } from '@/shared/commands';
import type { Command } from '@/shared/commands/command';
import { useHotkey } from '@/shared/hotkeys/use-hotkey';
import { useIsPhone } from '@/shared/hooks/useMediaQuery';
import { useRealtimeEvent } from '@/shared/realtime';
import { useTaskPanel } from '@/shared/tasks';
import { useToast } from '@/shared/toast';
import { useInbox, useInboxTriage } from '../api';
import { isApproval, isInboxTab, TAB_ORDER, tabLabel } from '../inbox-meta';
import { SNOOZE_OPTIONS } from '../components/SnoozeMenu';
import { InboxListItem } from '../components/InboxListItem';
import { InboxDetail } from '../components/InboxDetail';
import { InboxEmpty } from '../components/InboxEmpty';
import { InboxKeyHints } from '../components/InboxKeyHints';
import { BulkBar } from '../components/BulkBar';
import { NotificationSettings } from '../components/NotificationSettings';
import { InboxTriage, TRIAGE_PARAM } from '../components/InboxTriage';
import styles from '../inbox.module.css';

/** Selecting an item marks it read after this long (so a quick J/K pass doesn't clear everything). */
export const MARK_READ_DELAY_MS = 1000;

const SNOOZE_LABEL: Record<SnoozePresetDto, string> = {
  later_today: 'later today',
  tomorrow: 'tomorrow',
  next_week: 'next week',
};

/**
 * Inbox per Inbox.dc.html: list on the left, the selected item on the right, keyboard triage.
 * On phones `?triage=1` (the push-notification deep link, or the "Triage" button) shows one item
 * at a time instead (MobileInbox.dc.html).
 */
export function InboxPage() {
  const phone = useIsPhone();
  const [params] = useSearchParams();
  if (phone && params.get(TRIAGE_PARAM) === '1') return <InboxTriage />;
  return <InboxWorkspace phone={phone} />;
}

function InboxWorkspace({ phone }: { phone: boolean }) {
  const [params, setParams] = useSearchParams();
  const tab: InboxTabDto = isInboxTab(params.get('tab')) ? (params.get('tab') as InboxTabDto) : 'all';
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, isLoading, refetch } = useInbox(tab, unreadOnly);
  const items = useMemo(() => data?.items ?? [], [data]);
  const triage = useInboxTriage();
  const { show } = useToast();
  const panel = useTaskPanel();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(false);

  // Keep a valid selection: first item by default, the neighbour after one leaves the list.
  const lastIndex = useRef(0);
  const selectedIndex = items.findIndex((i) => i.id === selectedId);
  if (selectedIndex >= 0) lastIndex.current = selectedIndex;
  const selected: InboxItemDto | null =
    selectedIndex >= 0
      ? items[selectedIndex]!
      : (items[Math.min(lastIndex.current, items.length - 1)] ?? null);
  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  // Opening an item marks it read after a moment — but not again after U marked it unread.
  const autoReadFor = useRef<string | null>(null);
  useEffect(() => {
    if (!selected || !selected.unread || autoReadFor.current === selected.id) return;
    const id = selected.id;
    const timer = window.setTimeout(() => {
      autoReadFor.current = id;
      void triage.mutate({ action: 'read', ids: [id] });
    }, MARK_READ_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-arm only when the selection changes
  }, [selected?.id, selected?.unread]);

  useEffect(() => {
    document.getElementById(`inbox-item-${selected?.id}`)?.scrollIntoView({ block: 'nearest' });
  }, [selected?.id]);

  // Live: a new notification refreshes the list (counts refresh globally).
  useRealtimeEvent('notification.created', () => void refetch());

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setMobileDetail(true);
  }, []);
  const move = (delta: number) => {
    if (!items.length) return;
    const from = selectedIndex >= 0 ? selectedIndex : 0;
    const next = items[Math.max(0, Math.min(items.length - 1, from + delta))];
    if (next) setSelectedId(next.id);
  };

  const setTab = (next: string) => {
    setChecked(new Set());
    setSelectedId(null);
    lastIndex.current = 0;
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (next === 'all') n.delete('tab');
        else n.set('tab', next);
        return n;
      },
      { replace: true },
    );
  };

  const targets = (): InboxItemDto[] =>
    checked.size ? items.filter((i) => checked.has(i.id)) : selected ? [selected] : [];

  const archive = (list = targets()) => {
    if (!list.length) return;
    const ids = list.map((i) => i.id);
    setChecked(new Set());
    void triage.mutate({ action: 'archive', ids });
    show({
      message: list.length === 1 ? 'Archived' : `Archived ${list.length} items`,
      icon: 'archive',
      action: 'Undo',
      onAction: () => void triage.mutate({ action: 'unarchive', ids, restore: list }),
    });
  };

  const snooze = (preset: SnoozePresetDto, list = targets()) => {
    if (!list.length) return;
    const ids = list.map((i) => i.id);
    setChecked(new Set());
    setSnoozeOpen(false);
    void triage.mutate({ action: 'snooze', ids, preset });
    show({
      message: `Snoozed until ${SNOOZE_LABEL[preset]}`,
      icon: 'clock',
      action: 'Undo',
      onAction: () => void triage.mutate({ action: 'unsnooze', ids, restore: list }),
    });
  };

  const toggleUnread = () => {
    const list = targets();
    if (!list.length) return;
    const makeUnread = list.some((i) => !i.unread);
    // Don't let the auto-read timer undo an explicit "mark unread" on the open item.
    if (makeUnread && selected) autoReadFor.current = selected.id;
    void triage.mutate({ action: makeUnread ? 'unread' : 'read', ids: list.map((i) => i.id) });
  };

  const markRead = () => {
    const list = targets().filter((i) => i.unread);
    setChecked(new Set());
    if (list.length) void triage.mutate({ action: 'read', ids: list.map((i) => i.id) });
  };

  const toggleChecked = useCallback((id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openTask = (item = selected) => {
    if (item?.taskKey) panel.open(item.taskKey);
  };

  // J/K move, Enter opens, X selects. E/H/U/Shift+A are commands (palette + shortcut).
  useHotkey('J', () => move(1));
  useHotkey('K', () => move(-1));
  useHotkey('Enter', (e) => {
    // Buttons, links and tabs keep their own Enter.
    if (e.target instanceof Element && e.target.closest('button, a, [role="tab"], textarea, input'))
      return false;
    if (!selected?.taskKey) return false;
    openTask();
  });
  useHotkey('X', () => (selected ? toggleChecked(selected.id) : false));
  useHotkey('Escape', () => (checked.size ? setChecked(new Set()) : false));

  const commands = useMemo<Command[]>(
    () =>
      selected
        ? [
            {
              id: 'inbox.archive',
              title: 'Archive',
              group: 'Actions',
              icon: 'archive',
              shortcut: ['E'],
              keywords: ['inbox', 'done', 'dismiss'],
              run: () => archive(),
            },
            {
              id: 'inbox.snooze',
              title: 'Snooze…',
              group: 'Actions',
              icon: 'clock',
              shortcut: ['H'],
              keywords: ['inbox', 'later', 'remind'],
              run: () => setSnoozeOpen(true),
            },
            ...SNOOZE_OPTIONS.map<Command>((o) => ({
              id: `inbox.snooze.${o.id}`,
              title: `Snooze until ${o.label.toLowerCase()}`,
              group: 'Actions',
              icon: 'clock',
              keywords: ['inbox'],
              run: () => snooze(o.id),
            })),
            {
              id: 'inbox.toggle-unread',
              title: selected.unread ? 'Mark read' : 'Mark unread',
              group: 'Actions',
              icon: 'inbox',
              shortcut: ['U'],
              keywords: ['inbox', 'unread', 'read'],
              run: () => toggleUnread(),
            },
          ]
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers read current state
    [selected, checked, items],
  );
  useRegisterCommands(commands);

  const handlers = {
    onSnooze: (preset: SnoozePresetDto) => snooze(preset, selected ? [selected] : []),
    onArchive: () => archive(selected ? [selected] : []),
    onOpenTask: selected?.taskKey ? () => openTask() : undefined,
    snoozeOpen,
    onSnoozeOpenChange: setSnoozeOpen,
    onBack: () => setMobileDetail(false),
  };

  const tabs = TAB_ORDER.map((t) => ({ id: t, label: tabLabel(t, data?.counts), controls: 'inbox-list' }));

  return (
    <div className={styles.page} data-mobile-view={mobileDetail ? 'detail' : 'list'}>
      <section aria-label="Notifications" className={styles.listPane}>
        <div className={styles.listHead}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Inbox</h1>
            <Button
              variant={unreadOnly ? 'secondary' : 'ghost'}
              size="sm"
              icon="filter"
              aria-pressed={unreadOnly}
              onClick={() => setUnreadOnly((u) => !u)}
            >
              Unread
            </Button>
            <NotificationSettings />
            {phone && items.length ? (
              <Button
                variant="secondary"
                size="sm"
                icon="layers"
                onClick={() =>
                  setParams((p) => {
                    const n = new URLSearchParams(p);
                    n.set(TRIAGE_PARAM, '1');
                    return n;
                  })
                }
              >
                Triage
              </Button>
            ) : null}
          </div>
          <ViewTabs tabs={tabs} value={tab} onChange={setTab} label="Inbox filters" />
        </div>
        {checked.size ? (
          <BulkBar
            count={checked.size}
            onArchive={() => archive()}
            onMarkRead={markRead}
            onClear={() => setChecked(new Set())}
          />
        ) : null}
        <div
          id="inbox-list"
          role="listbox"
          aria-label="Inbox items"
          aria-multiselectable={checked.size > 0 || undefined}
          aria-activedescendant={selected ? `inbox-item-${selected.id}` : undefined}
          tabIndex={0}
          className={styles.list}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              move(e.key === 'ArrowDown' ? 1 : -1);
            }
          }}
        >
          {isLoading && !data ? (
            Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={styles.itemSkeleton}>
                <Skeleton width={32} height={32} radius={9999} />
                <div className={styles.grow}>
                  <Skeleton width="60%" height={14} />
                  <Skeleton width="40%" height={12} />
                </div>
              </div>
            ))
          ) : items.length === 0 ? (
            <InboxEmpty tab={tab} unreadOnly={unreadOnly} />
          ) : (
            items.map((item) => (
              <InboxListItem
                key={item.id}
                item={item}
                selected={item.id === selected?.id}
                checked={checked.has(item.id)}
                selectionMode={checked.size > 0}
                onSelect={select}
                onToggleChecked={toggleChecked}
              />
            ))
          )}
        </div>
        <InboxKeyHints />
      </section>
      <section
        aria-label={selected && isApproval(selected) ? 'Approval request' : 'Selected item'}
        className={styles.detailPane}
      >
        <InboxDetail item={selected} {...handlers} />
      </section>
    </div>
  );
}
