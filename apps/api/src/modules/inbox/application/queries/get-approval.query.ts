import type { Actor } from '@hearth/domain';

export class GetApprovalQuery {
  constructor(
    readonly actor: Actor,
    readonly id: string,
  ) {}
}
