import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@hearth/ui';
import styles from '../dashboard.module.css';

/** A dashboard widget; in edit mode it gets a drag handle (keyboard: Space to lift, arrows to move). */
export function SortableWidget({
  id,
  label,
  editing,
  wide,
  children,
}: {
  id: string;
  label: string;
  editing: boolean;
  wide: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editing,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${styles.widget} ${wide ? styles.widgetWide : styles.widgetHalf} ${editing ? styles.widgetEditing : ''} ${isDragging ? styles.widgetDragging : ''}`}
      data-widget={id}
    >
      {editing ? (
        <button
          type="button"
          className={styles.dragHandle}
          aria-label={`Move ${label}`}
          {...attributes}
          {...listeners}
        >
          <Icon name="grip" />
          <span>{label}</span>
        </button>
      ) : null}
      {children}
    </div>
  );
}
