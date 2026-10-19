import { Module } from '@nestjs/common';
import { WORKSPACE_MEMBER_REPOSITORY } from '@hearth/domain';
import { PrismaWorkspaceMemberRepository } from './infrastructure/prisma-workspace-member.repository';
import { MembersReadModel } from './infrastructure/members.read-model';
import { SeatCounter } from './infrastructure/seat-counter';
import { GetMembersHandler } from './application/queries/get-members.handler';
import { ListInvitesHandler } from './application/queries/list-invites.handler';
import { GetRolesHandler } from './application/queries/get-roles.handler';
import { CreateInviteHandler } from './application/commands/create-invite.handler';
import { ResendInviteHandler } from './application/commands/resend-invite.handler';
import { RevokeInviteHandler } from './application/commands/revoke-invite.handler';
import { AcceptInviteHandler } from './application/commands/accept-invite.handler';
import { ChangeMemberRoleHandler } from './application/commands/change-member-role.handler';
import { DeactivateMemberHandler } from './application/commands/deactivate-member.handler';
import { ReactivateMemberHandler } from './application/commands/reactivate-member.handler';
import { RemoveMemberHandler } from './application/commands/remove-member.handler';
import { MembersController } from './presentation/members.controller';

/**
 * Members bounded context: invites (seat-limited), role changes, deactivate/reactivate, removal
 * and the permission matrix. Rules live in the WorkspaceMember aggregate (@hearth/domain).
 */
@Module({
  controllers: [MembersController],
  providers: [
    { provide: WORKSPACE_MEMBER_REPOSITORY, useClass: PrismaWorkspaceMemberRepository },
    MembersReadModel,
    SeatCounter,
    GetMembersHandler,
    ListInvitesHandler,
    GetRolesHandler,
    CreateInviteHandler,
    ResendInviteHandler,
    RevokeInviteHandler,
    AcceptInviteHandler,
    ChangeMemberRoleHandler,
    DeactivateMemberHandler,
    ReactivateMemberHandler,
    RemoveMemberHandler,
  ],
})
export class MembersModule {}
