import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { ProjectTemplateDto } from '@hearth/contracts';
import { OnboardingReadModel } from '../../infrastructure/onboarding.read-model';
import { ListTemplatesQuery } from './list-templates.query';

@QueryHandler(ListTemplatesQuery)
export class ListTemplatesHandler implements IQueryHandler<ListTemplatesQuery, ProjectTemplateDto[]> {
  constructor(private readonly read: OnboardingReadModel) {}
  execute(): Promise<ProjectTemplateDto[]> {
    return Promise.resolve(this.read.templates());
  }
}
