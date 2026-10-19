import { useState } from 'react';
import { Avatar, Button, Dialog, Input, Select } from '@hearth/ui';
import type { TimeOffDto } from '@hearth/contracts';
import { formatShortDate, parseDateOnly } from '@hearth/domain';
import { ApiError } from '@/shared/api/http';
import { useAuthStore } from '@/shared/auth/auth-store';
import { usePermission } from '@/shared/auth/use-permission';
import { useMembers } from '@/shared/workspace/hooks';
import { useTimeOff, useTimeOffMutations } from '../api';
import styles from '../workload.module.css';

const span = (t: TimeOffDto) => {
  const a = formatShortDate(parseDateOnly(t.startDate));
  return t.startDate === t.endDate ? a : `${a} – ${formatShortDate(parseDateOnly(t.endDate))}`;
};

/** Add time off (members for themselves, admins for anyone) and see what's planned. */
export function TimeOffDialog({ onClose, defaultDate }: { onClose: () => void; defaultDate: string }) {
  const me = useAuthStore((s) => s.me);
  const canManage = usePermission('members.manage');
  const { data: members = [] } = useMembers();
  const { data: entries = [] } = useTimeOff();
  const mutations = useTimeOffMutations();
  const [userId, setUserId] = useState(me?.user.id ?? '');
  const [startDate, setStart] = useState(defaultDate);
  const [endDate, setEnd] = useState(defaultDate);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const invalid = endDate < startDate;
  const mine = (t: TimeOffDto) => t.user.id === me?.user.id;

  const save = async () => {
    setError(null);
    try {
      await mutations.add({ userId: canManage ? userId : undefined, startDate, endDate, reason: reason.trim() || null });
      setReason('');
    } catch (e) {
      const err = ApiError.from(e);
      if (err.kind !== 'limit_reached') setError(err.message);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Time off"
      description="Time off shows as hatched days, so it never reads as free capacity."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button loading={mutations.isAdding} disabled={invalid || !startDate} onClick={() => void save()}>
            Add time off
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        {canManage ? (
          <Select
            label="Who"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            options={members.filter((m) => m.status === 'ACTIVE' && m.role !== 'GUEST').map((m) => ({ value: m.id, label: m.id === me?.user.id ? `${m.name} (you)` : m.name }))}
          />
        ) : null}
        <div className={styles.formRow}>
          <Input label="From" type="date" value={startDate} onChange={(e) => setStart(e.target.value)} />
          <Input label="To" type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} error={invalid ? 'Pick an end date on or after the start.' : undefined} />
        </div>
        <Input label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vacation, conference…" />
        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}
        {entries.length ? (
          <ul className={styles.timeOffList} aria-label="Planned time off">
            {entries.map((t) => (
              <li key={t.id} className={styles.timeOffItem}>
                <Avatar initials={t.user.initials} name={t.user.name} color={t.user.avatarColor} size={24} />
                <span className={styles.timeOffName}>{t.user.name}</span>
                <span className={styles.mutedText}>
                  {span(t)}
                  {t.reason ? ` · ${t.reason}` : ''}
                </span>
                {mine(t) || canManage ? (
                  <Button size="sm" variant="ghost" icon="trash" aria-label={`Remove ${t.user.name}’s time off ${span(t)}`} onClick={() => void mutations.remove(t)} />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Dialog>
  );
}
