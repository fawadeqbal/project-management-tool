import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_PROVIDER, type AiProvider } from '@hearth/domain';
import { AnthropicAiProvider } from './anthropic-ai.provider';
import { FallbackAiProvider } from './fallback-ai.provider';
import { LocalHeuristicAiProvider } from './local-heuristic-ai.provider';

/** Picks the AI strategy from config: Anthropic (with local fallback) when a key is set, else local. */
export const selectAiProvider = (env: { apiKey?: string | null; model?: string | null }, local: AiProvider = new LocalHeuristicAiProvider()): AiProvider =>
  env.apiKey ? new FallbackAiProvider(new AnthropicAiProvider({ apiKey: env.apiKey, model: env.model || 'claude-haiku-4-5' }), local) : local;

export const aiProviderFactory: Provider = {
  provide: AI_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => selectAiProvider({ apiKey: config.get<string>('ANTHROPIC_API_KEY'), model: config.get<string>('AI_MODEL') }),
};
