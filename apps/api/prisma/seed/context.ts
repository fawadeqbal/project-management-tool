/**
 * Ids produced by the core seed, handed to each context's seed so they can attach data to the
 * same world (the Acme Studio workspace from the designs). Dates are relative to `today`.
 */
export interface SeedContext {
  today: Date;
  workspaceId: string;
  keyPrefix: string;
  /** Users by initials: FI, SA, MK, JL, RT, NB, TW, PO. */
  users: Record<string, string>;
  /** Projects by short key: web (Website relaunch), brand (Q4 brand campaign), mobile (Mobile app v2). */
  projects: Record<string, string>;
  /** Teams by name: Design, Engineering, Marketing, Product. */
  teams: Record<string, string>;
  /** Task ids by key, e.g. 'HRT-188'. */
  tasks: Record<string, string>;
  /** Tag ids by name. */
  tags: Record<string, string>;
}

/** Calendar day offset from today (midnight UTC). */
export const day = (ctx: Pick<SeedContext, 'today'>, offset: number): Date =>
  new Date(Date.UTC(ctx.today.getUTCFullYear(), ctx.today.getUTCMonth(), ctx.today.getUTCDate() + offset));
