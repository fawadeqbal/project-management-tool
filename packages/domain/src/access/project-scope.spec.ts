import { describe, expect, it } from 'vitest';
import { AccessPolicy, type Actor } from './access-policy';
import {
  assertCanBeAssigned,
  assertCanViewProject,
  canSeeWorkspaceDirectory,
  canViewProject,
  visibleProjectIds,
} from './project-scope';
import { inviteTakesSeat } from './invites';
import { roleTakesSeat } from './seats';
import { WorkspaceMember } from './workspace-member';
import { ForbiddenError, NotFoundError, ValidationError } from '../shared/errors';

const guest: Actor = { userId: 'tom', workspaceId: 'w', role: 'GUEST', projectIds: ['p-web'] };
const member: Actor = { userId: 'mo', workspaceId: 'w', role: 'MEMBER' };
const viewer: Actor = { userId: 'vi', workspaceId: 'w', role: 'VIEWER' };

describe('project scope', () => {
  it('lets staff see every project and guests only theirs', () => {
    expect(canViewProject(member, 'p-mobile')).toBe(true);
    expect(canViewProject(member, null)).toBe(true);
    expect(canViewProject(guest, 'p-web')).toBe(true);
    expect(canViewProject(guest, 'p-mobile')).toBe(false);
    expect(canViewProject(guest, null)).toBe(false);
    expect(visibleProjectIds(member)).toBeNull();
    expect(visibleProjectIds(guest)).toEqual(['p-web']);
    expect(visibleProjectIds({ role: 'GUEST' })).toEqual([]);
  });

  it('keeps guests out of the workspace directory', () => {
    expect(canSeeWorkspaceDirectory(guest)).toBe(false);
    expect(canSeeWorkspaceDirectory(viewer)).toBe(true);
  });

  it('answers hidden things with a 404 for the thing asked for', () => {
    expect(() => assertCanViewProject(guest, 'p-mobile', { entity: 'Task', id: 't1' })).toThrow(NotFoundError);
    try {
      assertCanViewProject(guest, 'p-mobile', { entity: 'Task', id: 't1' });
    } catch (e) {
      expect((e as NotFoundError).code).toBe('task.not_found');
    }
    expect(() => assertCanViewProject(guest, 'p-web', { entity: 'Task', id: 't1' })).not.toThrow();
  });
});

describe('assignment scope', () => {
  it('lets anyone who can see the project be assigned, and explains why a guest can’t', () => {
    expect(() => assertCanBeAssigned({ ...member, name: 'Mo Khan' }, 'p-mobile')).not.toThrow();
    expect(() => assertCanBeAssigned({ ...guest, name: 'Tom Wright' }, 'p-web')).not.toThrow();
    expect(() => assertCanBeAssigned({ ...guest, name: 'Tom Wright' }, 'p-mobile')).toThrow(
      /Tom is a guest and can’t see this project/,
    );
    expect(() => assertCanBeAssigned({ ...guest, name: 'Tom Wright' }, null)).toThrow(ValidationError);
  });
});

describe('AccessPolicy with project scope', () => {
  const policy = new AccessPolicy();

  it('gives a guest a 404 for another project, never a 403 that confirms it exists', () => {
    expect(() => policy.assert(guest, 'tasks.edit', { projectId: 'p-mobile' })).toThrow(NotFoundError);
    try {
      policy.assert(guest, 'tasks.edit', { projectId: 'p-mobile' });
    } catch (e) {
      expect((e as NotFoundError).details).toEqual({ entity: 'Project' }); // the hidden id isn't echoed
    }
    expect(() => policy.assert(guest, 'tasks.view', { projectId: 'p-mobile' })).toThrow(NotFoundError);
  });

  it('gives a guest a 403 when there is no project to hide', () => {
    expect(() => policy.assert(guest, 'tasks.create', { projectId: null })).toThrow(ForbiddenError);
  });

  it('still applies the role matrix inside the guest’s projects and for staff', () => {
    expect(() => policy.assert(guest, 'tasks.delete', { projectId: 'p-web' })).toThrow(ForbiddenError);
    expect(() => policy.assert(guest, 'tasks.edit', { projectId: 'p-web' })).not.toThrow();
    expect(() => policy.assert(viewer, 'tasks.edit', { projectId: 'p-mobile' })).toThrow(ForbiddenError);
    expect(policy.allows(guest, 'tasks.view', { projectId: 'p-mobile' })).toBe(false);
  });
});

describe('seats', () => {
  it('charges owners, admins and members — viewers and guests are free', () => {
    expect(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'GUEST'].map((r) => roleTakesSeat(r as never))).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(inviteTakesSeat('VIEWER')).toBe(false);
    const v = WorkspaceMember.restore('m', {
      workspaceId: 'w',
      userId: 'u',
      role: 'VIEWER',
      status: 'ACTIVE',
      deactivatedAt: null,
    });
    expect(v.takesSeat).toBe(false);
  });
});
