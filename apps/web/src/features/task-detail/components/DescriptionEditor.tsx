import { useEffect, useState } from 'react';
import { Textarea } from '@hearth/ui';

/** Description with autosave on blur. */
export function DescriptionEditor({ value, onSave, disabled }: { value: string | null; onSave: (v: string | null) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState(value ?? '');
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(value ?? '');
  }, [value, focused]);
  return (
    <Textarea
      label="Description"
      hideLabel
      placeholder="Add a description — context, links, acceptance criteria…"
      value={draft}
      rows={Math.min(12, Math.max(3, draft.split('\n').length + 1))}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const next = draft.trim() ? draft : null;
        if ((next ?? '') !== (value ?? '')) onSave(next);
      }}
    />
  );
}
