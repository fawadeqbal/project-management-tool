import { FixedClock, type DomainEvent } from '@hearth/domain';
import type { DashboardWidgetId } from '@hearth/contracts';
import type { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import type { DashboardPreferencesStore, DashboardSchedule } from '../../infrastructure/dashboard-preferences.store';
import { SaveDashboardLayoutHandler } from './save-dashboard-layout.handler';
import { SaveDashboardLayoutCommand } from './save-dashboard-layout.command';
import { ScheduleDashboardHandler } from './schedule-dashboard.handler';
import { ScheduleDashboardCommand } from './schedule-dashboard.command';

class InMemoryPrefs {
  widgets: DashboardWidgetId[] = [];
  schedule: DashboardSchedule | null = null;
  async saveLayout(_w: string, _u: string, widgets: DashboardWidgetId[]) {
    this.widgets = widgets;
  }
  async layout() {
    const all: DashboardWidgetId[] = ['kpis', 'throughput', 'status-mix', 'project-health'];
    return [...this.widgets, ...all.filter((w) => !this.widgets.includes(w))];
  }
  async saveSchedule(_w: string, _u: string, s: DashboardSchedule) {
    this.schedule = s;
  }
}

const published: DomainEvent[] = [];
const events = { publish: (...e: DomainEvent[]) => published.push(...e) } as unknown as DomainEventPublisher;
const clock = new FixedClock(new Date('2026-10-19T12:00:00Z'));
const actor = { userId: 'fawad', workspaceId: 'w', role: 'OWNER' as const };

describe('dashboard commands', () => {
  it('saves a partial layout and appends the missing widgets', async () => {
    const prefs = new InMemoryPrefs();
    const res = await new SaveDashboardLayoutHandler(prefs as unknown as DashboardPreferencesStore, events, clock).execute(
      new SaveDashboardLayoutCommand(actor, { widgets: ['project-health', 'kpis'] }),
    );
    expect(res.layout).toEqual(['project-health', 'kpis', 'throughput', 'status-mix']);
    expect(published.at(-1)!.type).toBe('dashboard.layout_saved');
  });

  it('stores a weekly schedule with unique recipients', async () => {
    const prefs = new InMemoryPrefs();
    await new ScheduleDashboardHandler(prefs as unknown as DashboardPreferencesStore, events, clock).execute(
      new ScheduleDashboardCommand(actor, { cadence: 'weekly', recipients: ['sara@acme.com', 'sara@acme.com', 'mo@acme.com'] }),
    );
    expect(prefs.schedule).toEqual({ cadence: 'weekly', recipients: ['sara@acme.com', 'mo@acme.com'] });
  });
});
