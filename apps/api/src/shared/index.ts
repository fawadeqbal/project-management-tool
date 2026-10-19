/** Public surface of the shared kernel infrastructure — contexts import from '@/shared' paths below. */
export { PrismaService } from './prisma/prisma.service';
export { CLOCK, type Clock } from './clock/clock';
export { Public, NoWorkspace } from './auth/auth.decorators';
export { PASSWORD_HASHER, type PasswordHasher } from './auth/password-hasher';
export { TokenService } from './auth/token.service';
export { CurrentActor, CurrentUserId } from './workspace-context/current-actor.decorator';
export { ActorResolver } from './workspace-context/actor-resolver.service';
export { AccessService } from './access/access.service';
export { RequirePermission } from './access/require-permission';
export { ZodValidationPipe } from './http/zod-validation.pipe';
export { DomainEventEnvelope } from './events/domain-event.envelope';
export { DomainEventPublisher } from './events/domain-event.publisher';
export { DomainEventSubscriber } from './events/domain-event.subscriber';
export * from './mappers/refs';
export { RequireFeature, PlanService } from './billing/require-feature';
