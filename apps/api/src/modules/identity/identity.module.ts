import { Module } from '@nestjs/common';
import { MeReadModel } from './infrastructure/me.read-model';
import { RegisterHandler } from './application/register.handler';
import { LoginHandler } from './application/login.handler';
import { GetMeHandler, UpdateProfileHandler } from './application/profile.handlers';
import { IdentityController } from './presentation/identity.controller';

/** Identity bounded context: sign-up, sign-in, the current user and their profile. */
@Module({
  controllers: [IdentityController],
  providers: [MeReadModel, RegisterHandler, LoginHandler, GetMeHandler, UpdateProfileHandler],
  exports: [MeReadModel],
})
export class IdentityModule {}
