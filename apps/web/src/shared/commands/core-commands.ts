import type { Command } from './command';

export interface CoreCommandDeps {
  openCreateTask: () => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  showShortcuts: () => void;
  logOut: () => void;
}

/** App-level commands that belong to no single feature (navigation, theme, shell). */
export const createCoreCommands = (deps: CoreCommandDeps): Command[] => [
  { id: 'nav.home', title: 'Go to Home', group: 'Navigate', icon: 'home', shortcut: ['G', 'H'], run: (c) => c.navigate('/home') },
  {
    id: 'nav.my-tasks',
    title: 'Go to My tasks',
    group: 'Navigate',
    icon: 'my-tasks',
    shortcut: ['G', 'M'],
    keywords: ['assigned', 'mine', 'todo'],
    run: (c) => c.navigate('/my-tasks'),
  },
  {
    id: 'nav.inbox',
    title: 'Go to Inbox',
    group: 'Navigate',
    icon: 'inbox',
    shortcut: ['G', 'I'],
    keywords: ['notifications', 'mentions'],
    run: (c) => c.navigate('/inbox'),
  },
  {
    id: 'nav.dashboards',
    title: 'Go to Dashboards',
    group: 'Navigate',
    icon: 'dashboard',
    shortcut: ['G', 'D'],
    keywords: ['reports', 'analytics'],
    run: (c) => c.navigate('/dashboards'),
  },
  {
    id: 'task.create',
    title: 'Create task',
    group: 'Actions',
    icon: 'plus',
    shortcut: ['C'],
    keywords: ['new', 'add', 'todo'],
    run: () => deps.openCreateTask(),
  },
  { id: 'app.toggle-theme', title: 'Toggle theme', group: 'Settings', icon: 'moon', keywords: ['dark', 'light', 'mode', 'appearance'], run: () => deps.toggleTheme() },
  { id: 'app.toggle-sidebar', title: 'Toggle sidebar', group: 'Settings', icon: 'layers', shortcut: ['['], run: () => deps.toggleSidebar() },
  {
    id: 'app.shortcuts',
    title: 'Show keyboard shortcuts',
    group: 'Settings',
    icon: 'command',
    shortcut: ['?'],
    keywords: ['help', 'keys', 'hotkeys'],
    run: () => deps.showShortcuts(),
  },
  { id: 'app.logout', title: 'Log out', group: 'Settings', icon: 'arrow-right', keywords: ['sign out', 'exit'], run: () => deps.logOut() },
];
