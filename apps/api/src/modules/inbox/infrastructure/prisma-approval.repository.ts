import { Injectable } from '@nestjs/common';
import { Approval } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { ApprovalAttachmentDraft, InboxApprovalRepository } from '../application/ports';

/** Adapter: Approval aggregate ⇄ ApprovalRequest + ApprovalDecision rows. */
@Injectable()
export class PrismaApprovalRepository implements InboxApprovalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(workspaceId: string, id: string): Promise<Approval | null> {
    const row = await this.prisma.approvalRequest.findFirst({
      where: { id, task: { workspaceId } },
      include: { decisions: true, task: { select: { workspaceId: true } } },
    });
    if (!row) return null;
    return Approval.restore(row.id, {
      workspaceId: row.task.workspaceId,
      taskId: row.taskId,
      requesterId: row.requesterId,
      title: row.title,
      summary: row.summary,
      dueDate: row.dueDate,
      status: row.status,
      decisions: row.decisions.map((d) => ({ userId: d.userId, decision: d.decision, note: d.note, decidedAt: d.decidedAt })),
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
    });
  }

  async save(approval: Approval): Promise<void> {
    const s = approval.toSnapshot();
    await this.prisma.$transaction([
      this.prisma.approvalRequest.upsert({
        where: { id: s.id },
        create: {
          id: s.id,
          taskId: s.taskId,
          requesterId: s.requesterId,
          title: s.title,
          summary: s.summary,
          dueDate: s.dueDate,
          status: s.status,
          createdAt: s.createdAt,
          resolvedAt: s.resolvedAt,
        },
        update: { title: s.title, summary: s.summary, dueDate: s.dueDate, status: s.status, resolvedAt: s.resolvedAt },
      }),
      ...s.decisions.map((d) =>
        this.prisma.approvalDecision.upsert({
          where: { approvalId_userId: { approvalId: s.id, userId: d.userId } },
          create: { approvalId: s.id, userId: d.userId, decision: d.decision, note: d.note, decidedAt: d.decidedAt },
          update: { decision: d.decision, note: d.note, decidedAt: d.decidedAt },
        }),
      ),
    ]);
  }

  async addAttachments(approvalId: string, attachments: ApprovalAttachmentDraft[]): Promise<void> {
    if (!attachments.length) return;
    await this.prisma.attachment.createMany({ data: attachments.map((a) => ({ approvalId, ...a })) });
  }
}
