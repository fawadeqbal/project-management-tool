import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  LoginSchema,
  RegisterSchema,
  UpdateProfileSchema,
  type AuthResponseDto,
  type LoginInput,
  type MeDto,
  type RegisterInput,
  type UpdateProfileInput,
} from '@hearth/contracts';
import type { Actor } from '@hearth/domain';
import { Public } from '../../../shared/auth/auth.decorators';
import { CurrentActor } from '../../../shared/workspace-context/current-actor.decorator';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { RegisterCommand } from '../application/register.handler';
import { LoginCommand } from '../application/login.handler';
import { GetMeQuery, UpdateProfileCommand } from '../application/profile.handlers';

/** Thin HTTP adapter: validate → dispatch → return the contract DTO. */
@Controller()
export class IdentityController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Public()
  @Post('auth/register')
  register(@Body(new ZodValidationPipe(RegisterSchema)) input: RegisterInput): Promise<AuthResponseDto> {
    return this.commands.execute(new RegisterCommand(input));
  }

  @Public()
  @Post('auth/login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(LoginSchema)) input: LoginInput): Promise<AuthResponseDto> {
    return this.commands.execute(new LoginCommand(input));
  }

  @Get('me')
  me(@CurrentActor() actor: Actor): Promise<MeDto> {
    return this.queries.execute(new GetMeQuery(actor));
  }

  @Patch('me')
  updateProfile(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(UpdateProfileSchema)) input: UpdateProfileInput): Promise<MeDto> {
    return this.commands.execute(new UpdateProfileCommand(actor, input));
  }
}
