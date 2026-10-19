import { CommandHandler, QueryHandler, type ICommandHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { MeDto, UpdateProfileInput } from '@hearth/contracts';
import { initialsOf, type Actor } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { MeReadModel } from '../infrastructure/me.read-model';

export class GetMeQuery {
  constructor(readonly actor: Actor) {}
}

@QueryHandler(GetMeQuery)
export class GetMeHandler implements IQueryHandler<GetMeQuery, MeDto> {
  constructor(private readonly me: MeReadModel) {}

  execute({ actor }: GetMeQuery): Promise<MeDto> {
    return this.me.get(actor.userId, actor.workspaceId);
  }
}

export class UpdateProfileCommand {
  constructor(
    readonly actor: Actor,
    readonly input: UpdateProfileInput,
  ) {}
}

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileHandler implements ICommandHandler<UpdateProfileCommand, MeDto> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly me: MeReadModel,
  ) {}

  async execute({ actor, input }: UpdateProfileCommand): Promise<MeDto> {
    await this.prisma.user.update({
      where: { id: actor.userId },
      data: {
        ...(input.name !== undefined ? { name: input.name, initials: initialsOf(input.name) } : {}),
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
        ...(input.avatarColor !== undefined ? { avatarColor: input.avatarColor } : {}),
      },
    });
    return this.me.get(actor.userId, actor.workspaceId);
  }
}
