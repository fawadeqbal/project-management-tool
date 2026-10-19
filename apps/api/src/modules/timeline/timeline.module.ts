import { Module } from '@nestjs/common';

/**
 * Timeline bounded context. Layers: application (commands/queries/handlers), infrastructure
 * (Prisma adapters, read models), presentation (controllers). See docs/ARCHITECTURE.md.
 */
@Module({})
export class TimelineModule {}
