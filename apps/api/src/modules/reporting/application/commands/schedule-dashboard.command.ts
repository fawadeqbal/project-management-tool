import type { ScheduleDashboardInput } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export class ScheduleDashboardCommand {
  constructor(
    readonly actor: Actor,
    readonly input: ScheduleDashboardInput,
  ) {}
}
