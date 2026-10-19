import { useState } from 'react';
import { AvatarGroup, Button, Dialog, DropdownMenu, Icon, Kbd } from '@hearth/ui';
import type { TaskDetailDto, UserRefDto } from '@hearth/contracts';
import { SaveIndicator } from './SaveIndicator';
import styles from '../task-detail.module.css';

interface Props {
  task: TaskDetailDto;
  viewers: readonly UserRefDto[];
  isFollowing: boolean;
  canDelete: boolean;
  /** Panel mode shows "Open full page", Esc and close. */
  mode: 'panel' | 'page';
  onOpenFullPage?: () => void;
  onCopyLink: () => void;
  onToggleFollow: () => void;
  onDelete: () => void;
  onClose?: () => void;
  /** Phone layout: back arrow on the left, "Open full page" moves into More. */
  phone?: boolean;
  /** Phone back action (closes the sheet, or leaves the full page). */
  onBack?: () => void;
  backLabel?: string;
}

/** Key, autosave state, presence, open full page, copy link, more (follow, delete), close. */
export function TaskHeader({
  task,
  viewers,
  isFollowing,
  canDelete,
  mode,
  onOpenFullPage,
  onCopyLink,
  onToggleFollow,
  onDelete,
  onClose,
  phone,
  onBack,
  backLabel = 'Back',
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const showOpenFull = mode === 'panel' && !!onOpenFullPage;
  return (
    <div className={styles.header} data-phone={phone || undefined}>
      {phone && onBack ? (
        <button type="button" className={styles.backButton} aria-label={backLabel} onClick={onBack}>
          <Icon name="chevron-right" size={24} className={styles.backIcon} />
        </button>
      ) : null}
      <span className={styles.key}>{task.key}</span>
      <SaveIndicator />
      <span className={styles.grow} />
      {viewers.length ? (
        <span
          className={styles.presence}
          aria-label={`Also viewing: ${viewers.map((v) => v.name).join(', ')}`}
        >
          <AvatarGroup
            people={viewers.map((v) => ({ initials: v.initials, name: v.name, color: v.avatarColor }))}
            max={3}
            size={24}
          />
        </span>
      ) : null}
      {showOpenFull && !phone ? (
        <Button
          variant="ghost"
          size="sm"
          icon="arrow-up-right"
          aria-label="Open full page"
          onClick={onOpenFullPage}
        />
      ) : null}
      <Button variant="ghost" size="sm" icon="link" aria-label="Copy link" onClick={onCopyLink} />
      <DropdownMenu
        label="More actions"
        align="end"
        items={[
          ...(showOpenFull && phone
            ? [
                {
                  id: 'open-full',
                  label: 'Open full page',
                  icon: 'arrow-up-right' as const,
                  onSelect: () => onOpenFullPage?.(),
                },
              ]
            : []),
          {
            id: 'follow',
            label: isFollowing ? 'Unfollow' : 'Follow',
            icon: isFollowing ? 'eye' : 'bell',
            hint: isFollowing ? 'Stop notifications' : 'Get notified of changes',
            onSelect: onToggleFollow,
          },
          ...(canDelete
            ? [
                {
                  id: 'delete',
                  label: 'Delete task…',
                  icon: 'trash' as const,
                  danger: true,
                  onSelect: () => setConfirming(true),
                },
              ]
            : []),
        ]}
        trigger={<Button variant="ghost" size="sm" icon="more" aria-label="More actions" />}
      />
      {mode === 'panel' && onClose && !phone ? (
        <>
          <Kbd keys="Esc" aria-hidden="true" className={styles.hideNarrow} />
          <Button variant="ghost" size="sm" icon="x" aria-label="Close panel" onClick={onClose} />
        </>
      ) : null}
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        role="alertdialog"
        size="sm"
        title={`Delete ${task.key}?`}
        description="This removes the task, its subtasks and comments for everyone. It can’t be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep task
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
            >
              Delete task
            </Button>
          </>
        }
      />
    </div>
  );
}
