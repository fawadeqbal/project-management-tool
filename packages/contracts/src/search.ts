// Contracts for the search bounded context (⌘K server-side search).
import { z } from 'zod';
import type { ProjectRefDto, UserRefDto } from './common';
import type { PriorityDto, TaskStatusDto } from './tasks';
import type { TagDto } from './workspace';

export const SearchScopeSchema = z.enum(['all', 'tasks', 'projects', 'people']);
export type SearchScopeDto = z.infer<typeof SearchScopeSchema>;

export const SearchQuerySchema = z.object({
  q: z.string().trim().max(200).default(''),
  scope: SearchScopeSchema.default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(8),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export interface SearchTaskHitDto {
  id: string;
  key: string;
  number: number;
  title: string;
  status: TaskStatusDto;
  priority: PriorityDto;
  dueDate: string | null;
  /** "overdue 2 days" / "due today" / "due Thu" */
  hint: string | null;
  assignee: UserRefDto | null;
  project: ProjectRefDto | null;
  parentId: string | null;
  tags: TagDto[];
  updatedAt: string;
  score: number;
  /** Matched character indices in `title` for highlighting. */
  indices: number[];
}

export interface SearchProjectHitDto extends ProjectRefDto {
  openTaskCount: number;
  score: number;
}

export interface SearchPersonHitDto extends UserRefDto {
  email: string;
  jobTitle: string | null;
  score: number;
}

export interface SearchResultDto {
  query: string;
  scope: SearchScopeDto;
  tasks: SearchTaskHitDto[];
  projects: SearchProjectHitDto[];
  people: SearchPersonHitDto[];
  /** Server time spent, for "Matched in 12 ms". */
  tookMs: number;
}

export const SEARCH_ROUTES = { search: '/search' } as const;
