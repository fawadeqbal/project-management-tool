import type { ApplyTemplateInput } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export class ApplyTemplateCommand {
  constructor(
    readonly actor: Actor,
    readonly templateId: string,
    readonly input: ApplyTemplateInput,
  ) {}
}
