import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { QuickAddTaskInput, TaskDto } from '@hearth/contracts';
import { parseQuickAdd, type Actor, type Clock, type ParsedQuickAdd } from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { TaskReadModel } from '../../infrastructure/task.read-model';
import { TaskCreationService } from '../task-creation.service';
import { TASK_DIRECTORY, type TaskDirectory } from '../ports';
import { matchMember, matchProject } from '../mentions';

export class QuickAddTaskCommand {
  constructor(
    readonly actor: Actor,
    readonly input: QuickAddTaskInput,
  ) {}
}

/**
 * "Draft retro agenda @sara #website !high tomorrow" → a task assigned to Sara in Website
 * relaunch, high priority, due tomorrow. Handles that match nobody stay in the title.
 */
@CommandHandler(QuickAddTaskCommand)
export class QuickAddTaskHandler implements ICommandHandler<QuickAddTaskCommand, TaskDto> {
  constructor(
    private readonly creation: TaskCreationService,
    @Inject(TASK_DIRECTORY) private readonly directory: TaskDirectory,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly read: TaskReadModel,
  ) {}

  async execute({ actor, input }: QuickAddTaskCommand): Promise<TaskDto> {
    const parsed = parseQuickAdd(input.text, this.clock.now());

    const [members, projects] = await Promise.all([
      parsed.assigneeHandle ? this.directory.activeMembers(actor.workspaceId) : Promise.resolve([]),
      parsed.projectHandle
        ? this.directory.projects(actor.workspaceId, actor.role === 'GUEST' ? (actor.projectIds ?? []) : undefined)
        : Promise.resolve([]),
    ]);
    const assignee = parsed.assigneeHandle ? matchMember(parsed.assigneeHandle, members, true) : null;
    const project = parsed.projectHandle ? matchProject(parsed.projectHandle, projects) : null;

    const unresolved = new Set<ParsedQuickAdd['tokens'][number]['kind']>();
    if (parsed.assigneeHandle && !assignee) unresolved.add('assignee');
    if (parsed.projectHandle && !project) unresolved.add('project');

    const task = await this.creation.create(actor, {
      title: titleKeeping(input.text, parsed, unresolved),
      projectId: project?.id ?? input.projectId ?? null,
      assigneeId: assignee?.id ?? (input.assignToMe ? actor.userId : null),
      priority: parsed.priority ?? undefined,
      dueDate: parsed.dueDate,
    });
    return this.read.get(actor.workspaceId, task.id);
  }
}

/** Rebuilds the title from the raw text, removing only the tokens that were understood. */
export const titleKeeping = (text: string, parsed: ParsedQuickAdd, unresolved: ReadonlySet<string>): string => {
  if (!unresolved.size) return parsed.title;
  const words = text.trim().split(/\s+/).filter(Boolean);
  for (const token of parsed.tokens) {
    if (unresolved.has(token.kind)) continue;
    const parts = token.text.split(/\s+/);
    const at = words.findIndex((_, i) => parts.every((p, j) => words[i + j] === p));
    if (at >= 0) words.splice(at, parts.length);
  }
  return words.join(' ');
};
