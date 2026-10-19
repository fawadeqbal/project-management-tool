import { Module } from '@nestjs/common';

/**
 * Workspace bounded context. Layers: application (commands/queries/handlers), infrastructure
 * (Prisma adapters, read models), presentation (controllers). See docs/ARCHITECTURE.md.
 */
@Module({})
export class WorkspaceModule {}
