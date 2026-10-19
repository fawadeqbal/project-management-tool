import type { ReactNode } from 'react';
import type { IconName } from '@hearth/ui';
import type { MemberDto, TaskDto } from '@hearth/contracts';
import type { Command } from '@/shared/commands/command';
import type { PaletteScope } from '@/shared/layout/ui-store';
import { dueHint } from '@/shared/tasks/dates';
import { asIcon, STATUS_ICON } from '@/shared/tasks/meta';
import { rank, type FuzzyMatch } from './fuzzy';
import type { NlInterpretation } from './natural-language';

export type PaletteGroupId = 'ai' | 'tasks' | 'actions' | 'navigate' | 'people' | 'projects' | 'settings';

export interface PaletteItem {
  id: string;
  group: PaletteGroupId;
  label: string;
  /** Prefix shown before the label in mono (task key). */
  prefix?: string;
  icon: IconName;
  iconColor?: string;
  hint?: ReactNode;
  shortcut?: string[];
  /** Matched character indices in `label` for highlighting. */
  indices: number[];
  score: number;
  kind: 'task' | 'command' | 'person' | 'ai';
  task?: TaskDto;
  command?: Command;
  person?: MemberDto;
  href?: string;
}

export const GROUP_LABELS: Record<PaletteGroupId, string> = {
  ai: 'Ask Hearth AI',
  tasks: 'Tasks',
  actions: 'Actions',
  navigate: 'Navigate',
  projects: 'Projects',
  people: 'People',
  settings: 'Settings',
};

const COMMAND_GROUP: Record<Command['group'], PaletteGroupId> = {
  AI: 'ai',
  Tasks: 'tasks',
  Actions: 'actions',
  Navigate: 'navigate',
  Projects: 'projects',
  Settings: 'settings',
};

const PER_GROUP = 5;
export const MAX_GROUPS = 4;

/** Label indices for a match on the label field (field 0); other fields don't highlight. */
const labelIndices = (m: FuzzyMatch & { field: number }, offset = 0) =>
  m.field === 0 ? m.indices.map((i) => i - offset).filter((i) => i >= 0) : [];

export interface BuildInput {
  query: string;
  scope: PaletteScope;
  tasks: readonly TaskDto[];
  commands: readonly Command[];
  members: readonly MemberDto[];
  ai: NlInterpretation | null;
}

export interface PaletteGroup {
  id: PaletteGroupId;
  label: string;
  items: PaletteItem[];
}

/** Ranks every source and returns at most MAX_GROUPS non-empty groups, AI first. */
export function buildPaletteGroups({
  query,
  scope,
  tasks,
  commands,
  members,
  ai,
}: BuildInput): PaletteGroup[] {
  const q = query.trim();
  const groups: PaletteGroup[] = [];
  const want = (s: PaletteScope) => scope === 'all' || scope === s;

  if (ai && want('all')) {
    groups.push({
      id: 'ai',
      label: GROUP_LABELS.ai,
      items: [
        {
          id: 'ai:filter',
          group: 'ai',
          kind: 'ai',
          label: ai.label,
          icon: 'sparkles',
          iconColor: 'var(--brand-primary)',
          shortcut: ['↵'],
          indices: [],
          score: 1e6,
          href: ai.href,
        },
      ],
    });
  }

  if (want('tasks')) {
    const pool = q ? tasks : [...tasks].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    const ranked = q
      ? rank(q, pool, (t) => [t.title, t.key, t.project?.name ?? '', ...t.tags.map((x) => x.name)])
      : pool.map((item) => ({ item, match: { score: 0, indices: [], field: 0 } }));
    const items = ranked.slice(0, PER_GROUP).map(({ item: t, match }) => ({
      id: `task:${t.id}`,
      group: 'tasks' as const,
      kind: 'task' as const,
      label: t.title,
      prefix: t.key,
      icon: STATUS_ICON[t.status].icon,
      iconColor: STATUS_ICON[t.status].color,
      hint: dueHint(t.dueDate, t.status === 'DONE'),
      indices: labelIndices(match),
      score: match.score,
      task: t,
    }));
    if (items.length) groups.push({ id: 'tasks', label: GROUP_LABELS.tasks, items });
  }

  if (want('commands') || scope === 'projects') {
    const pool = scope === 'projects' ? commands.filter((c) => c.group === 'Projects') : commands;
    const ranked = q
      ? rank(q, pool, (c) => [c.title, ...(c.keywords ?? [])])
      : pool.map((item) => ({ item, match: { score: 0, indices: [], field: 0 } }));
    const byGroup = new Map<PaletteGroupId, PaletteItem[]>();
    for (const { item: c, match } of ranked) {
      const g = COMMAND_GROUP[c.group];
      const list = byGroup.get(g) ?? [];
      if (list.length >= PER_GROUP) continue;
      list.push({
        id: `cmd:${c.id}`,
        group: g,
        kind: 'command',
        label: c.title,
        icon: asIcon(c.icon, 'command'),
        shortcut: c.shortcut,
        hint: typeof c.hint === 'string' ? c.hint : undefined,
        indices: labelIndices(match),
        score: match.score,
        command: c,
      });
      byGroup.set(g, list);
    }
    for (const g of ['actions', 'navigate', 'projects', 'settings', 'tasks', 'ai'] as PaletteGroupId[]) {
      const items = byGroup.get(g);
      if (!items?.length) continue;
      const existing = groups.find((x) => x.id === g);
      if (existing) existing.items.push(...items);
      else groups.push({ id: g, label: GROUP_LABELS[g], items });
    }
  }

  if (want('people') && (q || scope === 'people')) {
    const ranked = q
      ? rank(q, members, (m) => [m.name, m.email, m.jobTitle ?? ''])
      : members.map((item) => ({ item, match: { score: 0, indices: [], field: 0 } }));
    const items = ranked.slice(0, PER_GROUP).map(({ item: m, match }) => ({
      id: `person:${m.id}`,
      group: 'people' as const,
      kind: 'person' as const,
      label: m.name,
      icon: 'user-plus' as IconName,
      hint: `See ${m.name.split(' ')[0]}’s tasks`,
      indices: labelIndices(match),
      score: match.score,
      person: m,
      href: `/my-tasks?assignee=${m.id}`,
    }));
    if (items.length) groups.push({ id: 'people', label: GROUP_LABELS.people, items });
  }

  if (q) {
    // Keep AI first; order the rest by their best match.
    const [aiGroup, ...rest] = groups[0]?.id === 'ai' ? groups : [null, ...groups];
    rest.sort(
      (a, b) => Math.max(...b!.items.map((i) => i.score)) - Math.max(...a!.items.map((i) => i.score)),
    );
    return [...(aiGroup ? [aiGroup] : []), ...(rest as PaletteGroup[])].slice(0, MAX_GROUPS);
  }
  return groups.slice(0, MAX_GROUPS);
}
