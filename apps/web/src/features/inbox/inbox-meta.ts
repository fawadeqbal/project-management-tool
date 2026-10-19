import type { IconName } from '@hearth/ui';
import { isIconName } from '@hearth/ui';
import type { InboxCountsDto, InboxItemDto, InboxTabDto } from '@hearth/contracts';
import { inboxTime } from '@hearth/domain';

export const TAB_ORDER: InboxTabDto[] = ['all', 'mentions', 'assigned', 'approvals'];

const TAB_LABEL: Record<InboxTabDto, string> = { all: 'All', mentions: 'Mentions', assigned: 'Assigned', approvals: 'Approvals' };

/** "Mentions 3" — counts are unread items; All has no count (as in the design). */
export const tabLabel = (tab: InboxTabDto, counts: InboxCountsDto | undefined): string => {
  const n = tab === 'all' ? 0 : (counts?.[tab] ?? 0);
  return n ? `${TAB_LABEL[tab]} ${n}` : TAB_LABEL[tab];
};

export const isInboxTab = (v: string | null): v is InboxTabDto => !!v && (TAB_ORDER as string[]).includes(v);

/** Local clock version of the server's human time ("9:42", "Yesterday", "Mon"). */
export const localTime = (item: Pick<InboxItemDto, 'createdAt'>, now: Date = new Date()): string =>
  inboxTime(new Date(item.createdAt), now, -now.getTimezoneOffset());

export const itemIcon = (item: InboxItemDto): IconName => (isIconName(item.icon) ? item.icon : 'bell');

export const EMPTY_COPY: Record<InboxTabDto, string> = {
  all: 'Mentions, assignments and approvals land here as they happen.',
  mentions: 'When someone @mentions you or replies to you, it shows up here.',
  assigned: 'Tasks people hand to you show up here.',
  approvals: 'Requests for your sign-off show up here.',
};

export const isApproval = (item: InboxItemDto) => item.type === 'APPROVAL_REQUESTED' && !!item.approvalId;
export const isConversation = (item: InboxItemDto) => (item.type === 'MENTION' || item.type === 'COMMENT_REPLY') && !!item.taskId;
