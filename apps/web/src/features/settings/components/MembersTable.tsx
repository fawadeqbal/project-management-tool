import type { AdminMemberDto } from '@hearth/contracts';
import type { Role } from '@hearth/domain';
import { VisuallyHidden } from '@hearth/ui';
import { MemberRow, type MemberRowProps } from './MemberRow';
import styles from '../settings.module.css';

type Handlers = Omit<MemberRowProps, 'member'>;

/** Members table; guests and deactivated people are visually separated into their own groups. */
export function MembersTable({ members, ...handlers }: { members: AdminMemberDto[] } & Handlers & { assignable: readonly Role[] }) {
  const active = members.filter((m) => m.status === 'ACTIVE' && !m.isGuest);
  const guests = members.filter((m) => m.status === 'ACTIVE' && m.isGuest);
  const deactivated = members.filter((m) => m.status === 'DEACTIVATED');
  const group = (label: string, list: AdminMemberDto[]) =>
    list.length ? (
      <div role="rowgroup" aria-label={label}>
        {label !== 'Members' ? (
          <div role="row" className={styles.groupRow}>
            <span role="columnheader" aria-colspan={5}>
              {label} · {list.length}
            </span>
          </div>
        ) : null}
        {list.map((m) => (
          <MemberRow key={m.id} member={m} {...handlers} />
        ))}
      </div>
    ) : null;
  return (
    <section aria-label="Members" className={styles.tableWrap}>
      <div role="table" aria-label="Members" className={styles.table}>
        <div role="rowgroup">
          <div role="row" className={`${styles.row} ${styles.headRow}`}>
            <span role="columnheader">Person</span>
            <span role="columnheader">Teams</span>
            <span role="columnheader">Role</span>
            <span role="columnheader">Last active</span>
            <span role="columnheader">
              <VisuallyHidden>Actions</VisuallyHidden>
            </span>
          </div>
        </div>
        {group('Members', active)}
        {group('Guests', guests)}
        {group('Deactivated', deactivated)}
        {!members.length ? <p className={styles.noMatch}>No one matches that search.</p> : null}
      </div>
    </section>
  );
}
