import { Prisma } from '@prisma/client';

/** True for a unique-constraint violation (P2002), optionally on a given set of columns. */
export const isUniqueViolation = (e: unknown, fields?: readonly string[]): boolean => {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') return false;
  if (!fields) return true;
  const target = (e.meta as { target?: unknown } | undefined)?.target;
  const names = Array.isArray(target) ? target.map(String) : typeof target === 'string' ? [target] : [];
  // Postgres reports either the column list or the index name; accept both.
  return names.length === 0 || fields.every((f) => names.some((n) => n === f || n.includes(f)));
};
