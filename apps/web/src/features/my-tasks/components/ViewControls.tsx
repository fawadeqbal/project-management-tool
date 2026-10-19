import { Button, DropdownMenu, Icon } from '@hearth/ui';
import { GROUPINGS, SORTS, type MyTasksView } from '../view-state';
import styles from '../my-tasks.module.css';

/** "Group: Due date" and "Sort: Priority" menus. */
export function ViewControls({ view, onChange }: { view: MyTasksView; onChange: (patch: Partial<MyTasksView>) => void }) {
  const groupLabel = GROUPINGS.find((g) => g.id === view.grouping)?.label ?? 'Due date';
  const sortLabel = SORTS.find((s) => s.id === view.sort)?.label ?? 'Priority';
  return (
    <>
      <DropdownMenu
        label="Group by"
        items={GROUPINGS.map((g) => ({
          id: g.id,
          label: g.label,
          icon: g.id === view.grouping ? ('check' as const) : undefined,
          onSelect: () => onChange({ grouping: g.id }),
        }))}
        trigger={
          <button type="button" className={styles.groupChip}>
            <Icon name="list" />
            Group: {groupLabel}
          </button>
        }
      />
      <DropdownMenu
        label="Sort by"
        items={SORTS.map((s) => ({
          id: s.id,
          label: s.label,
          icon: s.id === view.sort ? ('check' as const) : undefined,
          onSelect: () => onChange({ sort: s.id }),
        }))}
        trigger={
          <Button variant="secondary" size="sm" iconRight="chevron-down">
            Sort: {sortLabel}
          </Button>
        }
      />
    </>
  );
}
