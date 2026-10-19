import type { PrismaClient } from '@prisma/client';
import type { SeedContext } from './context';

/** Seed data for the inbox context (owned by its feature stream). */
export async function seedInbox(_prisma: PrismaClient, _ctx: SeedContext): Promise<void> {}
