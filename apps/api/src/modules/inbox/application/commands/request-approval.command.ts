import type { CreateApprovalInput } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export class RequestApprovalCommand {
  constructor(
    readonly actor: Actor,
    readonly taskId: string,
    readonly input: CreateApprovalInput,
  ) {}
}
