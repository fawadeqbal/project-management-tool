import { AggregateRoot } from '../shared/entity';
import { createEvent } from '../shared/domain-event';
import { NotFoundError, ValidationError } from '../shared/errors';
import { Guard } from '../shared/guard';
import { startOfDay, toDateOnly } from '../shared/dates';
import { isAccentColor, type AccentColor, type TaskStatus, TASK_STATUSES } from '../task/values';
import { PROJECT_HEALTH, type ProjectHealth } from './project-health';

export type WipLimits = Partial<Record<TaskStatus, number>>;

export interface SectionProps {
  id: string;
  name: string;
  position: number;
}

export interface ProjectProps {
  workspaceId: string;
  ownerId: string;
  teamId: string | null;
  name: string;
  description: string | null;
  color: AccentColor;
  icon: string;
  health: ProjectHealth;
  startDate: Date | null;
  dueDate: Date | null;
  wipLimits: WipLimits;
  sections: SectionProps[];
}

export const PROJECT_NAME_MAX = 80;
export const SECTION_NAME_MAX = 60;
export const WIP_LIMIT_MAX = 99;

/** Parses the persisted JSON (`{ "IN_PROGRESS": 4 }`) into valid limits, dropping anything malformed. */
export const parseWipLimits = (raw: unknown): WipLimits => {
  if (!raw || typeof raw !== 'object') return {};
  const out: WipLimits = {};
  for (const s of TASK_STATUSES) {
    const v = (raw as Record<string, unknown>)[s];
    if (s !== 'DONE' && typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= WIP_LIMIT_MAX) out[s] = v;
  }
  return out;
};

/**
 * Project aggregate. Protects: a non-blank name, due on/after start, WIP limits only on open
 * columns within 1–99, and a dense 0..n-1 ordering of sections (Timeline and List rows follow it).
 */
export class Project extends AggregateRoot<ProjectProps> {
  private constructor(id: string, props: ProjectProps) {
    super(id, props);
  }

  static create(
    input: {
      id: string;
      workspaceId: string;
      ownerId: string;
      name: string;
      description?: string | null;
      color?: string;
      icon?: string;
      teamId?: string | null;
      startDate?: Date | null;
      dueDate?: Date | null;
    },
    now: Date,
  ): Project {
    const startDate = input.startDate ? startOfDay(input.startDate) : null;
    const dueDate = input.dueDate ? startOfDay(input.dueDate) : null;
    Project.assertDates(startDate, dueDate);
    const project = new Project(input.id, {
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
      teamId: input.teamId ?? null,
      name: Project.validName(input.name),
      description: input.description?.trim() || null,
      color: isAccentColor(input.color) ? input.color : 'blue',
      icon: input.icon?.trim() || 'folder',
      health: 'ON_TRACK',
      startDate,
      dueDate,
      wipLimits: {},
      sections: [],
    });
    project.record(
      createEvent('project.created', project.base(input.ownerId, now), {
        name: project.props.name,
        teamId: project.props.teamId,
        ownerId: input.ownerId,
      }),
    );
    return project;
  }

  static restore(id: string, props: ProjectProps): Project {
    const sections = [...props.sections].sort((a, b) => a.position - b.position).map((s, position) => ({ ...s, position }));
    return new Project(id, { ...props, wipLimits: { ...props.wipLimits }, sections });
  }

  get workspaceId() {
    return this.props.workspaceId;
  }
  get ownerId() {
    return this.props.ownerId;
  }
  get name() {
    return this.props.name;
  }
  get sections(): readonly SectionProps[] {
    return this.props.sections;
  }
  get wipLimits(): Readonly<WipLimits> {
    return this.props.wipLimits;
  }

  toSnapshot(): Readonly<ProjectProps & { id: string }> {
    return { ...this.props, sections: this.props.sections.map((s) => ({ ...s })), wipLimits: { ...this.props.wipLimits }, id: this.id };
  }

  /** Applies a partial edit; records one `project.updated` with the changed field names. */
  update(
    patch: {
      name?: string;
      description?: string | null;
      color?: string;
      icon?: string;
      teamId?: string | null;
      startDate?: Date | null;
      dueDate?: Date | null;
      health?: ProjectHealth;
      wipLimits?: Partial<Record<TaskStatus, number | null>>;
    },
    actorId: string,
    now: Date,
  ): string[] {
    const changed: string[] = [];
    if (patch.name !== undefined) {
      const name = Project.validName(patch.name);
      if (name !== this.props.name) changed.push('name');
      this.props.name = name;
    }
    if (patch.description !== undefined) {
      const description = patch.description?.trim() || null;
      if (description !== this.props.description) changed.push('description');
      this.props.description = description;
    }
    if (patch.color !== undefined) {
      if (!isAccentColor(patch.color)) throw new ValidationError('project.color', 'Pick one of the project colors.', { field: 'color' });
      if (patch.color !== this.props.color) changed.push('color');
      this.props.color = patch.color;
    }
    if (patch.icon !== undefined) {
      const icon = Guard.notBlank(patch.icon, 'icon');
      if (icon !== this.props.icon) changed.push('icon');
      this.props.icon = icon;
    }
    if (patch.teamId !== undefined && patch.teamId !== this.props.teamId) {
      this.props.teamId = patch.teamId;
      changed.push('team');
    }
    if (patch.startDate !== undefined || patch.dueDate !== undefined) {
      const start = patch.startDate !== undefined ? (patch.startDate ? startOfDay(patch.startDate) : null) : this.props.startDate;
      const due = patch.dueDate !== undefined ? (patch.dueDate ? startOfDay(patch.dueDate) : null) : this.props.dueDate;
      Project.assertDates(start, due);
      if (!sameDay(start, this.props.startDate)) changed.push('startDate');
      if (!sameDay(due, this.props.dueDate)) changed.push('dueDate');
      this.props.startDate = start;
      this.props.dueDate = due;
    }
    if (patch.wipLimits !== undefined && this.setWipLimits(patch.wipLimits)) changed.push('wipLimits');
    if (patch.health !== undefined && patch.health !== this.props.health) {
      if (!PROJECT_HEALTH.includes(patch.health)) throw new ValidationError('project.health', 'Choose On track, At risk or Off track.');
      const from = this.props.health;
      this.props.health = patch.health;
      changed.push('health');
      this.record(createEvent('project.health_changed', this.base(actorId, now), { name: this.props.name, from, to: patch.health }));
    }
    if (changed.length) this.record(createEvent('project.updated', this.base(actorId, now), { name: this.props.name, fields: changed }));
    return changed;
  }

  /** Merges limits; `null` removes a column's limit. Returns true when anything changed. */
  private setWipLimits(limits: Partial<Record<TaskStatus, number | null>>): boolean {
    const next: WipLimits = { ...this.props.wipLimits };
    for (const [status, value] of Object.entries(limits) as [TaskStatus, number | null | undefined][]) {
      if (!TASK_STATUSES.includes(status)) continue;
      if (value == null) {
        delete next[status];
        continue;
      }
      if (status === 'DONE') throw new ValidationError('project.wip_done', 'The Done column can’t have a WIP limit.', { field: 'wipLimits' });
      if (!Number.isInteger(value) || value < 1 || value > WIP_LIMIT_MAX)
        throw new ValidationError('project.wip_range', `Use a WIP limit between 1 and ${WIP_LIMIT_MAX}.`, { field: 'wipLimits' });
      next[status] = value;
    }
    const before = JSON.stringify(sortKeys(this.props.wipLimits));
    this.props.wipLimits = next;
    return before !== JSON.stringify(sortKeys(next));
  }

  // ── Sections ───────────────────────────────────────────────

  addSection(id: string, name: string, beforeId: string | null | undefined, actorId: string, now: Date): SectionProps {
    const clean = Project.validSectionName(name);
    this.assertUniqueSection(clean);
    const list = [...this.props.sections];
    const index = beforeId ? list.findIndex((s) => s.id === beforeId) : -1;
    const section: SectionProps = { id, name: clean, position: 0 };
    if (index >= 0) list.splice(index, 0, section);
    else list.push(section);
    this.props.sections = renumber(list);
    this.record(createEvent('project.section_added', this.base(actorId, now), { sectionId: id, name: clean }));
    return this.props.sections.find((s) => s.id === id)!;
  }

  renameSection(sectionId: string, name: string, actorId: string, now: Date): void {
    const section = this.section(sectionId);
    const clean = Project.validSectionName(name);
    if (clean === section.name) return;
    this.assertUniqueSection(clean, sectionId);
    section.name = clean;
    this.record(createEvent('project.section_renamed', this.base(actorId, now), { sectionId, name: clean }));
  }

  /** Moves a section to `index` (clamped); positions stay dense 0..n-1. */
  moveSection(sectionId: string, index: number, actorId: string, now: Date): void {
    const list = [...this.props.sections];
    const from = list.findIndex((s) => s.id === sectionId);
    if (from < 0) throw new NotFoundError('Section', sectionId);
    const to = Math.max(0, Math.min(list.length - 1, Math.floor(index)));
    if (from === to) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved!);
    this.props.sections = renumber(list);
    this.record(createEvent('project.section_moved', this.base(actorId, now), { sectionId, position: to }));
  }

  /** Removes a section; its tasks fall back to "No section" (the FK is SET NULL). */
  removeSection(sectionId: string, actorId: string, now: Date): void {
    const section = this.section(sectionId);
    this.props.sections = renumber(this.props.sections.filter((s) => s.id !== sectionId));
    this.record(createEvent('project.section_removed', this.base(actorId, now), { sectionId, name: section.name }));
  }

  private section(id: string): SectionProps {
    const s = this.props.sections.find((x) => x.id === id);
    if (!s) throw new NotFoundError('Section', id);
    return s;
  }

  private assertUniqueSection(name: string, exceptId?: string): void {
    if (this.props.sections.some((s) => s.id !== exceptId && s.name.toLowerCase() === name.toLowerCase()))
      throw new ValidationError('section.duplicate', `There’s already a “${name}” section in this project — pick another name.`, { field: 'name' });
  }

  private static validName(name: string): string {
    return Guard.maxLength(Guard.notBlank(name, 'name'), PROJECT_NAME_MAX, 'name');
  }

  private static validSectionName(name: string): string {
    return Guard.maxLength(Guard.notBlank(name, 'name'), SECTION_NAME_MAX, 'name');
  }

  private static assertDates(start: Date | null, due: Date | null): void {
    if (start && due && due.getTime() < start.getTime())
      throw new ValidationError('project.dates', 'The due date has to be on or after the start date.', { field: 'dueDate' });
  }

  private base(actorId: string, now: Date) {
    return { workspaceId: this.props.workspaceId, actorId, aggregateId: this.id, occurredAt: now };
  }

  /** "YYYY-MM-DD" helpers for adapters. */
  get startDateOnly(): string | null {
    return this.props.startDate ? toDateOnly(this.props.startDate) : null;
  }
  get dueDateOnly(): string | null {
    return this.props.dueDate ? toDateOnly(this.props.dueDate) : null;
  }
}

const renumber = (list: SectionProps[]): SectionProps[] => list.map((s, position) => ({ ...s, position }));
const sameDay = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);
const sortKeys = (o: object) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

/** Persistence port for the Project aggregate (sections included). */
export interface ProjectRepository {
  nextId(): string;
  nextSectionId(): string;
  findById(workspaceId: string, id: string): Promise<Project | null>;
  /** Finds the project that owns a section. */
  findBySectionId(workspaceId: string, sectionId: string): Promise<Project | null>;
  save(project: Project): Promise<void>;
}

export const PROJECT_REPOSITORY = Symbol('ProjectRepository');
