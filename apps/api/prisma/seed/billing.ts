import type { PrismaClient } from '@prisma/client';
import type { SeedContext } from './context';

/** Seed data for the billing context (owned by its feature stream). */
export async function seedBilling(_prisma: PrismaClient, _ctx: SeedContext): Promise<void> {}
