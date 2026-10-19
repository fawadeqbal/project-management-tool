import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router-dom';
import type { Command } from '@/shared/commands/command';

/**
 * Public surface of the "timeline" feature. Its page renders inside the project frame owned by
 * the projects feature (route `projects/:projectId/timeline`), which loads it lazily from here.
 */
export const routes: RouteObject[] = [];
export const commands: Command[] = [];

export const loadProjectTimelinePage = async (): Promise<ComponentType> =>
  (await import('./pages/ProjectTimelinePage')).ProjectTimelinePage;
