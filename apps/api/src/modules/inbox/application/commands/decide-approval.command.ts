import type { ApprovalDecisionValue } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export class DecideApprovalCommand {
  constructor(
    readonly actor: Actor,
    readonly approvalId: string,
    readonly decision: ApprovalDecisionValue,
    readonly note: string | null,
  ) {}
}
