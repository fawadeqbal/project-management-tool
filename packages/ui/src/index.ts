// Types, labels and domain mappers
export {
  ACCENT_COLORS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  accentVar,
  toDomainPriority,
  toDomainStatus,
  toUiPriority,
  toUiStatus,
  type AccentColor,
  type DomainPriority,
  type DomainStatus,
  type PriorityLevel,
  type Status,
} from './types';

// Ported from the Hearth bundle
export { Icon, ICON_NAMES, isIconName, type IconName, type IconProps } from './components/Icon';
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './components/Button';
export { Kbd, type KbdProps } from './components/Kbd';
export { Input, type InputProps } from './components/Input';
export { Textarea, type TextareaProps } from './components/Textarea';
export { TaskCheckbox, type TaskCheckboxProps } from './components/TaskCheckbox';
export {
  Avatar,
  AvatarGroup,
  avatarColorFor,
  type AvatarGroupProps,
  type AvatarPerson,
  type AvatarProps,
  type AvatarSize,
} from './components/Avatar';
export { Tag, type TagProps } from './components/Tag';
export { StatusIcon, StatusPill, type StatusIconProps, type StatusPillProps } from './components/Status';
export { Priority, PriorityIcon, type PriorityIconProps, type PriorityProps } from './components/Priority';
export { ProgressBar, type ProgressBarProps } from './components/ProgressBar';
export { NavItem, type NavItemProps } from './components/NavItem';
export { ViewTabs, type ViewTab, type ViewTabsProps } from './components/ViewTabs';
export { MenuHeading, MenuItem, type MenuHeadingProps, type MenuItemProps } from './components/MenuItem';
export { Toast, type ToastProps } from './components/Toast';
export { Due, type DueProps } from './components/Due';
export { GroupHeader, type GroupHeaderProps } from './components/GroupHeader';
export { TaskRow, type TaskRowProps } from './components/TaskRow';
export { BoardCard, type BoardCardProps, type BoardCardTag } from './components/BoardCard';

// Additional primitives
export { Portal, type PortalProps } from './components/Portal';
export { Dialog, type DialogProps, type DialogSize } from './components/Dialog';
export { Popover, type PopoverProps, type PopoverTriggerProps } from './components/Popover';
export {
  DropdownMenu,
  type DropdownMenuEntries,
  type DropdownMenuItem,
  type DropdownMenuProps,
  type DropdownMenuSection,
} from './components/DropdownMenu';
export { Tooltip, type TooltipProps } from './components/Tooltip';
export { SegmentedControl, type SegmentedControlProps, type SegmentedOption } from './components/SegmentedControl';
export { Switch, type SwitchProps } from './components/Switch';
export { Select, type SelectOption, type SelectProps } from './components/Select';
export { Skeleton, Spinner, type SkeletonProps, type SpinnerProps } from './components/Skeleton';
export { EmptyState, type EmptyStateProps } from './components/EmptyState';
export { Badge, type BadgeProps, type BadgeTone } from './components/Badge';
export { KpiTile, type KpiTileProps, type KpiTone } from './components/KpiTile';
export { Card, type CardPadding, type CardProps } from './components/Card';
export { SkipLink, VisuallyHidden, type SkipLinkProps, type VisuallyHiddenProps } from './components/VisuallyHidden';
