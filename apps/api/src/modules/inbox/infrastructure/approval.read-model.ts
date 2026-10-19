import { Inject, Injectable } from '@nestjs/common';
import type { ApprovalDetailDto } from '@hearth/contracts';
import {
  ForbiddenError,
  NotFoundError,
  approvalAskedLine,
  approvalDueLabel,
  approverLabel,
  formatFileSize,
  startOfDay,
  type Actor,
  type Clock,
} from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../shared/clock/clock';
import { AccessService } from '../../../shared/access/access.service';
import {
  PROJECT_REF_SELECT,
  USER_REF_SELECT,
  dateOnly,
  iso,
  toProjectRef,
  toTaskRef,
  toUserRef,
} from '../../../shared/mappers/refs';

/** Approval detail for the inbox right pane. */
@Injectable()
export class ApprovalReadModel {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async detail(actor: Actor, id: string): Promise<ApprovalDetailDto> {
    const row = await this.prisma.approvalRequest.findFirst({
      where: { id, task: { workspaceId: actor.workspaceId } },
      include: {
        task: {
          select: {
            id: true,
            number: true,
            title: true,
            status: true,
            projectId: true,
            project: { select: PROJECT_REF_SELECT },
            workspace: { select: { keyPrefix: true } },
          },
        },
        requester: { select: USER_REF_SELECT },
        decisions: { include: { user: { select: USER_REF_SELECT } } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) throw new NotFoundError('Approval', id);
    const involved = row.requesterId === actor.userId || row.decisions.some((d) => d.userId === actor.userId);
    if (!involved && !this.access.allows(actor, 'tasks.view', { projectId: row.task.projectId }))
      throw new ForbiddenError(
        'approval.hidden',
        'This approval is in a project you can’t see. Ask the requester to share it.',
      );

    const task = toTaskRef(row.task, row.task.workspace.keyPrefix);
    // Teammates first (alphabetical), then "You" — as in the design.
    const approvers = row.decisions
      .map((d) => {
        const isMe = d.userId === actor.userId;
        return {
          user: toUserRef(d.user),
          decision: d.decision,
          label: approverLabel(d.decision, isMe),
          note: d.note,
          decidedAt: iso(d.decidedAt),
          isMe,
        };
      })
      .sort((a, b) => Number(a.isMe) - Number(b.isMe) || a.user.name.localeCompare(b.user.name));
    const approvedCount = row.decisions.filter((d) => d.decision === 'APPROVED').length;
    const due = approvalDueLabel(row.dueDate, startOfDay(this.clock.now()), row.status);
    const mine = row.decisions.find((d) => d.userId === actor.userId);
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      status: row.status,
      task,
      project: row.task.project ? toProjectRef(row.task.project) : null,
      context: row.task.project ? `${row.task.project.name} · ${task.key}` : task.key,
      requester: toUserRef(row.requester),
      askedLine: approvalAskedLine(
        row.requester.name,
        approvers.map((a) => ({ name: a.user.name, isMe: a.isMe })),
      ),
      approvedCount,
      approverCount: row.decisions.length,
      progressLabel: `${approvedCount} of ${row.decisions.length} approval${row.decisions.length === 1 ? '' : 's'}`,
      dueDate: dateOnly(row.dueDate),
      dueLabel: due?.label ?? null,
      dueTone: due?.tone ?? 'default',
      attachments: row.attachments.map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        url: a.url,
        sizeBytes: a.sizeBytes,
        label:
          a.kind === 'doc'
            ? `${a.name} · Doc`
            : a.kind === 'link'
              ? `${a.name} · Link`
              : `${a.name} · ${formatFileSize(a.sizeBytes)}`,
      })),
      approvers,
      myDecision: mine?.decision ?? null,
      canDecide: !!mine && row.status === 'PENDING' && this.access.allows(actor, 'approvals.decide'),
      createdAt: row.createdAt.toISOString(),
      resolvedAt: iso(row.resolvedAt),
    };
  }
}
