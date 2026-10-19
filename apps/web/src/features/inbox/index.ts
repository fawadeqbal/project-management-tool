import type { RouteObject } from 'react-router-dom';
import type { Command } from '@/shared/commands/command';
import type { RouteHandle } from '@/shared/routing/crumbs';

/** Public surface of the "inbox" feature: its routes and the commands it contributes to ⌘K. */
export const routes: RouteObject[] = [
  {
    path: 'inbox',
    lazy: async () => ({ Component: (await import('./pages/InboxPage')).InboxPage }),
    handle: { crumb: 'Inbox' } satisfies RouteHandle,
  },
];

/** "Go to Inbox" (G I) is a core command; triage commands register while the inbox is open. */
export const commands: Command[] = [];
