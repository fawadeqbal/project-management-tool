import { EmptyState } from '@hearth/ui';
import type { InboxTabDto } from '@hearth/contracts';
import { EMPTY_COPY } from '../inbox-meta';

/** "You’re all caught up" per tab (and for the Unread filter). */
export function InboxEmpty({ tab, unreadOnly }: { tab: InboxTabDto; unreadOnly: boolean }) {
  return (
    <EmptyState
      icon="check"
      title="You’re all caught up"
      description={
        unreadOnly ? 'Nothing unread here. Turn off the Unread filter to see everything.' : EMPTY_COPY[tab]
      }
      headingLevel={3}
    />
  );
}
