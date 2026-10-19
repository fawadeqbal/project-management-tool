import type { PrismaClient } from '@prisma/client';
import type { SeedContext } from './context';

/** Seed data for the planning context (owned by its feature stream). */
export async function seedPlanning(_prisma: PrismaClient, _ctx: SeedContext): Promise<void> {}
