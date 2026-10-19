import type { Actor, DomainEvent } from '@hearth/domain';

/**
 * Who may receive a realtime event. Rooms:
 *   user:<id>          every socket of one person
 *   ws:<id>:staff      every non-guest socket in a workspace
 *   project:<id>       guests invited to that project
 *
 * Guests must never learn about projects they weren't invited to, so events are routed by the
 * project they concern; events with no project only reach staff; inbox events reach only their
 * recipient. Kept pure so the rule is unit-tested without sockets.
 */
export const rooms = {
  user: (userId: string) => `user:${userId}`,
  staff: (workspaceId: string) => `ws:${workspaceId}:staff`,
  project: (projectId: string) => `project:${projectId}`,
};

/** Rooms a freshly authenticated socket joins. */
export const roomsForActor = (actor: Actor): string[] =>
  actor.role === 'GUEST'
    ? [rooms.user(actor.userId), ...(actor.projectIds ?? []).map(rooms.project)]
    : [rooms.user(actor.userId), rooms.staff(actor.workspaceId)];

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

/** Rooms an event is delivered to. */
export const audienceFor = (event: DomainEvent): string[] => {
  const p = (event.payload ?? {}) as Record<string, unknown>;
  if (event.type.startsWith('notification.')) {
    const recipient = str(p['recipientId']);
    return recipient ? [rooms.user(recipient)] : [];
  }
  const projectIds = [str(p['projectId']), str(p['fromProjectId']), str(p['toProjectId'])].filter(
    (x): x is string => x !== null,
  );
  return [rooms.staff(event.workspaceId), ...new Set(projectIds.map(rooms.project))];
};

/** Rooms that may see who is viewing a task in `projectId` (null = a task outside any project). */
export const presenceAudience = (workspaceId: string, projectId: string | null): string[] =>
  projectId ? [rooms.staff(workspaceId), rooms.project(projectId)] : [rooms.staff(workspaceId)];

/** Whether an actor may see a task in `projectId` at all (presence requests are checked with it). */
export const canSeeProject = (actor: Actor, projectId: string | null): boolean =>
  actor.role !== 'GUEST' || (projectId !== null && (actor.projectIds ?? []).includes(projectId));
