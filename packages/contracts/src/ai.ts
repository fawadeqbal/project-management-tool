// Contracts for the ai bounded context: summaries, breakdowns and natural-language filters.
// AI output is always a suggestion that names its source and needs a click to be written.
import { z } from 'zod';

export type AiSuggestionKindDto = 'summary' | 'breakdown';
export type AiSuggestionStatusDto = 'PENDING' | 'ACCEPTED' | 'DISCARDED';

export interface AiSuggestionDto {
  id: string;
  taskId: string;
  kind: AiSuggestionKindDto;
  status: AiSuggestionStatusDto;
  /** "generated from 12 comments" */
  source: string;
  /** Present for kind = summary. */
  summary: { text: string; suggestedNextStep: string | null } | null;
  /** Present for kind = breakdown. */
  breakdown: { subtasks: string[] } | null;
  createdAt: string;
}

export const AcceptSuggestionSchema = z.object({
  /** What the person edited before accepting: text for a summary, the chosen titles for a breakdown. */
  edited: z
    .object({
      text: z.string().trim().min(1, 'The summary can’t be empty.').max(5000).optional(),
      subtasks: z
        .array(z.string().trim().min(1).max(500))
        .min(1, 'Pick at least one subtask.')
        .max(12)
        .optional(),
    })
    .optional(),
});
export type AcceptSuggestionInput = z.infer<typeof AcceptSuggestionSchema>;

export interface AcceptSuggestionResultDto {
  suggestion: AiSuggestionDto;
  /** Summary accepted: the new task description. */
  description?: string;
  /** Breakdown accepted: the created subtasks. */
  createdSubtasks?: { id: string; key: string; title: string }[];
}

export const InterpretQuerySchema = z.object({
  query: z.string().trim().min(1, 'Type a question first.').max(300),
});
export type InterpretQueryInput = z.infer<typeof InterpretQuerySchema>;

/** A My tasks filter as URL params (my-tasks reads these). */
export interface AiTaskFilterDto {
  overdue?: boolean;
  due?: 'today';
  tag?: string;
  /** team id */
  team?: string;
  /** project id */
  project?: string;
  /** user id */
  assignee?: string;
  status?: string;
  priority?: string;
  q?: string;
}

export interface InterpretResultDto {
  query: string;
  /** False when nothing was recognized (plain text search). */
  recognized: boolean;
  filter: AiTaskFilterDto;
  /** URL search params for /my-tasks, e.g. { overdue: '1', team: 'tm_1' }. */
  params: Record<string, string>;
  /** "Show overdue tasks for the Design team" */
  explanation: string;
  href: string;
}

export const AI_ROUTES = {
  summary: (taskId: string) => `/tasks/${taskId}/ai/summary`,
  breakdown: (taskId: string) => `/tasks/${taskId}/ai/breakdown`,
  suggestions: (taskId: string) => `/tasks/${taskId}/ai/suggestions`,
  accept: (id: string) => `/ai/suggestions/${id}/accept`,
  discard: (id: string) => `/ai/suggestions/${id}/discard`,
  interpret: '/ai/interpret',
} as const;
