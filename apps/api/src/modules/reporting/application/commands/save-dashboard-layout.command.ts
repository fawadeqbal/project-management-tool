import type { UpdateDashboardLayoutInput } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export class SaveDashboardLayoutCommand {
  constructor(
    readonly actor: Actor,
    readonly input: UpdateDashboardLayoutInput,
  ) {}
}
