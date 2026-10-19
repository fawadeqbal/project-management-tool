import { z } from 'zod';

export const API_PREFIX = '/api/v1';

/** "YYYY-MM-DD" calendar date. All due/start dates cross the wire in this shape. */
export const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-26.');
export const IdSchema = z.string().min(1).max(64);

export const TaskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE']);
export const PrioritySchema = z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']);
export const AccentColorSchema = z.enum(['blue', 'green', 'sky', 'violet', 'amber', 'rose', 'slate']);
export const RoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'GUEST']);

/** Error envelope every non-2xx response uses. `message` is written for people. */
export interface ApiErrorBody {
  error: {
    code: string;
    kind: 'validation' | 'not_found' | 'forbidden' | 'conflict' | 'limit_reached' | 'invariant' | 'unauthorized' | 'internal';
    message: string;
    details?: Record<string, unknown>;
    fieldErrors?: Record<string, string[]>;
  };
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** A compact person reference used everywhere a user is shown (avatars, assignees, authors). */
export interface UserRefDto {
  id: string;
  name: string;
  initials: string;
  avatarColor: z.infer<typeof AccentColorSchema>;
}

export interface ProjectRefDto {
  id: string;
  name: string;
  color: z.infer<typeof AccentColorSchema>;
}

export interface TaskRefDto {
  id: string;
  key: string;
  title: string;
  status: z.infer<typeof TaskStatusSchema>;
}

/** Real-time envelope pushed over the websocket (`event` channel) for every domain event. */
export interface RealtimeEventDto {
  type: string;
  aggregateId: string;
  actorId: string;
  workspaceId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export const WS_EVENT = 'domain-event';
export const WS_PRESENCE = 'presence';
