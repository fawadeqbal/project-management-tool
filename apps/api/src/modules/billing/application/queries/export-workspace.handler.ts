import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { WorkspaceExportDto } from '@hearth/contracts';
import { WorkspaceExportReadModel } from '../../infrastructure/workspace-export.read-model';
import { ExportWorkspaceQuery } from './export-workspace.query';

/** Data export is always available (cancel is never a trap). */
@QueryHandler(ExportWorkspaceQuery)
export class ExportWorkspaceHandler implements IQueryHandler<ExportWorkspaceQuery, WorkspaceExportDto> {
  constructor(private readonly read: WorkspaceExportReadModel) {}
  execute({ actor }: ExportWorkspaceQuery) {
    return this.read.export(actor);
  }
}
