import { createEvent, type Actor } from '@hearth/domain';
import { audienceFor, canSeeProject, presenceAudience, roomsForActor } from './event-audience';
import { RealtimeBroadcaster } from './realtime.gateway';

const base = { workspaceId: 'w', actorId: 'mo', aggregateId: 't1', occurredAt: new Date() };
const guest: Actor = { userId: 'tom', workspaceId: 'w', role: 'GUEST', projectIds: ['web'] };
const member: Actor = { userId: 'mo', workspaceId: 'w', role: 'MEMBER' };

describe('realtime audience', () => {
  it('puts guests only in their own and their projects’ rooms', () => {
    expect(roomsForActor(guest)).toEqual(['user:tom', 'project:web']);
    expect(roomsForActor(member)).toEqual(['user:mo', 'ws:w:staff']);
  });

  it('routes project events to staff and that project’s guests only', () => {
    const e = createEvent('task.renamed', base, { key: 'HRT-151', from: 'a', to: 'b', projectId: 'mobile' });
    expect(audienceFor(e)).toEqual(['ws:w:staff', 'project:mobile']);
  });

  it('sends events without a project to staff only', () => {
    expect(audienceFor(createEvent('member.role_changed', base, { role: 'ADMIN' }))).toEqual(['ws:w:staff']);
  });

  it('notifies both projects when a task moves between them', () => {
    const e = createEvent('task.moved', base, { key: 'HRT-1', fromProjectId: 'web', toProjectId: 'mobile' });
    expect(audienceFor(e)).toEqual(['ws:w:staff', 'project:web', 'project:mobile']);
  });

  it('delivers inbox events only to their recipient', () => {
    expect(audienceFor(createEvent('notification.created', base, { recipientId: 'fawad' }))).toEqual([
      'user:fawad',
    ]);
  });

  it('scopes presence to people who can see the task', () => {
    expect(presenceAudience('w', 'mobile')).toEqual(['ws:w:staff', 'project:mobile']);
    expect(canSeeProject(guest, 'mobile')).toBe(false);
    expect(canSeeProject(guest, 'web')).toBe(true);
    expect(canSeeProject(member, null)).toBe(true);
  });

  it('broadcasts every event type (regression: live updates were never sent)', () => {
    const broadcaster = new RealtimeBroadcaster({ broadcast: () => undefined } as never);
    expect(
      ['task.renamed', 'comment.created', 'sprint.started', 'billing.plan_changed'].every((t) =>
        broadcaster.matches(t),
      ),
    ).toBe(true);
  });
});
