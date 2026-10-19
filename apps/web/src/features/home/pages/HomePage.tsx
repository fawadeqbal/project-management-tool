import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProjectTemplateDto } from '@hearth/contracts';
import { firstName, useAuthStore } from '@/shared/auth';
import { useRegisterCommands, type Command } from '@/shared/commands';
import { useUiStore } from '@/shared/layout/ui-store';
import { useRealtimeEvent } from '@/shared/realtime';
import { useTasks } from '@/shared/tasks';
import { useToast } from '@/shared/toast';
import { InviteDialogHost, useInviteDialogStore } from '@/features/settings';
import { onboardingKeys, useApplyTemplate, useOnboarding, useTemplates } from '../api';
import { GettingStarted } from '../components/GettingStarted';
import { MyTasksCard } from '../components/MyTasksCard';
import { TemplateCard } from '../components/TemplateCard';
import { TemplatesDialog } from '../components/TemplatesDialog';
import { useQueryClient } from '@tanstack/react-query';
import styles from '../home.module.css';

/** First-run Home (Home.dc.html): welcome, getting started, my tasks, templates. */
export function HomePage() {
  const me = useAuthStore((s) => s.me);
  const navigate = useNavigate();
  const client = useQueryClient();
  const openCreateTask = useUiStore((s) => s.openCreateTask);
  const openInvite = useInviteDialogStore((s) => s.setOpen);
  const { show } = useToast();
  const { data: onboarding } = useOnboarding();
  const { data: templates = [] } = useTemplates();
  const { data: tasks } = useTasks({ scope: 'mine' });
  const apply = useApplyTemplate();
  const [browseOpen, setBrowseOpen] = useState(false);

  // The checklist reacts to work done elsewhere (a task created with C, an invite accepted).
  useRealtimeEvent(
    'task.created',
    () => void client.invalidateQueries({ queryKey: onboardingKeys.progress }),
  );
  useRealtimeEvent('onboarding.', () => void client.invalidateQueries({ queryKey: onboardingKeys.progress }));

  const featured = templates.filter((t) => t.featured).slice(0, 3);
  const comingSoon = (what: string) =>
    show({
      message: `${what} is coming soon. We’ll let you know when it’s ready.`,
      tone: 'info',
      icon: 'clock',
    });

  const applyTemplate = (t: ProjectTemplateDto, name?: string) =>
    apply.mutate(
      { id: t.id, name },
      {
        onSuccess: (res) => {
          setBrowseOpen(false);
          show({ message: `“${res.project.name}” created with ${res.taskCount} tasks` });
          void navigate(`/projects/${res.project.id}/board`);
        },
        onError: (e) => show({ message: e.message, tone: 'danger', icon: 'alert' }),
      },
    );

  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'home.templates',
        title: 'Browse project templates',
        group: 'Projects',
        icon: 'layers',
        keywords: ['new project', 'template'],
        run: () => setBrowseOpen(true),
      },
    ],
    [],
  );
  useRegisterCommands(commands);

  return (
    <div className={styles.page}>
      <div className={styles.welcome}>
        <h1 className={styles.title}>Welcome to Hearth, {firstName(me?.user.name) || 'there'}</h1>
        <p className={styles.subtitle}>
          Let’s get your team’s first project moving. Most teams finish setup in under 5 minutes.
        </p>
      </div>

      <div className={styles.top}>
        {onboarding?.isComplete ? null : (
          <GettingStarted
            data={onboarding}
            onInvite={() => openInvite(true)}
            onConnectSlack={() => comingSoon('Slack')}
            onTemplate={() => setBrowseOpen(true)}
            onCreateTask={() => openCreateTask()}
          />
        )}
        <MyTasksCard
          tasks={tasks}
          onCreate={() => openCreateTask()}
          onImport={() => comingSoon('Importing from Asana')}
        />
      </div>

      <div className={styles.sectionHead}>
        <h2 className={styles.h2Small}>Start from a template</h2>
        <button type="button" className={styles.link} onClick={() => setBrowseOpen(true)}>
          Browse all {templates.length || ''} templates →
        </button>
      </div>
      <div className={styles.templates}>
        {featured.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            busy={apply.isPending && apply.variables?.id === t.id}
            onApply={(tt) => applyTemplate(tt)}
          />
        ))}
      </div>

      <TemplatesDialog
        open={browseOpen}
        templates={templates}
        busyId={apply.isPending ? (apply.variables?.id ?? null) : null}
        onClose={() => setBrowseOpen(false)}
        onApply={applyTemplate}
      />
      <InviteDialogHost />
    </div>
  );
}
