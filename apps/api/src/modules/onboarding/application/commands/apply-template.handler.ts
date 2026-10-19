import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { ApplyTemplateResultDto } from '@hearth/contracts';
import { createEvent, findTemplate, NotFoundError, startOfDay, type Clock, type TaskCreated } from '@hearth/domain';
import { CLOCK } from '../../../../shared/clock/clock';
import { AccessService } from '../../../../shared/access/access.service';
import { DomainEventPublisher } from '../../../../shared/events/domain-event.publisher';
import { accent } from '../../../../shared/mappers/refs';
import { OnboardingProgressStore } from '../../infrastructure/onboarding-progress.store';
import { TemplateProjectWriter } from '../../infrastructure/template-project.writer';
import { ApplyTemplateCommand } from './apply-template.command';

/**
 * Creates a project with sections and starter tasks from a template, publishes project.created
 * and task.created (same payload shapes as the Projects and Tasks contexts), and ticks
 * "Start from a template" on the checklist.
 */
@CommandHandler(ApplyTemplateCommand)
export class ApplyTemplateHandler implements ICommandHandler<ApplyTemplateCommand, ApplyTemplateResultDto> {
  constructor(
    private readonly writer: TemplateProjectWriter,
    private readonly store: OnboardingProgressStore,
    private readonly access: AccessService,
    private readonly events: DomainEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ actor, templateId, input }: ApplyTemplateCommand): Promise<ApplyTemplateResultDto> {
    this.access.assert(actor, 'projects.create');
    const template = findTemplate(templateId);
    if (!template) throw new NotFoundError('Template', templateId);
    const now = this.clock.now();
    const { project, tasks, keyPrefix } = await this.writer.create({
      workspaceId: actor.workspaceId,
      ownerId: actor.userId,
      name: input.name?.trim() || template.name,
      template,
      today: startOfDay(now),
      now,
    });

    const base = (aggregateId: string) => ({ workspaceId: actor.workspaceId, actorId: actor.userId, aggregateId, occurredAt: now });
    this.events.publish(createEvent('project.created', base(project.id), { name: project.name, teamId: project.teamId, ownerId: actor.userId }));
    this.events.publish(
      ...tasks.map(
        (t): TaskCreated =>
          createEvent('task.created', base(t.id), { key: `${keyPrefix}-${t.number}`, title: t.title, projectId: project.id, assigneeId: t.assigneeId }),
      ),
    );
    if (await this.store.complete(actor.workspaceId, actor.userId, 'start-from-template'))
      this.events.publish(createEvent('onboarding.step_completed', base(actor.userId), { step: 'start-from-template' }));

    return {
      project: { id: project.id, name: project.name, color: accent(project.color, 'blue') },
      taskCount: tasks.length,
      firstTaskKey: tasks[0] ? `${keyPrefix}-${tasks[0].number}` : null,
    };
  }
}
