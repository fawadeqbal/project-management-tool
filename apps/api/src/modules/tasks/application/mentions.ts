/**
 * Matching "@sara", "@SA", "@sara.ahmed" and "#website" handles to people and projects.
 * Shared by quick add, comments (write side) and the detail read model (mention display).
 */

export interface MentionCandidate {
  id: string;
  name: string;
  initials: string;
  email?: string | null;
}

const firstName = (name: string): string => (name.trim().split(/\s+/)[0] ?? '').toLowerCase();
const emailLocal = (email?: string | null): string | null => (email ? (email.split('@')[0] ?? '').toLowerCase() : null);
const cleanHandle = (handle: string): string => handle.toLowerCase().replace(/^[@#]/, '').replace(/[.\-_]+$/, '');

/** "@Fawad, can you…" → ['fawad']. Handles are lowercased and de-duplicated. */
export const mentionHandles = (body: string): string[] => {
  const handles = [...body.matchAll(/(?:^|[^\p{L}\d@._-])@([\p{L}\d._-]+)/gu)].map((m) => cleanHandle(m[1] ?? '')).filter(Boolean);
  return [...new Set(handles)];
};

/**
 * Exact match on first name, initials or email local part; with `allowPrefix`, falls back to a
 * first-name prefix ("@sa" → Sara) when exactly one person matches.
 */
export const matchMember = <T extends MentionCandidate>(handle: string, members: readonly T[], allowPrefix = false): T | null => {
  const h = cleanHandle(handle);
  if (!h) return null;
  const exact =
    members.find((m) => firstName(m.name) === h) ??
    members.find((m) => m.initials.toLowerCase() === h) ??
    members.find((m) => emailLocal(m.email) === h);
  if (exact || !allowPrefix) return exact ?? null;
  const prefixed = members.filter((m) => firstName(m.name).startsWith(h));
  return prefixed.length >= 1 ? prefixed[0]! : null;
};

/** Every distinct member mentioned in a comment body. */
export const resolveMentions = <T extends MentionCandidate>(body: string, members: readonly T[]): T[] => {
  const found = new Map<string, T>();
  for (const handle of mentionHandles(body)) {
    const m = matchMember(handle, members);
    if (m) found.set(m.id, m);
  }
  return [...found.values()];
};

const slug = (s: string): string => s.toLowerCase().replace(/[^\p{L}\d]+/gu, '');
const words = (s: string): string[] => s.toLowerCase().split(/[^\p{L}\d]+/u).filter(Boolean);

/** "#website" → "Website relaunch": exact slug, then slug prefix, then any word prefix. */
export const matchProject = <T extends { id: string; name: string }>(handle: string, projects: readonly T[]): T | null => {
  const h = slug(handle);
  if (!h) return null;
  return (
    projects.find((p) => slug(p.name) === h) ??
    projects.find((p) => slug(p.name).startsWith(h)) ??
    projects.find((p) => words(p.name).some((w) => w.startsWith(h))) ??
    null
  );
};
