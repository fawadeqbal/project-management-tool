import { AggregateRoot } from '../shared/entity';
import { createEvent } from '../shared/domain-event';
import { ForbiddenError, InvariantViolation, ValidationError } from '../shared/errors';
import { Guard } from '../shared/guard';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';
export type Decision = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';

export interface ApproverDecision {
  userId: string;
  decision: Decision;
  note: string | null;
  decidedAt: Date | null;
}

export interface ApprovalProps {
  workspaceId: string;
  taskId: string;
  requesterId: string;
  title: string;
  summary: string | null;
  dueDate: Date | null;
  status: ApprovalStatus;
  decisions: ApproverDecision[];
  createdAt: Date;
  resolvedAt: Date | null;
}

/**
 * Approval request aggregate. Resolution rule: any "changes requested" resolves the request as
 * CHANGES_REQUESTED; it is APPROVED once every approver approved. Approvers can change their
 * decision while the request is open.
 */
export class Approval extends AggregateRoot<ApprovalProps> {
  private constructor(id: string, props: ApprovalProps) {
    super(id, props);
  }

  static request(
    input: { id: string; workspaceId: string; taskId: string; requesterId: string; title: string; summary?: string | null; dueDate?: Date | null; approverIds: string[] },
    now: Date,
  ): Approval {
    const approvers = [...new Set(input.approverIds)].filter((id) => id !== input.requesterId);
    if (approvers.length === 0) throw new ValidationError('approval.approvers', 'Pick at least one approver other than yourself.');
    const a = new Approval(input.id, {
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      requesterId: input.requesterId,
      title: Guard.notBlank(input.title, 'title'),
      summary: input.summary?.trim() || null,
      dueDate: input.dueDate ?? null,
      status: 'PENDING',
      decisions: approvers.map((userId) => ({ userId, decision: 'PENDING', note: null, decidedAt: null })),
      createdAt: now,
      resolvedAt: null,
    });
    a.record(
      createEvent('approval.requested', { workspaceId: input.workspaceId, actorId: input.requesterId, aggregateId: input.id, occurredAt: now }, {
        taskId: input.taskId,
        title: a.props.title,
        approverIds: approvers,
      }),
    );
    return a;
  }

  static restore(id: string, props: ApprovalProps): Approval {
    return new Approval(id, { ...props, decisions: props.decisions.map((d) => ({ ...d })) });
  }

  get status() {
    return this.props.status;
  }
  get approvedCount() {
    return this.props.decisions.filter((d) => d.decision === 'APPROVED').length;
  }
  toSnapshot(): Readonly<ApprovalProps & { id: string }> {
    return { ...this.props, id: this.id, decisions: this.props.decisions.map((d) => ({ ...d })) };
  }

  decide(userId: string, decision: Exclude<Decision, 'PENDING'>, note: string | null, now: Date): void {
    if (this.props.status !== 'PENDING') throw new InvariantViolation('approval.closed', 'This approval is already resolved.');
    const entry = this.props.decisions.find((d) => d.userId === userId);
    if (!entry) throw new ForbiddenError('approval.not_approver', 'You’re not an approver on this request.');
    entry.decision = decision;
    entry.note = note?.trim() || null;
    entry.decidedAt = now;

    const anyChanges = this.props.decisions.some((d) => d.decision === 'CHANGES_REQUESTED');
    const allApproved = this.props.decisions.every((d) => d.decision === 'APPROVED');
    if (anyChanges || allApproved) {
      this.props.status = anyChanges ? 'CHANGES_REQUESTED' : 'APPROVED';
      this.props.resolvedAt = now;
    }
    this.record(
      createEvent('approval.decided', { workspaceId: this.props.workspaceId, actorId: userId, aggregateId: this.id, occurredAt: now }, {
        taskId: this.props.taskId,
        decision,
        status: this.props.status,
        requesterId: this.props.requesterId,
        title: this.props.title,
      }),
    );
  }
}

export interface ApprovalRepository {
  findById(workspaceId: string, id: string): Promise<Approval | null>;
  save(approval: Approval): Promise<void>;
}

export const APPROVAL_REPOSITORY = Symbol('ApprovalRepository');
