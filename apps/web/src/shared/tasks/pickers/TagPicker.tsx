import { Tag } from '@hearth/ui';
import type { TagDto } from '@hearth/contracts';
import { ACCENT_COLORS } from '@hearth/domain';
import { useCreateTag, useTags } from '@/shared/workspace/hooks';
import { PickerList } from './PickerList';
import { PropertyPopover, type PropertyPopoverProps } from './PropertyPopover';

export interface TagPickerProps extends Omit<PropertyPopoverProps, 'label' | 'children'> {
  value: readonly TagDto[];
  /** Called with the full new set of tag ids. */
  onChange: (tagIds: string[]) => void;
}

/** Toggle existing tags or create a new one from the filter text. Stays open for multi-select. */
export function TagPicker({ value, onChange, onOpenChange, ...popover }: TagPickerProps) {
  const { data: tags = [], isLoading } = useTags();
  const createTag = useCreateTag();
  const selected = new Set(value.map((t) => t.id));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };
  return (
    <PropertyPopover {...popover} onOpenChange={onOpenChange} label="Edit tags">
      <PickerList
        label="Tags"
        searchable
        placeholder="Add a tag…"
        emptyText={isLoading ? 'Loading tags…' : 'No tags yet — type to create one.'}
        options={tags.map((t) => ({
          id: t.id,
          text: t.name,
          label: <Tag color={t.color}>{t.name}</Tag>,
          icon: selected.has(t.id) ? ('check' as const) : undefined,
          selected: selected.has(t.id),
        }))}
        onSelect={toggle}
        createLabel={(t) => `Create tag “${t}”`}
        onCreate={(name) => {
          const color = ACCENT_COLORS[tags.length % ACCENT_COLORS.length];
          createTag.mutate({ name, color }, { onSuccess: (tag) => onChange([...selected, tag.id]) });
        }}
      />
    </PropertyPopover>
  );
}
