# @hearth/ui

The Hearth design system as typed React 19 components: tokens (light and dark), 61 icons and the
components the screens in `docs/design-reference/` are built from. It only renders things. It does
not fetch data, route or hold app state.

Source of truth: `docs/design-reference/ds/hearth/` (`tokens.css`, `components/bundle.css`,
`components/bundle.js`). The component classes (`ht-*`) and token names match the reference.

## Usage

```tsx
// once, at the app entry
import '@hearth/ui/styles.css';

import { Button, StatusPill, TaskRow, toUiStatus, toUiPriority } from '@hearth/ui';

<Button icon="plus" onClick={create}>Add task</Button>
<Button variant="ghost" size="sm" icon="more" aria-label="More actions" />
<StatusPill status={toUiStatus(task.status)} />

<div className="ht-list" role="table" aria-label="My tasks">
  <div role="rowgroup">
    <TaskRow
      id={task.key}
      title={task.title}
      status={toUiStatus(task.status)}
      priority={toUiPriority(task.priority)}
      onOpen={() => openPanel(task.id)}
      onToggleDone={(done) => complete(task.id, done)}
    />
  </div>
</div>
```

`styles.css` loads the Geist fonts from Google Fonts, the tokens, the component styles and a small
base layer: `box-sizing`, body font, background and colour from tokens, a global `:focus-visible`
ring (2px `--border-focus`, 2px offset), and a `prefers-reduced-motion` rule.

## Theming

Themes are CSS custom properties keyed on `data-theme`:

```ts
document.documentElement.dataset.theme = 'dark'; // or 'light'
```

`:root` and `[data-theme="light"]` define the light theme; `[data-theme="dark"]` overrides it. Any
subtree can set its own `data-theme`. Components use only `var(--…)` tokens, never hex values, so
both themes come for free. Use the tokens in app code too: `--bg-*`, `--text-*`, `--border-*`,
`--brand-*`, `--status-*`, `--accent-<hue>-{bg,fg,dot,avatar}`, `--space-*`, `--radius-*`,
`--shadow-1..4`, `--font-sans` and `--font-mono`.

## Components

Ported from the reference bundle:

| Component                         | Key props                                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Icon`, `ICON_NAMES`, `IconName`  | `name`, `size` (16), `label` (makes it `role="img"`; without one it is decorative), `spin`, `strokeWidth`                                                                                                          |
| `Button` (forwardRef)             | `variant` primary/secondary/ghost/danger, `size` sm/md/lg, `icon`, `iconRight`, `loading` (sets `aria-busy`), plus all button props. Icon-only buttons need `aria-label` and warn in dev without one               |
| `Kbd`                             | `keys: string \| string[]`                                                                                                                                                                                         |
| `Input` (forwardRef to `<input>`) | `label`, `hideLabel`, `hint`, `error`, `icon`, `shortcut`, plus native input props                                                                                                                                 |
| `Textarea` (forwardRef)           | same field chrome as `Input`                                                                                                                                                                                       |
| `TaskCheckbox`                    | `checked`, `label`, `onChange(next)`                                                                                                                                                                               |
| `Avatar`, `AvatarGroup`           | `initials`, `name`, `size` 20/24/28/32/40, `color: AccentColor`; group: `people`, `max` (4), `size`                                                                                                                |
| `Tag`                             | `color`, `children`                                                                                                                                                                                                |
| `StatusIcon`, `StatusPill`        | `status`, `size`, `label`                                                                                                                                                                                          |
| `PriorityIcon`, `Priority`        | `level`, `showLabel`                                                                                                                                                                                               |
| `ProgressBar`                     | `value` (0–100), `label`, `tone` brand/success, `height`                                                                                                                                                           |
| `NavItem`                         | `label`, `icon`, `dot`, `count`, `active`, `linkComponent` (e.g. react-router `Link`, then pass `to`), `href`                                                                                                      |
| `ViewTabs`                        | `tabs`, `value`, `onChange`, `label`. Roving tabindex; arrow keys, Home and End switch tabs                                                                                                                        |
| `MenuItem`, `MenuHeading`         | `label`, `icon`, `iconColor`, `shortcut`, `hint`, `highlighted`, `disabled`, `danger`, `onSelect` (`role="option"`)                                                                                                |
| `Toast`                           | `message`, `action` (string or `false`), `icon`, `onAction`, `onDismiss`, `politeness`                                                                                                                             |
| `Due`                             | `tone` default/danger, `children`                                                                                                                                                                                  |
| `GroupHeader`                     | `label`, `count`, `status`, `icon`, `iconColor`, `collapsed`, `onToggle` (real button with `aria-expanded`), `onAdd`                                                                                               |
| `TaskRow`                         | `id`, `title`, `priority`, `status`, `tag`, `tagColor`, `due`, `dueTone`, `assignee`, `assigneeColor`, `assigneeName`, `selected`, `done`, `compact`, `onToggleDone`, `onOpen`, `trailing`. Focusable; Enter opens |
| `BoardCard` (forwardRef)          | `id`, `title`, `priority`, `tags`, `due`, `dueTone`, `comments`, `assignee`, `assigneeColor`, `dragging`, `muted`, `onClick`. Spread dnd-kit `attributes`, `listeners` and `style` onto it                         |

New primitives, built in the same style:

| Component                    | Key props                                                                                                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dialog`                     | `open`, `onClose`, `title`, `description`, `footer`, `size` sm/md/lg, `initialFocusRef`, `role`. Portals to body, traps focus, closes on Esc, returns focus to the trigger, locks body scroll |
| `Popover`                    | `open`, `onOpenChange`, `anchorRef` or `renderTrigger`, `align` start/center/end, `placement` bottom/top. Closes on outside click and Esc                                                     |
| `DropdownMenu`               | `trigger` (element), `items` (flat items or `{ id, heading, items }` sections), `label`, `align`. Keyboard: ↑, ↓, Home, End, Enter/Space, Esc, Tab and typeahead                              |
| `Tooltip`                    | `content`, `children` (one focusable element), `delay` (400ms). Shows on hover or focus; wired with `aria-describedby`                                                                        |
| `SegmentedControl`           | `options`, `value`, `onChange`, `label` (radiogroup)                                                                                                                                          |
| `Switch`                     | `checked`, `onChange`, `label` (`role="switch"`)                                                                                                                                              |
| `Select`                     | native `<select>` with `label`, `hint`, `error`, `options`, `placeholder`                                                                                                                     |
| `Skeleton`, `Spinner`        | `width`, `height`, `radius`; `size`, `label`                                                                                                                                                  |
| `EmptyState`                 | `icon` or `illustration`, `title`, `description`, `primaryAction`, `secondaryAction`                                                                                                          |
| `Badge`                      | `tone` neutral/success/warning/danger/info/brand, `icon`, `children`                                                                                                                          |
| `KpiTile`                    | `label`, `value`, `delta`, `deltaTone`, `sub`, `valueTone`, `icon`                                                                                                                            |
| `Card`                       | `padding` none/sm/md/lg                                                                                                                                                                       |
| `VisuallyHidden`, `SkipLink` | screen-reader-only text; a "Skip to content" link that targets `#main`                                                                                                                        |
| `Portal`                     | renders into `document.body`                                                                                                                                                                  |

Types and helpers: `Status`, `PriorityLevel`, `AccentColor`, `DomainStatus`, `DomainPriority`,
`STATUS_LABELS`, `PRIORITY_LABELS`, `toUiStatus`, `toUiPriority`, `toDomainStatus`,
`toDomainPriority`, `accentVar`, `avatarColorFor`, `isIconName`.

## Accessibility

- Every interactive element is a real button, link or input, or a composite widget with the
  matching ARIA role and keyboard support. All of them show a visible focus ring.
- Icon-only buttons must have an `aria-label`. In development, `Button` warns when one is missing.
- Colour is never the only signal. Status, priority and badges always carry a text label or an
  accessible name.
- Toasts are live regions (`role="status"`, or `role="alert"` with `politeness="assertive"`).
- On coarse pointers, touch targets grow to at least 44px. Motion respects
  `prefers-reduced-motion`.

## Scripts

```sh
pnpm --filter @hearth/ui typecheck   # tsc --noEmit
pnpm --filter @hearth/ui test        # vitest run
pnpm --filter @hearth/ui lint
```
