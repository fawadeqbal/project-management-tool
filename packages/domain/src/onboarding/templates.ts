import type { AccentColor, Priority } from '../task/values';

export interface TemplateTask {
  title: string;
  section: string;
  priority?: Priority;
  /** Due date as a day offset from the day the template is applied. */
  dueInDays?: number;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: AccentColor;
  sections: string[];
  tasks: TemplateTask[];
  /** Shown first on Home (the design's three). */
  featured?: boolean;
}

/**
 * Starter project templates ("templates beat the blank page"). Configuration, not code: adding a
 * template is a new entry here.
 */
export const PROJECT_TEMPLATES: readonly ProjectTemplate[] = [
  {
    id: 'product-sprint',
    name: 'Product sprint',
    description: 'Backlog, 2-week sprints, burndown',
    icon: 'board',
    color: 'sky',
    featured: true,
    sections: ['Backlog', 'This sprint', 'Done'],
    tasks: [
      { title: 'Write the sprint goal', section: 'This sprint', priority: 'HIGH', dueInDays: 1 },
      { title: 'Groom the top 10 backlog items', section: 'Backlog', priority: 'MEDIUM', dueInDays: 2 },
      { title: 'Estimate stories with the team', section: 'Backlog', priority: 'MEDIUM', dueInDays: 3 },
      { title: 'Sprint planning meeting', section: 'This sprint', priority: 'HIGH', dueInDays: 3 },
      { title: 'Mid-sprint check-in', section: 'This sprint', priority: 'LOW', dueInDays: 8 },
      { title: 'Sprint review and demo', section: 'This sprint', priority: 'MEDIUM', dueInDays: 14 },
      { title: 'Retrospective', section: 'This sprint', priority: 'MEDIUM', dueInDays: 14 },
    ],
  },
  {
    id: 'marketing-campaign',
    name: 'Marketing campaign',
    description: 'Brief → content calendar → launch',
    icon: 'calendar-view',
    color: 'violet',
    featured: true,
    sections: ['Brief', 'Content', 'Launch'],
    tasks: [
      { title: 'Write the campaign brief', section: 'Brief', priority: 'HIGH', dueInDays: 2 },
      { title: 'Agree on audience and key message', section: 'Brief', priority: 'HIGH', dueInDays: 4 },
      { title: 'Build the content calendar', section: 'Content', priority: 'MEDIUM', dueInDays: 7 },
      { title: 'Draft launch blog post', section: 'Content', priority: 'MEDIUM', dueInDays: 10 },
      { title: 'Design social assets', section: 'Content', priority: 'MEDIUM', dueInDays: 12 },
      { title: 'Schedule launch emails', section: 'Launch', priority: 'MEDIUM', dueInDays: 14 },
      { title: 'Launch day', section: 'Launch', priority: 'URGENT', dueInDays: 21 },
      { title: 'Report on results', section: 'Launch', priority: 'LOW', dueInDays: 28 },
    ],
  },
  {
    id: 'client-project',
    name: 'Client project',
    description: 'Milestones, approvals, guest portal',
    icon: 'users',
    color: 'green',
    featured: true,
    sections: ['Kickoff', 'Delivery', 'Sign-off'],
    tasks: [
      { title: 'Kickoff meeting with the client', section: 'Kickoff', priority: 'HIGH', dueInDays: 2 },
      { title: 'Confirm scope and milestones', section: 'Kickoff', priority: 'HIGH', dueInDays: 5 },
      { title: 'Invite the client as a guest', section: 'Kickoff', priority: 'MEDIUM', dueInDays: 5 },
      { title: 'First draft for review', section: 'Delivery', priority: 'MEDIUM', dueInDays: 14 },
      { title: 'Client approval round', section: 'Delivery', priority: 'MEDIUM', dueInDays: 18 },
      { title: 'Final delivery and sign-off', section: 'Sign-off', priority: 'HIGH', dueInDays: 30 },
    ],
  },
  {
    id: 'website-launch',
    name: 'Website launch',
    description: 'Sitemap, design, build, QA, go live',
    icon: 'globe',
    color: 'blue',
    sections: ['Discovery', 'Design', 'Build', 'Launch'],
    tasks: [
      { title: 'Kickoff meeting', section: 'Discovery', priority: 'HIGH', dueInDays: 1 },
      { title: 'Audit the current site', section: 'Discovery', priority: 'MEDIUM', dueInDays: 4 },
      { title: 'Draft the sitemap', section: 'Discovery', priority: 'MEDIUM', dueInDays: 6 },
      { title: 'Homepage wireframes', section: 'Design', priority: 'MEDIUM', dueInDays: 10 },
      { title: 'Visual design for key pages', section: 'Design', priority: 'HIGH', dueInDays: 15 },
      { title: 'Build page templates', section: 'Build', priority: 'MEDIUM', dueInDays: 24 },
      { title: 'Migrate content', section: 'Build', priority: 'MEDIUM', dueInDays: 28 },
      { title: 'QA on mobile and desktop', section: 'Launch', priority: 'HIGH', dueInDays: 32 },
      { title: 'Set up redirects', section: 'Launch', priority: 'MEDIUM', dueInDays: 33 },
      { title: 'Go live', section: 'Launch', priority: 'URGENT', dueInDays: 35 },
    ],
  },
  {
    id: 'team-onboarding',
    name: 'Employee onboarding',
    description: 'First day, first week, first month',
    icon: 'user-plus',
    color: 'amber',
    sections: ['Before day one', 'First week', 'First month'],
    tasks: [
      { title: 'Prepare laptop and accounts', section: 'Before day one', priority: 'HIGH', dueInDays: 2 },
      { title: 'Send the welcome email', section: 'Before day one', priority: 'MEDIUM', dueInDays: 3 },
      { title: 'Introductions with the team', section: 'First week', priority: 'MEDIUM', dueInDays: 7 },
      { title: 'Pick a first small project', section: 'First week', priority: 'MEDIUM', dueInDays: 9 },
      { title: '30-day check-in', section: 'First month', priority: 'LOW', dueInDays: 30 },
    ],
  },
  {
    id: 'event-planning',
    name: 'Event planning',
    description: 'Venue, speakers, promotion, day-of run sheet',
    icon: 'calendar',
    color: 'rose',
    sections: ['Plan', 'Promote', 'Run'],
    tasks: [
      { title: 'Set the budget and date', section: 'Plan', priority: 'HIGH', dueInDays: 3 },
      { title: 'Book the venue', section: 'Plan', priority: 'HIGH', dueInDays: 10 },
      { title: 'Confirm speakers', section: 'Plan', priority: 'MEDIUM', dueInDays: 14 },
      { title: 'Open registration', section: 'Promote', priority: 'MEDIUM', dueInDays: 16 },
      { title: 'Write the day-of run sheet', section: 'Run', priority: 'MEDIUM', dueInDays: 25 },
    ],
  },
];

export const findTemplate = (id: string): ProjectTemplate | undefined => PROJECT_TEMPLATES.find((t) => t.id === id);
