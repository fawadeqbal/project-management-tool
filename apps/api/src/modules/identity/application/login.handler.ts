import { Inject, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AuthResponseDto, LoginInput } from '@hearth/contracts';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { PASSWORD_HASHER, type PasswordHasher } from '../../../shared/auth/password-hasher';
import { TokenService } from '../../../shared/auth/token.service';
import { MeReadModel } from '../infrastructure/me.read-model';

export class LoginCommand {
  constructor(readonly input: LoginInput) {}
}

const WRONG_CREDENTIALS = 'That email and password don’t match. Try again or reset your password.';

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand, AuthResponseDto> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly me: MeReadModel,
  ) {}

  async execute({ input }: LoginCommand): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { memberships: { where: { status: 'ACTIVE' }, orderBy: { joinedAt: 'asc' }, take: 1 } },
    });
    // Same message whether the email or the password is wrong — don't reveal which accounts exist.
    if (!user || !(await this.hasher.verify(input.password, user.passwordHash))) throw new UnauthorizedException(WRONG_CREDENTIALS);
    const membership = user.memberships[0];
    if (!membership) throw new UnauthorizedException('Your access to every workspace has been turned off. Contact your workspace admin.');
    return { accessToken: await this.tokens.issue(user.id), me: await this.me.get(user.id, membership.workspaceId) };
  }
}
