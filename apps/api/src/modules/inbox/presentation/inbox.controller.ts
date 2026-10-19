import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  CreateApprovalSchema,
  DecideApprovalSchema,
  InboxBulkSchema,
  InboxQuerySchema,
  SnoozeSchema,
  type ApprovalDetailDto,
  type CreateApprovalInput,
  type DecideApprovalInput,
  type InboxBulkInput,
  type InboxDto,
  type InboxQuery,
  type InboxTriageResultDto,
  type SnoozeInput,
} from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { CurrentActor } from '../../../shared/workspace-context/current-actor.decorator';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermission } from '../../../shared/access/require-permission';
import { GetInboxQuery } from '../application/queries/get-inbox.query';
import { GetApprovalQuery } from '../application/queries/get-approval.query';
import {
  TriageNotificationsCommand,
  type TriageAction,
} from '../application/commands/triage-notifications.command';
import { RequestApprovalCommand } from '../application/commands/request-approval.command';
import { DecideApprovalCommand } from '../application/commands/decide-approval.command';

/** Thin HTTP adapter for the inbox: validate → dispatch → return DTO. */
@Controller()
export class InboxController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get('inbox')
  list(
    @CurrentActor() actor: Actor,
    @Query(new ZodValidationPipe(InboxQuerySchema)) query: InboxQuery,
  ): Promise<InboxDto> {
    return this.queries.execute(new GetInboxQuery(actor, query));
  }

  @Post('inbox/bulk')
  @HttpCode(200)
  bulk(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(InboxBulkSchema)) input: InboxBulkInput,
  ): Promise<InboxTriageResultDto> {
    return this.triage(actor, input.ids, { kind: input.action });
  }

  @Post('inbox/:id/read')
  @HttpCode(200)
  read(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.triage(actor, [id], { kind: 'read' });
  }

  @Post('inbox/:id/unread')
  @HttpCode(200)
  unread(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.triage(actor, [id], { kind: 'unread' });
  }

  @Post('inbox/:id/archive')
  @HttpCode(200)
  archive(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.triage(actor, [id], { kind: 'archive' });
  }

  @Post('inbox/:id/unarchive')
  @HttpCode(200)
  unarchive(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.triage(actor, [id], { kind: 'unarchive' });
  }

  @Post('inbox/:id/unsnooze')
  @HttpCode(200)
  unsnooze(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.triage(actor, [id], { kind: 'unsnooze' });
  }

  @Post('inbox/:id/snooze')
  @HttpCode(200)
  snooze(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SnoozeSchema)) input: SnoozeInput,
  ) {
    return this.triage(actor, [id], { kind: 'snooze', preset: input.preset, until: input.until });
  }

  @Post('tasks/:taskId/approvals')
  @RequirePermission('tasks.edit')
  async requestApproval(
    @CurrentActor() actor: Actor,
    @Param('taskId') taskId: string,
    @Body(new ZodValidationPipe(CreateApprovalSchema)) input: CreateApprovalInput,
  ): Promise<ApprovalDetailDto> {
    const { id } = await this.commands.execute<RequestApprovalCommand, { id: string }>(
      new RequestApprovalCommand(actor, taskId, input),
    );
    return this.queries.execute(new GetApprovalQuery(actor, id));
  }

  @Get('approvals/:id')
  approval(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<ApprovalDetailDto> {
    return this.queries.execute(new GetApprovalQuery(actor, id));
  }

  @Post('approvals/:id/decision')
  @HttpCode(200)
  @RequirePermission('approvals.decide')
  async decide(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(DecideApprovalSchema)) input: DecideApprovalInput,
  ): Promise<ApprovalDetailDto> {
    await this.commands.execute(new DecideApprovalCommand(actor, id, input.decision, input.note ?? null));
    return this.queries.execute(new GetApprovalQuery(actor, id));
  }

  private triage(actor: Actor, ids: string[], action: TriageAction): Promise<InboxTriageResultDto> {
    return this.commands.execute(new TriageNotificationsCommand(actor, ids, action));
  }
}
