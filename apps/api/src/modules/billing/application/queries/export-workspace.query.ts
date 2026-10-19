import type { Actor } from '@hearth/domain';

export class ExportWorkspaceQuery {
  constructor(readonly actor: Actor) {}
}
