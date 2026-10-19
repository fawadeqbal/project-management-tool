import { NotFoundError, type Actor, type Project, type ProjectRepository } from '@hearth/domain';

/** Loads a project the actor can see, or throws a NotFound (guests never learn other projects exist). */
export async function loadProject(repo: ProjectRepository, actor: Actor, projectId: string): Promise<Project> {
  const project = await repo.findById(actor.workspaceId, projectId);
  if (!project || (actor.role === 'GUEST' && !actor.projectIds?.includes(projectId))) throw new NotFoundError('Project', projectId);
  return project;
}
