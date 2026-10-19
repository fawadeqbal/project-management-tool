import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Button, EmptyState } from '@hearth/ui';
import type { ProjectDetailDto } from '@hearth/contracts';
import { useHotkey } from '@/shared/hotkeys/use-hotkey';
import { useRegisterCommands, type Command } from '@/shared/commands';
import { useProject } from '../api';
import { ProjectHeader } from '../components/ProjectHeader';
import { PROJECT_TABS, projectPath } from '../components/project-views';
import styles from '../projects.module.css';

export interface ProjectOutletContext {
  project: ProjectDetailDto;
  projectId: string;
}

/** Views read the loaded project from the layout. */
export const useProjectContext = () => useOutletContext<ProjectOutletContext>();

/**
 * Shared frame for every project view: header (health, due, people, Share), view tabs and the
 * number keys 1–6. The active view renders in the outlet once the project has loaded.
 */
export function ProjectLayout() {
  const { projectId = '' } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data: project, isError, error, refetch } = useProject(projectId);
  const view = PROJECT_TABS.find((t) => pathname.endsWith(`/${t.path}`))?.id ?? 'board';
  const go = (id: string) => void navigate(projectPath(projectId, id));

  useHotkey('1', () => go('overview'));
  useHotkey('2', () => go('list'));
  useHotkey('3', () => go('board'));
  useHotkey('4', () => go('timeline'));
  useHotkey('5', () => go('calendar'));
  useHotkey('6', () => go('workload'));

  const commands = useMemo<Command[]>(
    () =>
      PROJECT_TABS.map((t, i) => ({
        id: `project.view.${t.id}`,
        title: `Switch to ${t.label}`,
        group: 'Navigate' as const,
        icon: t.icon,
        hint: `${i + 1}`,
        keywords: ['view', 'project', t.id],
        run: () => go(t.id),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go only depends on projectId
    [projectId],
  );
  useRegisterCommands(commands);

  if (isError) {
    const notFound = (error as { kind?: string } | null)?.kind === 'not_found';
    return (
      <div className={styles.page}>
        <EmptyState
          icon={notFound ? 'folder' : 'alert'}
          title={notFound ? 'We couldn’t find that project' : 'We couldn’t load this project'}
          description={notFound ? 'It may have been archived, or you may not have access. Ask the project owner to invite you.' : 'Check your connection and try again.'}
          primaryAction={
            notFound ? (
              <Button variant="secondary" onClick={() => void navigate('/projects')}>
                See all projects
              </Button>
            ) : (
              <Button variant="secondary" icon="undo" onClick={() => void refetch()}>
                Try again
              </Button>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.page} data-view={view}>
      <ProjectHeader project={project} view={view} onViewChange={go} />
      {project ? <Outlet context={{ project, projectId } satisfies ProjectOutletContext} /> : null}
    </div>
  );
}
