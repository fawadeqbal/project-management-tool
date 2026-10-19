import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ChangeRoleSchema,
  CreateInviteSchema,
  RemoveMemberSchema,
  type AcceptInviteResultDto,
  type ChangeRoleInput,
  type CreateInviteInput,
  type CreateInviteResultDto,
  type InviteDto,
  type MembersOverviewDto,
  type RemoveMemberInput,
  type RolesDto,
} from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { NoWorkspace } from '../../../shared/auth/auth.decorators';
import { CurrentActor, CurrentUserId } from '../../../shared/workspace-context/current-actor.decorator';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RequirePermission } from '../../../shared/access/require-permission';
import { GetMembersQuery } from '../application/queries/get-members.query';
import { ListInvitesQuery } from '../application/queries/list-invites.query';
import { GetRolesQuery } from '../application/queries/get-roles.query';
import { CreateInviteCommand } from '../application/commands/create-invite.command';
import { ResendInviteCommand } from '../application/commands/resend-invite.command';
import { RevokeInviteCommand } from '../application/commands/revoke-invite.command';
import { AcceptInviteCommand } from '../application/commands/accept-invite.command';
import { ChangeMemberRoleCommand } from '../application/commands/change-member-role.command';
import { DeactivateMemberCommand } from '../application/commands/deactivate-member.command';
import { ReactivateMemberCommand } from '../application/commands/reactivate-member.command';
import { RemoveMemberCommand } from '../application/commands/remove-member.command';

/** Members & roles (admin). Reads need members.view; every write needs members.manage. */
@Controller()
export class MembersController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get('admin/members')
  @RequirePermission('members.view')
  members(@CurrentActor() actor: Actor): Promise<MembersOverviewDto> {
    return this.queries.execute(new GetMembersQuery(actor));
  }

  @Get('admin/invites')
  @RequirePermission('members.view')
  invites(@CurrentActor() actor: Actor): Promise<InviteDto[]> {
    return this.queries.execute(new ListInvitesQuery(actor));
  }

  @Get('admin/roles')
  @RequirePermission('members.view')
  roles(): Promise<RolesDto> {
    return this.queries.execute(new GetRolesQuery());
  }

  @Post('admin/invites')
  @RequirePermission('members.manage')
  invite(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(CreateInviteSchema)) input: CreateInviteInput): Promise<CreateInviteResultDto> {
    return this.commands.execute(new CreateInviteCommand(actor, input));
  }

  @Post('admin/invites/:id/resend')
  @HttpCode(200)
  @RequirePermission('members.manage')
  resend(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<InviteDto> {
    return this.commands.execute(new ResendInviteCommand(actor, id));
  }

  @Delete('admin/invites/:id')
  @HttpCode(204)
  @RequirePermission('members.manage')
  async revoke(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<void> {
    await this.commands.execute(new RevokeInviteCommand(actor, id));
  }

  /** The invitee may not belong to any workspace yet, so this route needs no workspace context. */
  @Post('invites/:token/accept')
  @HttpCode(200)
  @NoWorkspace()
  accept(@CurrentUserId() userId: string, @Param('token') token: string): Promise<AcceptInviteResultDto> {
    return this.commands.execute(new AcceptInviteCommand(userId, token));
  }

  @Patch('admin/members/:userId/role')
  @RequirePermission('members.manage')
  changeRole(@CurrentActor() actor: Actor, @Param('userId') userId: string, @Body(new ZodValidationPipe(ChangeRoleSchema)) input: ChangeRoleInput) {
    return this.commands.execute(new ChangeMemberRoleCommand(actor, userId, input.role));
  }

  @Post('admin/members/:userId/deactivate')
  @HttpCode(200)
  @RequirePermission('members.manage')
  deactivate(@CurrentActor() actor: Actor, @Param('userId') userId: string) {
    return this.commands.execute(new DeactivateMemberCommand(actor, userId));
  }

  @Post('admin/members/:userId/reactivate')
  @HttpCode(200)
  @RequirePermission('members.manage')
  reactivate(@CurrentActor() actor: Actor, @Param('userId') userId: string) {
    return this.commands.execute(new ReactivateMemberCommand(actor, userId));
  }

  @Delete('admin/members/:userId')
  @RequirePermission('members.manage')
  remove(@CurrentActor() actor: Actor, @Param('userId') userId: string, @Body(new ZodValidationPipe(RemoveMemberSchema)) input: RemoveMemberInput) {
    return this.commands.execute(new RemoveMemberCommand(actor, userId, input.confirm));
  }
}
