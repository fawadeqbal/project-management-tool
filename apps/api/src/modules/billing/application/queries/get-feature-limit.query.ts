import type { Actor } from '@hearth/domain';

export class GetFeatureLimitQuery {
  constructor(
    readonly actor: Actor,
    readonly feature: string,
  ) {}
}
