import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { CreateTagInput, TagDto } from '@hearth/contracts';
import { ConflictError, type Actor } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AccessService } from '../../../shared/access/access.service';
import { accent } from '../../../shared/mappers/refs';

export class CreateTagCommand {
  constructor(
    readonly actor: Actor,
    readonly input: CreateTagInput,
  ) {}
}

@CommandHandler(CreateTagCommand)
export class CreateTagHandler implements ICommandHandler<CreateTagCommand, TagDto> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async execute({ actor, input }: CreateTagCommand): Promise<TagDto> {
    this.access.assert(actor, 'tasks.edit');
    const existing = await this.prisma.tag.findFirst({ where: { workspaceId: actor.workspaceId, name: { equals: input.name, mode: 'insensitive' } } });
    if (existing) throw new ConflictError('tag.exists', `There’s already a “${existing.name}” tag — pick it from the list.`);
    const tag = await this.prisma.tag.create({ data: { workspaceId: actor.workspaceId, name: input.name, color: input.color } });
    return { id: tag.id, name: tag.name, color: accent(tag.color) };
  }
}
