import { EmptyState } from '@hearth/ui';
import type { InboxItemDto } from '@hearth/contracts';
import { isApproval, isConversation } from '../inbox-meta';
import { ApprovalDetail } from './ApprovalDetail';
import { ConversationDetail } from './ConversationDetail';
import { SummaryDetail } from './SummaryDetail';
import type { DetailActionHandlers } from './DetailActions';

/** Strategy by item type: approval view, conversation with reply, or task summary. */
export function InboxDetail({ item, ...handlers }: { item: InboxItemDto | null } & DetailActionHandlers) {
  if (!item) return <EmptyState icon="inbox" title="Nothing selected" description="Pick an item on the left, or press J to start triaging." headingLevel={2} />;
  if (isApproval(item)) return <ApprovalDetail key={item.id} item={item} {...handlers} />;
  if (isConversation(item)) return <ConversationDetail key={item.id} item={item} {...handlers} />;
  return <SummaryDetail key={item.id} item={item} {...handlers} />;
}
