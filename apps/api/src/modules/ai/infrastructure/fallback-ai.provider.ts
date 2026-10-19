import { Logger } from '@nestjs/common';
import type { AiBreakdown, AiProvider, AiSummary, AiTaskContext } from '@hearth/domain';

/** Decorator: tries the primary provider and falls back on any error (network, quota, bad output). */
export class FallbackAiProvider implements AiProvider {
  private readonly logger = new Logger(FallbackAiProvider.name);

  constructor(
    private readonly primary: AiProvider,
    private readonly fallback: AiProvider,
  ) {}

  get name() {
    return `${this.primary.name}+${this.fallback.name}`;
  }

  summarizeTask(ctx: AiTaskContext): Promise<AiSummary> {
    return this.attempt(
      'summarize',
      () => this.primary.summarizeTask(ctx),
      () => this.fallback.summarizeTask(ctx),
    );
  }

  breakDownTask(ctx: AiTaskContext): Promise<AiBreakdown> {
    return this.attempt(
      'break down',
      () => this.primary.breakDownTask(ctx),
      () => this.fallback.breakDownTask(ctx),
    );
  }

  private async attempt<T>(what: string, run: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (e) {
      this.logger.warn(
        `${this.primary.name} failed to ${what}; using ${this.fallback.name}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return fallback();
    }
  }
}
