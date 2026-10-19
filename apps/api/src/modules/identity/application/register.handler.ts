import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AuthResponseDto, RegisterInput } from '@hearth/contracts';
import { addDays, ConflictError, initialsOf, type Clock } from '@hearth/domain';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { CLOCK } from '../../../shared/clock/clock';
import { PASSWORD_HASHER, type PasswordHasher } from '../../../shared/auth/password-hasher';
import { TokenService } from '../../../shared/auth/token.service';
import { MeReadModel } from '../infrastructure/me.read-model';

export class RegisterCommand {
  constructor(readonly input: RegisterInput) {}
}

const AVATAR_COLORS = ['blue', 'green', 'violet', 'sky', 'amber', 'rose'] as const;

/** Derives a short task-key prefix from the workspace name: "Acme Studio" → "AS", "Hearth" → "HEA". */
export const keyPrefixFor = (name: string): string => {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const prefix =
    words.length > 1
      ? words
          .map((w) => w[0])
          .join('')
          .slice(0, 4)
      : (words[0] ?? 'HRT').slice(0, 3);
  return prefix.length >= 2 ? prefix : 'HRT';
};

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'workspace';

/**
 * Sign-up: creates the person, their first workspace (Owner), a Free subscription and the
 * getting-started checklist — the "first task in under 5 minutes" path starts here.
 */
@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand, AuthResponseDto> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly me: MeReadModel,
  ) {}

  async execute({ input }: RegisterCommand): Promise<AuthResponseDto> {
    if (await this.prisma.user.findUnique({ where: { email: input.email } }))
      throw new ConflictError(
        'user.email_taken',
        'That email already has an account. Sign in instead, or use a different email.',
      );

    const now = this.clock.now();
    const firstName = input.name.split(/\s+/)[0] ?? input.name;
    const workspaceName = input.workspaceName ?? `${firstName}’s workspace`;
    const passwordHash = await this.hasher.hash(input.password);

    const { userId, workspaceId } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          initials: initialsOf(input.name),
          avatarColor: AVATAR_COLORS[input.email.length % AVATAR_COLORS.length]!,
          passwordHash,
          theme: 'system',
        },
      });
      let slug = slugify(workspaceName);
      if (await tx.workspace.findUnique({ where: { slug } })) slug = `${slug}-${user.id.slice(-6)}`;
      const workspace = await tx.workspace.create({
        data: { name: workspaceName, slug, keyPrefix: keyPrefixFor(workspaceName) },
      });
      await tx.membership.create({ data: { workspaceId: workspace.id, userId: user.id, role: 'OWNER' } });
      await tx.subscription.create({
        data: { workspaceId: workspace.id, plan: 'FREE', seats: 5, renewsAt: addDays(now, 30) },
      });
      await tx.onboardingProgress.create({
        data: { workspaceId: workspace.id, userId: user.id, completedSteps: ['create-workspace'] },
      });
      return { userId: user.id, workspaceId: workspace.id };
    });

    return { accessToken: await this.tokens.issue(userId), me: await this.me.get(userId, workspaceId) };
  }
}
