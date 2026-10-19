import { memo } from 'react';
import { Avatar, Icon, TaskCheckbox, VisuallyHidden } from '@hearth/ui';
import type { InboxItemDto } from '@hearth/contracts';
import { itemIcon, localTime } from '../inbox-meta';
import styles from '../inbox.module.css';

interface Props {
  item: InboxItemDto;
  selected: boolean;
  checked: boolean;
  selectionMode: boolean;
  onSelect: (id: string) => void;
  onToggleChecked: (id: string) => void;
}

/** One notification: unread dot + bold title (never color alone), who/what/where, quoted excerpt. */
export const InboxListItem = memo(function InboxListItem({ item, selected, checked, selectionMode, onSelect, onToggleChecked }: Props) {
  return (
    <div
      id={`inbox-item-${item.id}`}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      className={styles.item}
      data-selected={selected || undefined}
      data-unread={item.unread || undefined}
      data-checked={checked || undefined}
      onClick={() => onSelect(item.id)}
    >
      <span className={styles.dotCol}>
        {selectionMode ? (
          <TaskCheckbox
            checked={checked}
            label={`Select “${item.title}”`}
            onChange={() => onToggleChecked(item.id)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : item.unread ? (
          <span className={styles.dot} aria-hidden="true" />
        ) : null}
      </span>
      <Avatar initials={item.actor?.initials ?? '·'} name={item.actor?.name} size={32} color={item.actor?.avatarColor ?? 'slate'} />
      <div className={styles.itemBody}>
        <div className={styles.itemTop}>
          <span className={styles.itemTitle}>
            {item.unread ? <VisuallyHidden>Unread: </VisuallyHidden> : null}
            {item.title}
          </span>
          <time className={styles.itemTime} dateTime={item.createdAt}>
            {localTime(item)}
          </time>
        </div>
        <span className={styles.itemWhere}>
          <Icon name={itemIcon(item)} size={12} />
          {item.context}
        </span>
        {item.excerpt ? <span className={styles.itemQuote}>{item.excerpt}</span> : null}
      </div>
    </div>
  );
});
