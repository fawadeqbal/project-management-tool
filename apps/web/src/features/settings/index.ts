import { createElement, type ComponentType } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import type { Command } from '@/shared/commands/command';
import type { RouteHandle } from '@/shared/routing/crumbs';
import { SettingsFrame } from './components/SettingsFrame';
import { useInviteDialogStore } from './invite-dialog-store';

const page = (load: () => Promise<{ Component: ComponentType }>) => ({ lazy: load });
const crumb = (label: string): RouteHandle => ({ crumb: label });

/** Public surface of the "settings" feature: the /settings/* layout with its left nav, and commands. */
export const routes: RouteObject[] = [
  {
    path: 'settings',
    Component: SettingsFrame,
    handle: crumb('Settings'),
    children: [
      { index: true, element: createElement(Navigate, { to: 'members', replace: true }) },
      {
        path: 'profile',
        handle: crumb('Account / Profile'),
        ...page(async () => ({ Component: (await import('./pages/ProfilePage')).ProfilePage })),
      },
      {
        path: 'appearance',
        handle: crumb('Account / Appearance'),
        ...page(async () => ({ Component: (await import('./pages/AppearancePage')).AppearancePage })),
      },
      {
        path: 'members',
        handle: crumb('Workspace / Members'),
        ...page(async () => ({ Component: (await import('./pages/MembersPage')).MembersPage })),
      },
      {
        path: 'import-export',
        handle: crumb('Workspace / Import / export'),
        ...page(async () => ({ Component: (await import('./pages/ImportExportPage')).ImportExportPage })),
      },
      {
        path: 'billing',
        handle: crumb('Admin / Billing'),
        ...page(async () => ({ Component: (await import('@/features/billing')).BillingPage })),
      },
      ...['notifications', 'general', 'teams', 'fields', 'integrations', 'security', 'audit-log'].map(
        (path) => ({
          path,
          ...page(async () => ({
            Component: (await import('./pages/ComingSoonSettingsPage')).ComingSoonSettingsPage,
          })),
        }),
      ),
    ],
  },
];

export const commands: Command[] = [
  {
    id: 'settings.open',
    title: 'Open settings',
    group: 'Settings',
    icon: 'settings',
    keywords: ['preferences', 'profile', 'workspace'],
    run: (c) => c.navigate('/settings/members'),
  },
  {
    id: 'members.invite',
    title: 'Invite people',
    group: 'Actions',
    icon: 'user-plus',
    keywords: ['teammates', 'members', 'guest', 'add people'],
    run: (c) => {
      useInviteDialogStore.getState().setOpen(true);
      if (
        !window.location.pathname.startsWith('/settings/members') &&
        !window.location.pathname.startsWith('/home')
      )
        c.navigate('/settings/members');
    },
  },
  {
    id: 'settings.profile',
    title: 'Edit profile',
    group: 'Settings',
    icon: 'user-plus',
    keywords: ['name', 'avatar', 'job title'],
    run: (c) => c.navigate('/settings/profile'),
  },
];

/** The invite dialog bound to the shared open state (Home's "Invite" step uses it). */
export { InviteDialogHost } from './components/InviteDialogHost';
export { useInviteDialogStore } from './invite-dialog-store';
