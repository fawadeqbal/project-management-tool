import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { clockProvider, CLOCK } from './clock/clock';
import { BcryptPasswordHasher, PASSWORD_HASHER } from './auth/password-hasher';
import { TokenService } from './auth/token.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { ActorResolver } from './workspace-context/actor-resolver.service';
import { AccessService } from './access/access.service';
import { ProjectScope } from './access/project-scope';
import { PermissionGuard } from './access/require-permission';
import { DomainExceptionFilter } from './http/domain-exception.filter';
import { FeatureGuard, PlanService } from './billing/require-feature';
import { DomainEventPublisher } from './events/domain-event.publisher';
import { ActivityRecorder } from './events/activity-recorder';
import { RealtimeBroadcaster, RealtimeGateway } from './events/realtime.gateway';
import { TransactionScope } from './persistence/transaction-scope';
import { PrismaDb } from './persistence/prisma-db';
import { PrismaUnitOfWork } from './persistence/prisma-unit-of-work';
import { UNIT_OF_WORK } from './persistence/unit-of-work';

/**
 * Cross-cutting infrastructure available to every bounded context: persistence, time, auth,
 * workspace context, access control (role matrix + project scope), units of work, error mapping,
 * domain events and realtime.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        // jsonwebtoken types expiresIn as a template-literal string ("7d", "1h").
        signOptions: { expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '7d') as `${number}d` },
      }),
    }),
  ],
  providers: [
    PrismaService,
    clockProvider,
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    TokenService,
    ActorResolver,
    AccessService,
    ProjectScope,
    TransactionScope,
    PrismaDb,
    { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
    DomainEventPublisher,
    ActivityRecorder,
    RealtimeGateway,
    RealtimeBroadcaster,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    PlanService,
    { provide: APP_GUARD, useClass: FeatureGuard },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
  exports: [
    PlanService,
    PrismaService,
    CLOCK,
    PASSWORD_HASHER,
    TokenService,
    ActorResolver,
    AccessService,
    ProjectScope,
    TransactionScope,
    PrismaDb,
    UNIT_OF_WORK,
    DomainEventPublisher,
    RealtimeGateway,
  ],
})
export class SharedModule {}
