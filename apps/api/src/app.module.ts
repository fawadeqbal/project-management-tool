import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from './shared/shared.module';
import { CONTEXT_MODULES } from './modules';
import { HealthController } from './health.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), CqrsModule.forRoot(), SharedModule, ...CONTEXT_MODULES],
  controllers: [HealthController],
})
export class AppModule {}
