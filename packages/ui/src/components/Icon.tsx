import { createElement, type SVGProps } from 'react';
import { cx } from '../internal/cx';
import { devWarn } from '../internal/dev';
import { ICON_NAMES, ICON_NODES, type IconName } from '../internal/icon-nodes';

export { ICON_NAMES, type IconName };

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'children' | 'ref'> {
  name: IconName;
  /** Pixel size of the square icon. Default 16. */
  size?: number;
  /** Accessible name. Without it the icon is decorative (`aria-hidden`). */
  label?: string;
  spin?: boolean;
  /** Defaults scale with size like the reference: 2.2 (<=14), 2 (<=16), 1.75 (<=20), 1.6. */
  strokeWidth?: number;
}

function defaultStroke(size: number): number {
  if (size <= 14) return 2.2;
  if (size <= 16) return 2;
  if (size <= 20) return 1.75;
  return 1.6;
}

export function isIconName(value: string): value is IconName {
  return Object.prototype.hasOwnProperty.call(ICON_NODES, value);
}

/** Lucide-based stroke icon. Unknown names render nothing. */
export function Icon({ name, size = 16, label, spin, strokeWidth, className, ...rest }: IconProps) {
  if (!isIconName(name)) {
    devWarn(`Unknown icon "${String(name)}".`);
    return null;
  }
  const nodes = ICON_NODES[name];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? defaultStroke(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...rest}
      className={cx('ht-icon', spin && 'ht-spin', className)}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {nodes.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
