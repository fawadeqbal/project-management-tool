import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TaskDto } from '@hearth/contracts';
import { useCommandRegistry, useCommands } from '@/shared/commands/CommandsProvider';
import type { CommandContext } from '@/shared/commands/command';
import type { PaletteScope } from '@/shared/layout/ui-store';
import { allCachedTasks } from '@/shared/tasks/task-cache';
import { useMembers, useShell, useTags, useTeams } from '@/shared/workspace/hooks';
import { useServerSearch } from './api';
import { interpretQuery } from './natural-language';
import { buildPaletteGroups, type PaletteGroup } from './palette-items';

/** Collects local sources (cached tasks, commands, members) + server search and ranks them. */
export function usePaletteData(query: string, scope: PaletteScope, open: boolean, ctx: () => CommandContext) {
  const client = useQueryClient();
  const registry = useCommandRegistry();
  const commands = useCommands();
  const { data: members = [] } = useMembers();
  const { data: tags = [] } = useTags();
  const { data: teams = [] } = useTeams();
  const { data: shell } = useShell();
  const server = useServerSearch(query, scope);

  return useMemo((): { groups: PaletteGroup[]; ms: number } => {
    if (!open) return { groups: [], ms: 0 };
    const started = performance.now();
    const byId = new Map<string, TaskDto>();
    for (const t of allCachedTasks(client)) if (!t.id.startsWith('optimistic-')) byId.set(t.id, t);
    for (const t of server.tasks) byId.set(t.id, t);
    const available = registry.available(ctx()).filter((c) => !c.id.startsWith('palette.'));
    const projects = new Map((shell?.favorites ?? []).map((p) => [p.id, p]));
    for (const t of byId.values()) if (t.project) projects.set(t.project.id, t.project);
    const ai = interpretQuery(query, { tags, teams, members, projects: [...projects.values()] });
    const groups = buildPaletteGroups({
      query,
      scope,
      tasks: [...byId.values()],
      commands: available,
      members: members.filter((m) => m.status === 'ACTIVE'),
      ai,
    });
    return { groups, ms: Math.max(1, Math.round(performance.now() - started)) };
    // `commands` re-runs ranking when the registry changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, scope, client, registry, commands, members, tags, teams, shell, server.tasks]);
}
