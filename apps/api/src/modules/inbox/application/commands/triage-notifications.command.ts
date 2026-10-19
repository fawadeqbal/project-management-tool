import type { SnoozePresetDto } from '@hearth/contracts';
import type { Actor } from '@hearth/domain';

export type TriageAction =
  | { kind: 'read' }
  | { kind: 'unread' }
  | { kind: 'archive' }
  | { kind: 'unarchive' }
  | { kind: 'unsnooze' }
  | { kind: 'snooze'; preset?: SnoozePresetDto; until?: string };

/** Read / unread / archive / unarchive / snooze one or more of my notifications. */
export class TriageNotificationsCommand {
  constructor(
    readonly actor: Actor,
    readonly ids: string[],
    readonly action: TriageAction,
  ) {}
}
