import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DASHBOARD_WIDGETS, type DashboardWidgetId } from '@hearth/contracts';
import { PrismaService } from '../../../shared/prisma/prisma.service';

export const LAYOUT_SCOPE = 'dashboard-layout';
export const SCHEDULE_SCOPE = 'dashboard-schedule';

export interface DashboardSchedule {
  cadence: 'weekly';
  recipients: string[];
}

const isWidget = (v: unknown): v is DashboardWidgetId => (DASHBOARD_WIDGETS as readonly unknown[]).includes(v);

/**
 * Per-person dashboard preferences, persisted as SavedView rows (scope 'dashboard-layout' and
 * 'dashboard-schedule') so no schema change is needed. One row per person and scope.
 */
@Injectable()
export class DashboardPreferencesStore {
  constructor(private readonly prisma: PrismaService) {}

  async layout(workspaceId: string, userId: string): Promise<DashboardWidgetId[]> {
    const row = await this.find(workspaceId, userId, LAYOUT_SCOPE);
    const widgets = (row?.config as { widgets?: unknown[] } | undefined)?.widgets ?? [];
    const saved = widgets.filter(isWidget);
    // Widgets added after the layout was saved are appended, so nothing silently disappears.
    return [...saved, ...DASHBOARD_WIDGETS.filter((w) => !saved.includes(w))];
  }

  async schedule(workspaceId: string, userId: string): Promise<DashboardSchedule | null> {
    const row = await this.find(workspaceId, userId, SCHEDULE_SCOPE);
    const cfg = row?.config as { cadence?: string; recipients?: unknown[] } | undefined;
    if (!cfg || cfg.cadence !== 'weekly' || !Array.isArray(cfg.recipients)) return null;
    return { cadence: 'weekly', recipients: cfg.recipients.filter((r): r is string => typeof r === 'string') };
  }

  saveLayout(workspaceId: string, userId: string, widgets: DashboardWidgetId[]): Promise<void> {
    return this.upsert(workspaceId, userId, LAYOUT_SCOPE, 'Dashboard layout', { widgets });
  }

  saveSchedule(workspaceId: string, userId: string, schedule: DashboardSchedule): Promise<void> {
    return this.upsert(workspaceId, userId, SCHEDULE_SCOPE, 'Weekly dashboard email', { ...schedule });
  }

  private find(workspaceId: string, userId: string, scope: string) {
    return this.prisma.savedView.findFirst({ where: { workspaceId, userId, scope }, orderBy: { createdAt: 'desc' } });
  }

  private async upsert(workspaceId: string, userId: string, scope: string, name: string, config: Prisma.InputJsonObject): Promise<void> {
    const existing = await this.find(workspaceId, userId, scope);
    if (existing) await this.prisma.savedView.update({ where: { id: existing.id }, data: { config } });
    else await this.prisma.savedView.create({ data: { workspaceId, userId, scope, name, config } });
  }
}
