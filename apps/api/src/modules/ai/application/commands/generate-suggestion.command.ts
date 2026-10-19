import type { Actor } from '@hearth/domain';

/** Ask the AI provider for a summary or a subtask breakdown of a task, stored as a PENDING suggestion. */
export class GenerateSuggestionCommand {
  constructor(
    readonly actor: Actor,
    readonly taskId: string,
    readonly kind: 'summary' | 'breakdown',
  ) {}
}
