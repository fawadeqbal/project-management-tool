import { summarySource, type AiBreakdown, type AiProvider, type AiSummary, type AiTaskContext } from '@hearth/domain';

export interface AnthropicConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
}

type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

const SYSTEM =
  'You help a project-management app called Hearth. Write in plain, calm sentence case. ' +
  'Never invent facts that are not in the task data. Reply with JSON only, no prose around it.';

/** Adapter: the Anthropic Messages API behind the AiProvider port (uses fetch, no SDK). */
export class AnthropicAiProvider implements AiProvider {
  readonly name = 'anthropic';

  constructor(
    private readonly config: AnthropicConfig,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
  ) {}

  async summarizeTask(ctx: AiTaskContext): Promise<AiSummary> {
    const out = await this.ask<{ summary?: string; nextStep?: string | null }>(
      `Summarize where this task stands in at most 3 short sentences for a teammate who missed the discussion. ` +
        `Mention blockers by key. Then suggest one next step. ` +
        `Return {"summary": string, "nextStep": string | null}.\n\nTask data:\n${JSON.stringify(ctx)}`,
    );
    if (!out.summary?.trim()) throw new Error('Anthropic returned an empty summary');
    const next = out.nextStep?.trim() || null;
    const text = next ? `${out.summary.trim()} Suggested next step: ${next.replace(/^[A-Z]/, (c) => c.toLowerCase()).replace(/\.?$/, '.')}` : out.summary.trim();
    return { text, source: summarySource(ctx), suggestedNextStep: next };
  }

  async breakDownTask(ctx: AiTaskContext): Promise<AiBreakdown> {
    const out = await this.ask<{ subtasks?: unknown }>(
      `Break this task into 3 to 6 concrete subtasks, each starting with a verb, under 80 characters, ` +
        `not repeating existing subtasks. Return {"subtasks": string[]}.\n\nTask data:\n${JSON.stringify(ctx)}`,
    );
    const subtasks = Array.isArray(out.subtasks) ? out.subtasks.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim()) : [];
    if (subtasks.length < 2) throw new Error('Anthropic returned too few subtasks');
    return { subtasks: subtasks.slice(0, 6), source: 'generated from the title and description' };
  }

  private async ask<T>(prompt: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 15_000);
    try {
      const res = await this.fetchImpl(`${this.config.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': this.config.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: this.config.model, max_tokens: 600, system: SYSTEM, messages: [{ role: 'user', content: prompt }] }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Anthropic API responded ${res.status}`);
      const body = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = (body.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
      const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
      return JSON.parse(json) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
