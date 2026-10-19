import { AggregateRoot } from '../shared/entity';
import { createEvent } from '../shared/domain-event';
import { ConflictError, ForbiddenError, ValidationError } from '../shared/errors';
import { formatShortDate, diffInDays } from '../shared/dates';
import { assertCanAssignRole } from './access-policy';
import { ROLE_META, type Role } from './roles';
import { roleTakesSeat } from './seats';

export type MemberStatus = 'ACTIVE' | 'DEACTIVATED';

export interface WorkspaceMemberProps {
  workspaceId: string;
  userId: string;
  role: Role;
  status: MemberStatus;
  deactivatedAt: Date | null;
}

/** Who is acting on a membership: their id and role in the same workspace. */
export interface MemberActor {
  userId: string;
  role: Role;
}

/**
 * The membership rules from the Members & roles screen, in one place:
 *  - the last active owner can never be demoted, deactivated or removed (409),
 *  - nobody changes, deactivates or removes themselves (403),
 *  - you can't act on someone who outranks you, or hand out a role above your own (403).
 * Order matters: "you're the only owner" is the more useful answer than "not on yourself".
 */
export const MembershipRules = {
  assertNotLastOwner(
    target: Pick<WorkspaceMemberProps, 'role' | 'status'>,
    activeOwnerCount: number,
    action: string,
  ): void {
    if (target.role === 'OWNER' && target.status === 'ACTIVE' && activeOwnerCount <= 1)
      throw new ConflictError(
        'members.last_owner',
        `This is the workspace’s only owner, so you can’t ${action}. Make someone else an owner first.`,
      );
  },
  assertNotSelf(actor: MemberActor, target: Pick<WorkspaceMemberProps, 'userId'>, action: string): void {
    if (actor.userId === target.userId)
      throw new ForbiddenError(
        'members.self',
        `You can’t ${action} yourself. Ask another admin or owner to do it.`,
      );
  },
  assertNotOutranked(actor: MemberActor, target: Pick<WorkspaceMemberProps, 'role'>): void {
    if (ROLE_META[target.role].rank < ROLE_META[actor.role].rank)
      throw new ForbiddenError(
        'members.outranked',
        `Only an ${ROLE_META[target.role].label.toLowerCase()} can change another ${ROLE_META[target.role].label.toLowerCase()}.`,
      );
  },
};

/**
 * WorkspaceMember aggregate: a person's role and status in one workspace. Deactivation is
 * reversible and keeps the person's work; removal is permanent and confirmed by the caller.
 */
export class WorkspaceMember extends AggregateRoot<WorkspaceMemberProps> {
  private constructor(id: string, props: WorkspaceMemberProps) {
    super(id, props);
  }

  static restore(id: string, props: WorkspaceMemberProps): WorkspaceMember {
    return new WorkspaceMember(id, { ...props });
  }

  get userId() {
    return this.props.userId;
  }
  get role() {
    return this.props.role;
  }
  get status() {
    return this.props.status;
  }
  get workspaceId() {
    return this.props.workspaceId;
  }
  /** Owners, admins and members take a paid seat; viewers and guests are free. */
  get takesSeat(): boolean {
    return roleTakesSeat(this.props.role);
  }
  toSnapshot(): Readonly<WorkspaceMemberProps & { id: string }> {
    return { ...this.props, id: this.id };
  }

  changeRole(newRole: Role, actor: MemberActor, activeOwnerCount: number, now: Date): void {
    if (newRole === this.props.role) return;
    if (newRole !== 'OWNER')
      MembershipRules.assertNotLastOwner(this.props, activeOwnerCount, 'change their role');
    MembershipRules.assertNotSelf(actor, this.props, 'change the role of');
    MembershipRules.assertNotOutranked(actor, this.props);
    assertCanAssignRole(actor.role, newRole);
    if (newRole === 'GUEST')
      throw new ValidationError(
        'members.to_guest',
        'Guests only see the projects they’re invited to. Invite them as a guest to a project instead.',
      );
    if (this.props.status === 'DEACTIVATED')
      throw new ConflictError('members.deactivated', 'Reactivate this person before changing their role.');
    const from = this.props.role;
    this.props.role = newRole;
    this.record(
      createEvent('member.role_changed', this.base(actor.userId, now), {
        userId: this.props.userId,
        from,
        to: newRole,
      }),
    );
  }

  deactivate(actor: MemberActor, activeOwnerCount: number, now: Date): void {
    if (this.props.status === 'DEACTIVATED') return;
    MembershipRules.assertNotLastOwner(this.props, activeOwnerCount, 'deactivate them');
    MembershipRules.assertNotSelf(actor, this.props, 'deactivate');
    MembershipRules.assertNotOutranked(actor, this.props);
    this.props.status = 'DEACTIVATED';
    this.props.deactivatedAt = now;
    this.record(
      createEvent('member.deactivated', this.base(actor.userId, now), {
        userId: this.props.userId,
        role: this.props.role,
      }),
    );
  }

  reactivate(actor: MemberActor, now: Date): void {
    if (this.props.status === 'ACTIVE') return;
    MembershipRules.assertNotSelf(actor, this.props, 'reactivate');
    MembershipRules.assertNotOutranked(actor, this.props);
    this.props.status = 'ACTIVE';
    this.props.deactivatedAt = null;
    this.record(
      createEvent('member.reactivated', this.base(actor.userId, now), {
        userId: this.props.userId,
        role: this.props.role,
      }),
    );
  }

  /** Validates and records a permanent removal; the repository deletes the row. */
  remove(actor: MemberActor, activeOwnerCount: number, confirmed: boolean, now: Date): void {
    if (!confirmed)
      throw new ValidationError(
        'members.remove_unconfirmed',
        'Removing someone can’t be undone. Confirm to continue, or deactivate them instead.',
      );
    MembershipRules.assertNotLastOwner(this.props, activeOwnerCount, 'remove them');
    MembershipRules.assertNotSelf(actor, this.props, 'remove');
    MembershipRules.assertNotOutranked(actor, this.props);
    this.record(
      createEvent('member.removed', this.base(actor.userId, now), {
        userId: this.props.userId,
        role: this.props.role,
      }),
    );
  }

  private base(actorId: string, now: Date) {
    return { workspaceId: this.props.workspaceId, actorId, aggregateId: this.id, occurredAt: now };
  }
}

export interface WorkspaceMemberRepository {
  findByUser(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  countActiveOwners(workspaceId: string): Promise<number>;
  save(member: WorkspaceMember): Promise<void>;
  /** Permanently deletes the membership; returns how many open tasks were unassigned. */
  remove(member: WorkspaceMember): Promise<{ unassignedTasks: number }>;
}

export const WORKSPACE_MEMBER_REPOSITORY = Symbol('WorkspaceMemberRepository');

/** "Now", "5 min ago", "1 hour ago", "Yesterday", "3 days ago", "Sep 2" (Members table). */
export const lastActiveLabel = (at: Date, now: Date): string => {
  const mins = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60_000));
  if (mins < 2) return 'Now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = diffInDays(at, now);
  if (days <= 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatShortDate(at);
};
