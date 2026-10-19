import { ForbiddenError, type Actor } from '@hearth/domain';
import type { AccessService } from '../../../../shared/access/access.service';

/** Members manage their own time off; admins and owners (members.manage) anyone's. Guests never. */
export const assertCanManageTimeOff = (access: AccessService, actor: Actor, userId: string): void => {
  if (actor.role === 'GUEST')
    throw new ForbiddenError(
      'time_off.guest',
      'Guests can’t add time off in this workspace. Ask the project owner.',
    );
  if (userId === actor.userId) return;
  if (!access.allows(actor, 'members.manage'))
    throw new ForbiddenError(
      'time_off.others',
      'You can add time off for yourself. Ask a workspace admin to add it for someone else.',
    );
};
