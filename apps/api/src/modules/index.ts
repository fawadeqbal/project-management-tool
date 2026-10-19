import { type Type } from '@nestjs/common';
import { IdentityModule } from './identity/identity.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { TasksModule } from './tasks/tasks.module';
import { ProjectsModule } from './projects/projects.module';
import { TimelineModule } from './timeline/timeline.module';
import { WorkloadModule } from './workload/workload.module';
import { SprintsModule } from './sprints/sprints.module';
import { InboxModule } from './inbox/inbox.module';
import { SearchModule } from './search/search.module';
import { AiModule } from './ai/ai.module';
import { ReportingModule } from './reporting/reporting.module';
import { MembersModule } from './members/members.module';
import { BillingModule } from './billing/billing.module';
import { OnboardingModule } from './onboarding/onboarding.module';

/** Every bounded context, registered once. Feature streams never edit this file. */
export const CONTEXT_MODULES: Type[] = [
  IdentityModule,
  WorkspaceModule,
  TasksModule,
  ProjectsModule,
  TimelineModule,
  WorkloadModule,
  SprintsModule,
  InboxModule,
  SearchModule,
  AiModule,
  ReportingModule,
  MembersModule,
  BillingModule,
  OnboardingModule,
];
