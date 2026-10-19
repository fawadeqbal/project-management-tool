import type { PrismaClient, Priority, ProjectHealth, Role, TaskStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { day, type SeedContext } from './context';

/**
 * Core world for the designs: the Acme Studio workspace, its people, teams, tags, three projects and
 * every task the design references, plus ~6 weeks of completed history so dashboards have data.
 * Dates are offsets from `today` — the designs assume today = Monday Oct 19 (Oct N → N-19, Nov N → N+12).
 */

type ProjectKey = 'web' | 'brand' | 'mobile';

interface TaskSpec {
  number: number;
  title: string;
  project: ProjectKey | null;
  section?: 'Discovery' | 'Design' | 'Build';
  status: TaskStatus;
  priority: Priority;
  assignee?: string; // initials
  creator?: string; // initials (defaults to project owner)
  tags?: string[];
  start?: number;
  due?: number;
  baselineStart?: number;
  baselineDue?: number;
  hours?: number;
  points?: number;
  progress?: number;
  created?: Date;
  completed?: Date;
  description?: string;
  epic?: string;
  backlogRank?: number;
  parent?: number; // parent task number (subtasks)
}

/** Deterministic PRNG so every run seeds the same world. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function must<T>(map: Record<string, T>, key: string): T {
  const v = map[key];
  if (v === undefined) throw new Error(`Seed: unknown key "${key}"`);
  return v;
}

const ENG_DESIGN_TAGS = new Set(['Engineering', 'Design', 'Mobile', 'QA', 'SEO']);
const ENG_DESIGN_PEOPLE = new Set(['SA', 'MK', 'RT', 'NB', 'PO']);
const pointsFor = (hours: number): number => (hours <= 3 ? 1 : hours <= 5 ? 2 : hours <= 8 ? 3 : hours <= 12 ? 5 : 8);

export async function seedCore(prisma: PrismaClient, today: Date): Promise<SeedContext> {
  const rand = mulberry32(20261019);
  const ri = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1));
  const now = new Date();
  const d = (offset: number): Date => day({ today }, offset);
  const at = (offset: number, hour: number, minute = 0): Date =>
    new Date(d(offset).getTime() + (hour * 60 + minute) * 60_000);
  const notAfterNow = (date: Date): Date => (date.getTime() > now.getTime() ? now : date);
  const ago = (minutes: number): Date => new Date(now.getTime() - minutes * 60_000);

  // ───────────── Users ─────────────
  const passwordHash = bcrypt.hashSync('hearth123', 10);
  const people = [
    { initials: 'FI', name: 'Fawad Iqbal', email: 'fawad@acme.com', jobTitle: 'Product manager', avatarColor: 'blue' },
    { initials: 'SA', name: 'Sara Ahmed', email: 'sara@acme.com', jobTitle: 'Product designer', avatarColor: 'green' },
    { initials: 'MK', name: 'Mo Khan', email: 'mo@acme.com', jobTitle: 'Frontend engineer', avatarColor: 'sky' },
    { initials: 'JL', name: 'Jia Li', email: 'jia@acme.com', jobTitle: 'Content designer', avatarColor: 'violet' },
    { initials: 'RT', name: 'Ravi Teja', email: 'ravi@acme.com', jobTitle: 'Backend engineer', avatarColor: 'amber' },
    { initials: 'NB', name: 'Nadia Bashir', email: 'nadia@acme.com', jobTitle: 'QA engineer', avatarColor: 'rose' },
    { initials: 'TW', name: 'Tom Walsh', email: 'tom@northwind.co', jobTitle: 'Client (Northwind)', avatarColor: 'amber' },
    { initials: 'PO', name: 'Priya Oberoi', email: 'priya@acme.com', jobTitle: 'Product designer', avatarColor: 'slate' },
  ];
  const users: Record<string, string> = {};
  for (const p of people) {
    const u = await prisma.user.create({ data: { ...p, passwordHash, createdAt: d(-400) } });
    users[p.initials] = u.id;
  }
  const nameOf = Object.fromEntries(people.map((p) => [p.initials, p.name])) as Record<string, string>;

  // ───────────── Workspace + memberships ─────────────
  const workspace = await prisma.workspace.create({
    data: { name: 'Acme Studio', slug: 'acme-studio', keyPrefix: 'HRT', createdAt: d(-400) },
  });
  const workspaceId = workspace.id;

  const memberships: Array<{ u: string; role: Role; lastActiveAt: Date; joined: number; deactivatedAt?: Date }> = [
    { u: 'FI', role: 'OWNER', lastActiveAt: now, joined: -400 },
    { u: 'SA', role: 'ADMIN', lastActiveAt: ago(5), joined: -380 },
    { u: 'MK', role: 'MEMBER', lastActiveAt: ago(60), joined: -350 },
    { u: 'JL', role: 'MEMBER', lastActiveAt: ago(24 * 60), joined: -300 },
    { u: 'RT', role: 'MEMBER', lastActiveAt: ago(120), joined: -280 },
    { u: 'NB', role: 'MEMBER', lastActiveAt: ago(30), joined: -200 },
    { u: 'TW', role: 'GUEST', lastActiveAt: ago(3 * 24 * 60), joined: -40 },
    { u: 'PO', role: 'MEMBER', lastActiveAt: ago(47 * 24 * 60), joined: -320, deactivatedAt: ago(47 * 24 * 60) },
  ];
  await prisma.membership.createMany({
    data: memberships.map((m) => ({
      workspaceId,
      userId: must(users, m.u),
      role: m.role,
      status: m.deactivatedAt ? 'DEACTIVATED' : 'ACTIVE',
      lastActiveAt: m.lastActiveAt,
      joinedAt: d(m.joined),
      deactivatedAt: m.deactivatedAt ?? null,
    })),
  });

  // ───────────── Teams ─────────────
  const teamDefs: Array<{ name: string; color: string; members: string[] }> = [
    { name: 'Product', color: 'blue', members: ['FI'] },
    { name: 'Design', color: 'green', members: ['SA', 'PO'] },
    { name: 'Engineering', color: 'amber', members: ['MK', 'RT', 'NB'] },
    { name: 'Marketing', color: 'rose', members: ['JL'] },
  ];
  const teams: Record<string, string> = {};
  for (const t of teamDefs) {
    const team = await prisma.team.create({
      data: {
        workspaceId,
        name: t.name,
        color: t.color,
        createdAt: d(-390),
        members: { create: t.members.map((m) => ({ userId: must(users, m) })) },
      },
    });
    teams[t.name] = team.id;
  }

  // ───────────── Tags ─────────────
  const tagDefs: Array<[string, string]> = [
    ['Analytics', 'sky'], ['Content', 'violet'], ['Engineering', 'amber'], ['Design', 'blue'], ['Team', 'green'],
    ['Client', 'rose'], ['Marketing', 'violet'], ['Mobile', 'sky'], ['SEO', 'sky'], ['QA', 'green'],
    ['Meeting', 'slate'], ['Strategy', 'rose'], ['Pricing', 'amber'],
  ];
  const tags: Record<string, string> = {};
  for (const [name, color] of tagDefs) {
    const tag = await prisma.tag.create({ data: { workspaceId, name, color } });
    tags[name] = tag.id;
  }

  // ───────────── Projects ─────────────
  const projectDefs: Array<{
    key: ProjectKey; name: string; description: string; color: string; icon: string; owner: string; team: string;
    health: ProjectHealth; start: number; due: number; budget: number; wipLimits?: Record<string, number>;
  }> = [
    {
      key: 'web', name: 'Website relaunch', color: 'blue', icon: 'globe', owner: 'FI', team: 'Design', health: 'AT_RISK',
      start: -14, due: 26, budget: 71, wipLimits: { IN_PROGRESS: 4 },
      description: 'Relaunch acme.com with new pricing, navigation and homepage, shipped in light and dark mode.',
    },
    {
      key: 'brand', name: 'Q4 brand campaign', color: 'violet', icon: 'megaphone', owner: 'JL', team: 'Marketing',
      health: 'ON_TRACK', start: -20, due: 47, budget: 44,
      description: 'Holiday campaign across social, paid and email built around the new brand story.',
    },
    {
      key: 'mobile', name: 'Mobile app v2', color: 'sky', icon: 'phone', owner: 'MK', team: 'Engineering',
      health: 'OFF_TRACK', start: -35, due: 40, budget: 93,
      description: 'Swipe actions, offline mode and widgets for the iOS and Android apps.',
    },
  ];
  const projects: Record<string, string> = {};
  const projectOwner: Record<string, string> = {};
  for (const p of projectDefs) {
    const project = await prisma.project.create({
      data: {
        workspaceId,
        teamId: must(teams, p.team),
        ownerId: must(users, p.owner),
        name: p.name,
        description: p.description,
        color: p.color,
        icon: p.icon,
        health: p.health,
        startDate: d(p.start),
        dueDate: d(p.due),
        budgetUsedPct: p.budget,
        wipLimits: p.wipLimits ?? {},
        createdAt: d(p.start - 5),
      },
    });
    projects[p.key] = project.id;
    projectOwner[p.key] = p.owner;
  }
  await prisma.projectMember.create({ data: { projectId: must(projects, 'web'), userId: must(users, 'TW') } });
  await prisma.favorite.createMany({
    data: (['web', 'brand', 'mobile'] as const).map((k, position) => ({
      userId: must(users, 'FI'),
      projectId: must(projects, k),
      position,
    })),
  });

  const sections: Record<string, string> = {};
  for (const [position, name] of (['Discovery', 'Design', 'Build'] as const).entries()) {
    const s = await prisma.section.create({ data: { projectId: must(projects, 'web'), name, position } });
    sections[name] = s.id;
  }

  // ───────────── Task specs ─────────────
  // Timeline tasks: start = -7 + s, due = start + l - 1 (Oct 12 = today - 7).
  const tl = (s: number, l: number): { start: number; due: number } => ({ start: -7 + s, due: -7 + s + l - 1 });

  const specs: TaskSpec[] = [
    // Website relaunch — timeline (merged with Board / TaskPanel keys)
    { number: 170, title: 'Kickoff workshop with stakeholders', project: 'web', section: 'Discovery', status: 'DONE', priority: 'NONE', assignee: 'FI', tags: ['Meeting'], ...tl(0, 2), hours: 4 },
    { number: 173, title: 'Stakeholder interviews', project: 'web', section: 'Discovery', status: 'DONE', priority: 'MEDIUM', assignee: 'SA', tags: ['Strategy'], ...tl(2, 5), hours: 12 },
    { number: 172, title: 'Define success metrics for launch', project: 'web', section: 'Discovery', status: 'DONE', priority: 'MEDIUM', assignee: 'JL', tags: ['Strategy'], ...tl(3, 4), hours: 6 },
    { number: 176, title: 'Wireframes & IA', project: 'web', section: 'Design', status: 'IN_PROGRESS', priority: 'HIGH', assignee: 'SA', tags: ['Design'], ...tl(6, 5), progress: 70, hours: 12 },
    {
      number: 188, title: 'Design pricing page in light and dark mode', project: 'web', section: 'Design', status: 'IN_PROGRESS',
      priority: 'URGENT', assignee: 'FI', creator: 'FI', tags: ['Design', 'Pricing'], ...tl(11, 8), baselineStart: -7 + 9,
      baselineDue: -7 + 9 + 7 - 1, progress: 20, points: 5, hours: 16, created: at(-7, 10),
      description:
        'Design the new pricing page with plan cards, an annual/monthly toggle and a full plan comparison table. ' +
        'Both light and dark mode must meet WCAG AA contrast before handoff to engineering.',
    },
    { number: 204, title: 'Write new homepage copy and value props', project: 'web', section: 'Design', status: 'TODO', priority: 'HIGH', assignee: 'JL', tags: ['Content'], start: -7 + 9, due: 11, hours: 14 }, // timeline s9 l9; due per Board/Calendar (Oct 30)
    { number: 192, title: 'Build responsive navigation component', project: 'web', section: 'Build', status: 'IN_PROGRESS', priority: 'HIGH', assignee: 'MK', tags: ['Engineering'], ...tl(19, 8), hours: 16 },
    { number: 195, title: 'Set up analytics events for the new funnel', project: 'web', section: 'Build', status: 'IN_PROGRESS', priority: 'MEDIUM', assignee: 'MK', tags: ['Analytics', 'Engineering'], ...tl(23, 6), hours: 10 },
    { number: 209, title: 'QA & accessibility pass', project: 'web', section: 'Build', status: 'TODO', priority: 'HIGH', assignee: 'SA', tags: ['QA'], ...tl(27, 6), hours: 16 },
    // Website relaunch — Board
    { number: 201, title: 'Audit current site IA and map redirects', project: 'web', section: 'Discovery', status: 'TODO', priority: 'MEDIUM', assignee: 'MK', tags: ['SEO'], due: 9, hours: 8 },
    { number: 207, title: 'Collect customer logos for social proof', project: 'web', section: 'Design', status: 'TODO', priority: 'LOW', assignee: 'SA', tags: ['Design'], due: 14, hours: 3 },
    { number: 185, title: 'Accessibility pass on the signup flow', project: 'web', section: 'Build', status: 'IN_REVIEW', priority: 'HIGH', assignee: 'SA', tags: ['QA'], start: -2, due: 3, hours: 10 },
    // Main — My tasks (Fawad)
    { number: 118, title: 'Review Q3 analytics dashboard with leadership feedback', project: 'web', section: 'Discovery', status: 'IN_REVIEW', priority: 'URGENT', assignee: 'FI', tags: ['Analytics'], due: -2, hours: 4 },
    { number: 142, title: 'Write onboarding checklist copy for the first-project flow', project: 'brand', status: 'IN_PROGRESS', priority: 'HIGH', assignee: 'FI', tags: ['Content'], due: 0, hours: 5 },
    { number: 151, title: 'Fix date picker focus trap in task modal', project: 'mobile', status: 'IN_REVIEW', priority: 'MEDIUM', assignee: 'FI', tags: ['Engineering'], due: 0, hours: 3 },
    { number: 139, title: 'Approve homepage hero illustrations from the agency', project: 'web', section: 'Design', status: 'TODO', priority: 'MEDIUM', assignee: 'FI', tags: ['Design'], due: 0, hours: 2 },
    { number: 160, title: 'Draft sprint 24 retrospective agenda', project: 'mobile', status: 'TODO', priority: 'LOW', assignee: 'FI', tags: ['Team'], due: 1, hours: 2 },
    { number: 163, title: 'Prepare client walkthrough for Northwind', project: 'brand', status: 'TODO', priority: 'HIGH', assignee: 'FI', tags: ['Client'], due: 3, hours: 6 },
    { number: 174, title: 'Update pricing page comparison table', project: 'web', section: 'Design', status: 'IN_PROGRESS', priority: 'MEDIUM', assignee: 'FI', tags: ['Marketing'], due: 4, hours: 5 },
    { number: 171, title: 'QA mobile swipe gestures on Android', project: 'mobile', status: 'BLOCKED', priority: 'LOW', assignee: 'FI', tags: ['Mobile'], due: 7, hours: 4 },
    // Blocks HRT-188
    { number: 182, title: 'Final plan names from Marketing', project: 'brand', status: 'IN_PROGRESS', priority: 'HIGH', assignee: 'JL', tags: ['Pricing', 'Marketing'], start: -3, due: 3, hours: 4 },
    // Calendar items without keys (Oct N → N-19)
    { number: 165, title: 'Brand moodboard', project: 'brand', status: 'DONE', priority: 'MEDIUM', assignee: 'SA', tags: ['Design'], due: -6, hours: 6 },
    { number: 299, title: 'Sprint 23 review', project: 'mobile', status: 'DONE', priority: 'NONE', assignee: 'MK', tags: ['Meeting'], due: -3, hours: 2 },
    { number: 312, title: 'Push notification copy', project: 'mobile', status: 'TODO', priority: 'MEDIUM', assignee: 'JL', tags: ['Content', 'Mobile'], due: 4, hours: 4 },
    { number: 212, title: 'Social teaser', project: 'brand', status: 'TODO', priority: 'MEDIUM', assignee: 'SA', tags: ['Marketing', 'Design'], due: 4, hours: 6 },
    { number: 213, title: 'Ad budget review', project: 'brand', status: 'TODO', priority: 'MEDIUM', assignee: 'JL', tags: ['Marketing'], due: 4, hours: 3 },
    { number: 214, title: 'Campaign shoot', project: 'brand', status: 'TODO', priority: 'HIGH', assignee: 'SA', tags: ['Marketing'], due: 8, hours: 10 },
    // Calendar "unscheduled" tray (no dates)
    { number: 215, title: 'Refresh onboarding emails', project: 'brand', status: 'TODO', priority: 'MEDIUM', assignee: 'JL', tags: ['Content'], hours: 6 },
    { number: 216, title: 'Accessibility audit vendor', project: 'web', section: 'Build', status: 'TODO', priority: 'HIGH', assignee: 'NB', tags: ['QA'], hours: 4 },
    { number: 217, title: 'Team offsite agenda', project: 'brand', status: 'TODO', priority: 'NONE', assignee: 'FI', tags: ['Team'], hours: 3 },
    // Sprint 24 (Mobile app v2), Oct 13 – Oct 26
    { number: 301, title: 'Swipe right to complete a task', project: 'mobile', status: 'DONE', priority: 'HIGH', assignee: 'MK', tags: ['Mobile'], points: 5, start: -6, due: -3, completed: at(-4, 15), created: at(-7, 10) },
    { number: 302, title: 'Swipe left to snooze with time picker', project: 'mobile', status: 'DONE', priority: 'HIGH', assignee: 'MK', tags: ['Mobile'], points: 5, start: -5, due: -1, completed: at(-1, 14), created: at(-7, 10) },
    { number: 305, title: 'Undo toast for swipe actions', project: 'mobile', status: 'DONE', priority: 'MEDIUM', assignee: 'RT', tags: ['Mobile'], points: 3, start: -3, due: -1, completed: at(-1, 16), created: at(-7, 10) },
    { number: 306, title: 'Offline queue for task edits', project: 'mobile', status: 'IN_PROGRESS', priority: 'URGENT', assignee: 'RT', tags: ['Mobile', 'Engineering'], points: 8, start: -2, due: 2, hours: 16, created: at(-7, 10) },
    { number: 308, title: 'Sync conflict banner', project: 'mobile', status: 'IN_REVIEW', priority: 'HIGH', assignee: 'SA', tags: ['Mobile', 'Design'], points: 5, start: -3, due: 1, hours: 8, created: at(-7, 10) },
    { number: 309, title: 'Haptics on complete (iOS)', project: 'mobile', status: 'DONE', priority: 'LOW', assignee: 'MK', tags: ['Mobile'], points: 5, start: -2, due: 0, completed: notAfterNow(at(0, 9, 30)), created: at(-7, 10) },
    { number: 310, title: 'Offline indicator in header', project: 'mobile', status: 'TODO', priority: 'MEDIUM', assignee: 'SA', tags: ['Mobile', 'Design'], points: 3, start: 1, due: 3, hours: 6, created: at(-7, 10) },
    { number: 311, title: 'Background refresh for Inbox', project: 'mobile', status: 'TODO', priority: 'MEDIUM', assignee: 'RT', tags: ['Mobile', 'Engineering'], points: 8, start: 2, due: 6, hours: 14, created: at(-7, 10) },
    // Mobile backlog (no sprint)
    { number: 320, title: 'Widget for today’s tasks (iOS)', project: 'mobile', status: 'TODO', priority: 'HIGH', tags: ['Mobile'], epic: 'Widgets', points: 8, backlogRank: 1, hours: 16, created: at(-18, 11) },
    { number: 322, title: 'Quick add from share sheet', project: 'mobile', status: 'TODO', priority: 'MEDIUM', tags: ['Mobile'], epic: 'Capture', points: 5, backlogRank: 2, hours: 10, created: at(-15, 11) },
    { number: 324, title: 'Push notification grouping', project: 'mobile', status: 'TODO', priority: 'MEDIUM', tags: ['Mobile'], epic: 'Notifications', points: 3, backlogRank: 3, hours: 6, created: at(-12, 11) },
    { number: 327, title: 'Tablet two-pane layout', project: 'mobile', status: 'TODO', priority: 'LOW', tags: ['Mobile'], epic: 'Tablet', points: 13, backlogRank: 4, hours: 16, created: at(-9, 11) },
    // Extra open work — Mo and Sara overloaded mid-week (Tue–Thu)
    { number: 218, title: 'Fix nav overflow on small screens', project: 'web', section: 'Build', status: 'TODO', priority: 'HIGH', assignee: 'MK', tags: ['Engineering'], start: 0, due: 2, hours: 14 },
    { number: 313, title: 'Release candidate build for TestFlight', project: 'mobile', status: 'TODO', priority: 'HIGH', assignee: 'MK', tags: ['Mobile', 'Engineering'], start: 1, due: 3, hours: 16 },
    { number: 314, title: 'Review API pagination for task lists', project: 'mobile', status: 'TODO', priority: 'MEDIUM', assignee: 'MK', tags: ['Engineering'], start: 2, due: 3, hours: 10 },
    { number: 315, title: 'Design QA for sync conflict states', project: 'mobile', status: 'TODO', priority: 'HIGH', assignee: 'SA', tags: ['Design', 'QA'], start: 1, due: 3, hours: 12 },
    { number: 219, title: 'Icons for pricing tiers', project: 'web', section: 'Design', status: 'TODO', priority: 'MEDIUM', assignee: 'SA', tags: ['Design', 'Pricing'], start: 2, due: 3, hours: 8 },
    // Extra open work — overdue
    { number: 220, title: 'Fix broken links on legacy blog pages', project: 'web', section: 'Build', status: 'TODO', priority: 'HIGH', assignee: 'NB', tags: ['QA', 'SEO'], due: -3, hours: 5 },
    { number: 221, title: 'Migrate image CDN for marketing pages', project: 'web', section: 'Build', status: 'BLOCKED', priority: 'MEDIUM', assignee: 'RT', tags: ['Engineering'], due: -5, hours: 12 },
    { number: 222, title: 'Update brand guidelines PDF', project: 'brand', status: 'TODO', priority: 'MEDIUM', assignee: 'SA', tags: ['Design'], due: -4, hours: 6 },
    { number: 223, title: 'Proofread campaign landing copy', project: 'brand', status: 'IN_REVIEW', priority: 'HIGH', assignee: 'JL', tags: ['Content'], due: -1, hours: 3 },
    { number: 316, title: 'Crash on cold start with expired session', project: 'mobile', status: 'IN_PROGRESS', priority: 'URGENT', assignee: 'RT', tags: ['Mobile', 'Engineering'], due: -2, hours: 8 },
    { number: 317, title: 'Regression test plan for offline mode', project: 'mobile', status: 'TODO', priority: 'HIGH', assignee: 'NB', tags: ['QA', 'Mobile'], due: -2, hours: 6 },
    { number: 318, title: 'Localize app store screenshots', project: 'mobile', status: 'TODO', priority: 'LOW', assignee: 'JL', tags: ['Mobile', 'Marketing'], due: -3, hours: 4 },
    { number: 225, title: 'Verify 301 redirects on staging', project: 'web', section: 'Build', status: 'TODO', priority: 'MEDIUM', assignee: 'NB', tags: ['QA', 'SEO'], due: -1, hours: 4 },
    { number: 224, title: 'Draft November newsletter', project: 'brand', status: 'TODO', priority: 'LOW', assignee: 'JL', tags: ['Content', 'Marketing'], due: 6, hours: 4 },
  ];

  // HRT-188 subtasks
  specs.push(
    { number: 189, title: 'Light mode comps', project: 'web', section: 'Design', parent: 188, status: 'DONE', priority: 'NONE', assignee: 'FI', creator: 'FI', start: -6, due: -3, hours: 6, completed: at(-3, 17) },
    { number: 190, title: 'Plan comparison table', project: 'web', section: 'Design', parent: 188, status: 'DONE', priority: 'NONE', assignee: 'FI', creator: 'FI', start: -4, due: -2, hours: 4, completed: at(-2, 15) },
    { number: 191, title: 'Dark mode contrast fixes', project: 'web', section: 'Design', parent: 188, status: 'TODO', priority: 'NONE', assignee: 'FI', creator: 'FI', start: 4, due: 7, hours: 4 },
    { number: 193, title: 'Handoff specs and tokens', project: 'web', section: 'Design', parent: 188, status: 'TODO', priority: 'NONE', assignee: 'FI', creator: 'FI', start: 8, due: 11, hours: 6 },
  );

  // ~6 weeks of completed history (HRT-83..117, numbered in creation order)
  const history: Array<[ProjectKey, string, string, string[]]> = [
    ['mobile', 'Spike: offline storage options', 'RT', ['Engineering', 'Mobile']],
    ['brand', 'Agency briefing for Q4 campaign', 'JL', ['Marketing']],
    ['web', 'Inventory existing page templates', 'SA', ['Design']],
    ['mobile', 'Design swipe gesture interactions', 'SA', ['Design', 'Mobile']],
    ['web', 'Set up staging environment for relaunch', 'RT', ['Engineering']],
    ['mobile', 'Set up crash reporting for beta builds', 'RT', ['Engineering', 'Mobile']],
    ['brand', 'Finalize campaign messaging pillars', 'JL', ['Strategy', 'Marketing']],
    ['web', 'Competitive pricing page review', 'FI', ['Pricing', 'Strategy']],
    ['mobile', 'Upgrade React Native to latest', 'MK', ['Engineering', 'Mobile']],
    ['brand', 'Review agency mood directions', 'SA', ['Design']],
    ['web', 'Draft content migration plan', 'JL', ['Content']],
    ['mobile', 'Fix keyboard covering comment input', 'MK', ['Engineering', 'Mobile']],
    ['web', 'Configure CMS content types', 'RT', ['Engineering']],
    ['mobile', 'Write test cases for swipe actions', 'NB', ['QA', 'Mobile']],
    ['brand', 'Book photographer for campaign shoot', 'FI', ['Marketing']],
    ['web', 'Run tree test on proposed navigation', 'SA', ['Design']],
    ['mobile', 'Implement pull-to-refresh on task list', 'MK', ['Engineering', 'Mobile']],
    ['brand', 'Draft social calendar for November', 'JL', ['Marketing', 'Content']],
    ['web', 'Audit Core Web Vitals on current site', 'MK', ['Engineering', 'SEO']],
    ['mobile', 'Beta feedback triage', 'FI', ['Mobile']],
    ['brand', 'Approve campaign budget split', 'FI', ['Marketing', 'Strategy']],
    ['web', 'Write SEO keyword brief', 'JL', ['SEO', 'Content']],
    ['mobile', 'Add deep links for task notifications', 'RT', ['Engineering', 'Mobile']],
    ['web', 'Set up visual regression tests', 'NB', ['QA', 'Engineering']],
    ['brand', 'Write launch blog post outline', 'JL', ['Content']],
    ['mobile', 'Accessibility labels for task rows', 'NB', ['QA', 'Mobile']],
    ['web', 'Create design tokens for light and dark themes', 'SA', ['Design']],
    ['brand', 'Design campaign key visual options', 'SA', ['Design', 'Marketing']],
    ['mobile', 'Dark mode pass on settings screens', 'SA', ['Design', 'Mobile']],
    ['web', 'Implement new footer component', 'MK', ['Engineering']],
    ['brand', 'Set up UTM conventions for campaign links', 'RT', ['Analytics', 'Marketing']],
    ['mobile', 'Sprint 22 retrospective', 'FI', ['Meeting', 'Team']],
    ['web', 'Cross-browser smoke test of prototype', 'NB', ['QA']],
    ['brand', 'Legal review of campaign claims', 'FI', ['Strategy']],
    ['mobile', 'Performance profiling of task list', 'MK', ['Engineering', 'Mobile']],
  ];
  const priorities: Priority[] = ['HIGH', 'MEDIUM', 'MEDIUM', 'LOW', 'URGENT', 'MEDIUM', 'NONE'];
  history.forEach(([project, title, assignee, tagNames], i) => {
    const created = -45 + Math.round((i * 39) / (history.length - 1)); // -45 .. -6
    const start = created + ri(1, 2);
    const due = start + ri(2, 6);
    const late = i % 7 === 3; // ~14% late
    const doneDay = Math.min(late ? due + ri(1, 2) : start + ri(1, Math.max(1, due - start)), -1);
    const section =
      project === 'web'
        ? assignee === 'SA' ? 'Design' : ['RT', 'MK', 'NB'].includes(assignee) ? 'Build' : 'Discovery'
        : undefined;
    specs.push({
      number: 83 + i,
      title,
      project,
      ...(section ? { section } : {}),
      status: 'DONE',
      priority: priorities[i % priorities.length] ?? 'MEDIUM',
      assignee,
      tags: tagNames,
      start,
      due,
      created: at(created, ri(9, 16), ri(0, 59)),
      completed: at(doneDay, ri(10, 18), ri(0, 59)),
    });
  });

  // ───────────── Create tasks ─────────────
  const seen = new Set<number>();
  for (const s of specs) {
    if (seen.has(s.number)) throw new Error(`Seed: duplicate task number HRT-${s.number}`);
    seen.add(s.number);
  }

  const tasks: Record<string, string> = {};
  const taskKey = (n: number): string => `HRT-${n}`;
  const boardPos: Record<string, number> = {};
  const listPos: Record<string, number> = {};
  const followers: Array<{ taskId: string; userId: string }> = [];

  for (const s of specs) {
    const done = s.status === 'DONE';
    const hours = s.hours ?? ri(2, 16);
    const start = s.start ?? (s.due !== undefined ? s.due - ri(1, 3) : undefined);
    const createdOffset = Math.min((start ?? s.due ?? -5) - ri(2, 5), -1);
    const createdAt = s.created ?? at(createdOffset, ri(9, 17), ri(0, 59));
    const completedAt = done ? notAfterNow(s.completed ?? at(s.due ?? start ?? -1, ri(11, 17))) : null;
    const engDesign =
      s.project === 'mobile' ||
      (s.tags ?? []).some((t) => ENG_DESIGN_TAGS.has(t)) ||
      (s.assignee !== undefined && ENG_DESIGN_PEOPLE.has(s.assignee));
    const points = s.points ?? (engDesign ? pointsFor(hours) : null);
    const creator = s.creator ?? (s.project ? must(projectOwner, s.project) : 'FI');

    const groupKey = `${s.project ?? '-'}:${s.status}`;
    const bp = boardPos[groupKey] ?? 0;
    boardPos[groupKey] = bp + 1;
    const listKey = s.parent !== undefined ? `sub:${s.parent}` : `${s.project ?? '-'}:${s.section ?? '-'}`;
    const lp = listPos[listKey] ?? 0;
    listPos[listKey] = lp + 1;

    const task = await prisma.task.create({
      data: {
        workspaceId,
        projectId: s.project ? must(projects, s.project) : null,
        sectionId: s.section ? must(sections, s.section) : null,
        parentId: s.parent !== undefined ? must(tasks, taskKey(s.parent)) : null,
        number: s.number,
        title: s.title,
        description: s.description ?? null,
        status: s.status,
        priority: s.priority,
        assigneeId: s.assignee ? must(users, s.assignee) : null,
        creatorId: must(users, creator),
        startDate: start !== undefined ? d(start) : null,
        dueDate: s.due !== undefined ? d(s.due) : null,
        baselineStart: s.baselineStart !== undefined ? d(s.baselineStart) : null,
        baselineDue: s.baselineDue !== undefined ? d(s.baselineDue) : null,
        estimatePoints: points,
        estimateHours: hours,
        progress: done ? 100 : (s.progress ?? 0),
        boardPosition: (bp + 1) * 1000,
        listPosition: (lp + 1) * 1000,
        backlogRank: s.backlogRank ?? null,
        epic: s.epic ?? null,
        completedAt,
        createdAt,
        tags: { create: (s.tags ?? []).map((t) => ({ tagId: must(tags, t) })) },
      },
    });
    tasks[taskKey(s.number)] = task.id;
    followers.push({ taskId: task.id, userId: must(users, creator) });
    if (s.assignee) followers.push({ taskId: task.id, userId: must(users, s.assignee) });
  }

  const t = (n: number): string => must(tasks, taskKey(n));

  // HRT-188 followers: FI, SA, MK
  for (const u of ['FI', 'SA', 'MK']) followers.push({ taskId: t(188), userId: must(users, u) });
  await prisma.taskFollower.createMany({ data: followers, skipDuplicates: true });

  // ───────────── Dependencies + milestones ─────────────
  await prisma.taskDependency.createMany({
    data: [
      [176, 188], // Wireframes & IA → Pricing page design
      [188, 192], // Pricing page design → Responsive navigation
      [192, 195], // Responsive navigation → Analytics events
      [192, 209], // Responsive navigation → QA & accessibility pass
      [182, 188], // Final plan names → Pricing page design
    ].map(([blocker, blocked]) => ({ blockerId: t(blocker!), blockedId: t(blocked!) })),
  });

  const planApproved = await prisma.milestone.create({
    data: { projectId: must(projects, 'web'), name: 'Plan approved', date: d(2) },
  });
  const launch = await prisma.milestone.create({
    data: { projectId: must(projects, 'web'), name: 'Launch', date: d(26) },
  });
  await prisma.milestoneDependency.createMany({
    data: [
      { milestoneId: planApproved.id, taskId: t(172) },
      { milestoneId: launch.id, taskId: t(209) },
    ],
  });

  // ───────────── HRT-188 comments + activity ─────────────
  const comments: Array<[string, number, string]> = [
    ['SA', 120, '@Fawad the annual toggle label is 3.9:1 in dark mode — can we move it to the secondary text token?'],
    ['FI', 60, 'Good catch — switching to text-secondary now.'],
    ['MK', 40, 'Nav is ready for the new pricing link once this lands.'],
  ];
  for (const [author, minutesAgo, body] of comments) {
    await prisma.comment.create({
      data: { taskId: t(188), authorId: must(users, author), body, createdAt: ago(minutesAgo) },
    });
  }

  const key188 = 'HRT-188';
  const title188 = 'Design pricing page in light and dark mode';
  await prisma.activity.createMany({
    data: [
      { type: 'task.created', createdAt: at(-7, 10), payload: { key: key188, title: title188, from: null, to: null } },
      { type: 'task.assigned', createdAt: at(-7, 10, 2), payload: { key: key188, title: title188, from: null, to: nameOf.FI } },
      { type: 'task.status_changed', createdAt: at(-5, 11), payload: { key: key188, title: title188, from: 'TODO', to: 'IN_PROGRESS' } },
    ].map((a) => ({ ...a, workspaceId, taskId: t(188), actorId: must(users, 'FI') })),
  });

  // ───────────── Workspace task sequence ─────────────
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { taskSeq: Math.max(...specs.map((s) => s.number)) },
  });

  return { today, workspaceId, keyPrefix: 'HRT', users, projects, teams, tasks, tags };
}
