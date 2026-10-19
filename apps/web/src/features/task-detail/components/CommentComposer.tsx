import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Avatar, Button, Kbd } from '@hearth/ui';
import type { MemberDto } from '@hearth/contracts';
import { isMac } from '@/shared/hotkeys/hotkey-service';
import { useMembers } from '@/shared/workspace/hooks';
import styles from '../task-detail.module.css';

/** The "@query" being typed at the caret, if any. */
const mentionAt = (text: string, caret: number): { start: number; query: string } | null => {
  const before = text.slice(0, caret);
  const m = /(^|\s)@([\p{L}\p{N}._-]*)$/u.exec(before);
  return m ? { start: caret - m[2]!.length - 1, query: m[2]!.toLowerCase() } : null;
};

/** Comment box pinned to the bottom: @ autocomplete from members, ⌘↵ / Ctrl+Enter to send. */
export function CommentComposer({
  onSend,
  disabled,
}: {
  onSend: (body: string) => Promise<boolean>;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const { data: members = [] } = useMembers();

  const mention = mentionAt(text, caret);
  const suggestions = useMemo<MemberDto[]>(() => {
    if (!mention) return [];
    return members
      .filter(
        (m) =>
          m.status === 'ACTIVE' &&
          (m.name.toLowerCase().includes(mention.query) || m.email.toLowerCase().startsWith(mention.query)),
      )
      .slice(0, 6);
  }, [mention, members]);
  const showSuggestions = suggestions.length > 0;

  const insertMention = (m: MemberDto) => {
    if (!mention) return;
    const handle = `@${m.name.split(' ')[0]} `;
    const next = text.slice(0, mention.start) + handle + text.slice(caret);
    const pos = mention.start + handle.length;
    setText(next);
    setActive(0);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText('');
    const ok = await onSend(body);
    setSending(false);
    if (!ok) setText(body);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => (a + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        insertMention(suggestions[active] ?? suggestions[0]!);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setCaret(-1);
        return;
      }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
  };

  const listId = 'comment-mentions';
  return (
    <div className={styles.composer}>
      {showSuggestions ? (
        <ul id={listId} role="listbox" aria-label="Mention someone" className={styles.mentions}>
          {suggestions.map((m, i) => (
            <li
              key={m.id}
              id={`${listId}-${m.id}`}
              role="option"
              aria-selected={i === active}
              className={styles.mentionOption}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(m);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <Avatar initials={m.initials} name={m.name} color={m.avatarColor} size={20} />
              {m.name}
              <span className={styles.muted}>{m.jobTitle ?? m.email}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className={styles.composerBox}>
        <textarea
          ref={ref}
          className={styles.composerInput}
          rows={Math.min(6, Math.max(1, text.split('\n').length))}
          value={text}
          disabled={disabled}
          placeholder="Write a comment…  @ to mention"
          aria-label="Comment"
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? listId : undefined}
          aria-activedescendant={showSuggestions ? `${listId}-${suggestions[active]?.id}` : undefined}
          aria-autocomplete="list"
          aria-keyshortcuts={isMac() ? 'Meta+Enter' : 'Control+Enter'}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
        />
        <Kbd keys={isMac() ? ['⌘', '↵'] : ['Ctrl', '↵']} aria-hidden="true" />
        <Button
          size="sm"
          icon="send"
          aria-label="Send comment"
          onClick={() => void send()}
          disabled={!text.trim() || disabled}
          loading={sending}
        />
      </div>
    </div>
  );
}
