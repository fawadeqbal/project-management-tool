import type { CreateSprintInput } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export class PlanSprintCommand {
  constructor(
    readonly actor: Actor,
    readonly projectId: string,
    readonly input: CreateSprintInput,
  ) {}
}
