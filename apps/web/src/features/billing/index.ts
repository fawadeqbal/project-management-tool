import type { RouteObject } from 'react-router-dom';
import type { Command } from '@/shared/commands/command';

/**
 * Public surface of the "billing" feature. The Billing & plan page renders at /settings/billing
 * inside the settings layout (the settings feature mounts `BillingPage` there), so no routes here.
 */
export const routes: RouteObject[] = [];

export const commands: Command[] = [
  {
    id: 'billing.open',
    title: 'Open billing',
    group: 'Settings',
    icon: 'settings',
    keywords: ['plan', 'upgrade', 'invoice', 'subscription', 'seats', 'usage'],
    run: (c) => c.navigate('/settings/billing'),
  },
];

/** Contextual upgrade prompt for plan-gated features: other features import it from '@/features/billing'. */
export {
  UpgradePrompt,
  useUpgradePrompt,
  type UpgradePromptProps,
  type UpgradePromptApi,
} from './components/UpgradePrompt';
export { downloadExport } from './api';
export { BillingPage } from './pages/BillingPage';
