import { Dialog, Icon, Skeleton, VisuallyHidden } from '@hearth/ui';
import { useRoles } from '../api';
import styles from '../settings.module.css';

/** The full role × permission matrix — one click away, not on the main screen. */
export function PermissionMatrixDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useRoles(open);
  return (
    <Dialog open={open} onClose={onClose} size="lg" title="Permission matrix" description="What each role can do. The API enforces exactly this.">
      {!data ? (
        <Skeleton height={240} />
      ) : (
        <div className={styles.matrixWrap}>
          <table className={styles.matrix}>
            <caption>
              <VisuallyHidden>Permissions by role</VisuallyHidden>
            </caption>
            <thead>
              <tr>
                <th scope="col">Permission</th>
                {data.roles.map((r) => (
                  <th key={r.role} scope="col" title={r.description}>
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.matrix.map((row) => (
                <tr key={row.permission}>
                  <th scope="row">{row.label}</th>
                  {data.roles.map((r) => (
                    <td key={r.role}>
                      {row.roles.includes(r.role) ? <Icon name="check" label={`${r.label}: allowed`} className={styles.allowed} /> : <span className={styles.denied}><VisuallyHidden>{r.label}: not allowed</VisuallyHidden><span aria-hidden="true">—</span></span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}
