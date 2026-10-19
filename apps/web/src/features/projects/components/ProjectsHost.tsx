import { useMemo } from 'react';
import { useRegisterCommands, type Command } from '@/shared/commands';
import { useTeams } from '@/shared/workspace/hooks';
import { useProjects } from '../api';
import { CreateProjectDialog } from './CreateProjectDialog';

/**
 * Mounted once by the app shell: registers "Go to project: <name>" and "Go to team: <name>"
 * for ⌘K (they depend on data, so they can't be static) and hosts the create-project dialog.
 */
export function ProjectsHost() {
  const { data: projects } = useProjects();
  const { data: teams } = useTeams();
  const commands = useMemo<Command[]>(
    () => [
      ...(projects ?? []).map((p) => ({
        id: `project.go.${p.id}`,
        title: `Go to project: ${p.name}`,
        group: 'Projects' as const,
        icon: 'folder',
        keywords: ['project', 'open', p.team?.name ?? ''].filter(Boolean),
        hint: p.health.label,
        run: (c: { navigate: (to: string) => void }) => c.navigate(`/projects/${p.id}/board`),
      })),
      ...(teams ?? []).map((t) => ({
        id: `team.go.${t.id}`,
        title: `Go to team: ${t.name}`,
        group: 'Projects' as const,
        icon: 'users',
        keywords: ['team', 'people'],
        run: (c: { navigate: (to: string) => void }) => c.navigate(`/teams/${t.id}`),
      })),
    ],
    [projects, teams],
  );
  useRegisterCommands(commands);
  return <CreateProjectDialog />;
}
