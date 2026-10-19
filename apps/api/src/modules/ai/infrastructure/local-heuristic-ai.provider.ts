import { Injectable } from '@nestjs/common';
import { breakDownTaskLocally, summarizeTaskLocally, type AiBreakdown, type AiProvider, type AiSummary, type AiTaskContext } from '@hearth/domain';

/** Strategy: deterministic, offline AI built from the task's own data. Always available. */
@Injectable()
export class LocalHeuristicAiProvider implements AiProvider {
  readonly name = 'local';

  async summarizeTask(ctx: AiTaskContext): Promise<AiSummary> {
    return summarizeTaskLocally(ctx);
  }

  async breakDownTask(ctx: AiTaskContext): Promise<AiBreakdown> {
    return breakDownTaskLocally(ctx);
  }
}
