import { type CSSProperties, type HTMLAttributes } from 'react';
import { cx } from '../internal/cx';
import { ACCENT_COLORS, accentVar, type AccentColor } from '../types';

export type AvatarSize = 20 | 24 | 28 | 32 | 40;

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  initials: string;
  /** Full name, used as the accessible name and tooltip. */
  name?: string;
  size?: AvatarSize;
  /** Accent hue. Defaults to a stable hue derived from the initials. */
  color?: AccentColor;
}

function fontSizeFor(size: number): number {
  if (size <= 20) return 9;
  if (size <= 24) return 10;
  if (size <= 32) return 12;
  return 14;
}

/** Deterministic accent for a set of initials (matches the reference bundle). */
export function avatarColorFor(initials: string): AccentColor {
  const seed = initials || 'A';
  return ACCENT_COLORS[(seed.charCodeAt(0) + seed.length) % ACCENT_COLORS.length] ?? 'slate';
}

export function Avatar({ initials, name, size = 24, color, className, style, ...rest }: AvatarProps) {
  const hue = color ?? avatarColorFor(initials);
  const sizing: CSSProperties = {
    width: size,
    height: size,
    fontSize: fontSizeFor(size),
    background: accentVar(hue, 'avatar'),
    color: accentVar(hue, 'fg'),
  };
  return (
    <span
      role="img"
      aria-label={name ?? initials}
      title={name}
      {...rest}
      className={cx('ht-avatar', className)}
      style={{ ...sizing, ...style }}
    >
      <span aria-hidden="true">{initials}</span>
    </span>
  );
}

export interface AvatarPerson {
  initials: string;
  name?: string;
  color?: AccentColor;
}

export interface AvatarGroupProps extends HTMLAttributes<HTMLSpanElement> {
  people: readonly AvatarPerson[];
  /** Avatars shown before collapsing the rest into "+N". Default 4. */
  max?: number;
  size?: AvatarSize;
}

export function AvatarGroup({ people, max = 4, size = 28, className, ...rest }: AvatarGroupProps) {
  const shown = people.slice(0, max);
  const hidden = people.length - shown.length;
  return (
    <span role="group" {...rest} className={cx('ht-avatars', className)}>
      {shown.map((p, i) => (
        <Avatar key={`${p.initials}-${i}`} size={size} initials={p.initials} name={p.name} color={p.color} />
      ))}
      {hidden > 0 ? (
        <span
          className="ht-avatar"
          role="img"
          aria-label={`${hidden} more`}
          style={{ width: size, height: size, fontSize: 11, background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
        >
          <span aria-hidden="true">+{hidden}</span>
        </span>
      ) : null}
    </span>
  );
}
