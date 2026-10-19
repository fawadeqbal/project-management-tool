/* @ds-bundle: {"format":4,"namespace":"Hearth","components":[{"name":"Button"},{"name":"Icon"},{"name":"Kbd"},{"name":"Input"},{"name":"TaskCheckbox"},{"name":"Avatar"},{"name":"Tag"},{"name":"StatusPill"},{"name":"Priority"},{"name":"ProgressBar"},{"name":"NavItem"},{"name":"ViewTabs"},{"name":"MenuItem"},{"name":"Toast"},{"name":"TaskRow"},{"name":"GroupHeader"},{"name":"BoardCard"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  function cx() { return Array.prototype.slice.call(arguments).filter(Boolean).join(' '); }

  // Official Lucide icons (lucide-static 0.460.0, ISC license), 24px grid, ~1.33px stroke at 16px.
  var P = {
    'home': "<path d='M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8' /><path d='M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' />",
    'my-tasks': "<path d='m3 17 2 2 4-4' /><path d='m3 7 2 2 4-4' /><path d='M13 6h8' /><path d='M13 12h8' /><path d='M13 18h8' />",
    'inbox': "<polyline points='22 12 16 12 14 15 10 15 8 12 2 12' /><path d='M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' />",
    'folder': "<path d='M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z' />",
    'target': "<circle cx='12' cy='12' r='10' /><circle cx='12' cy='12' r='6' /><circle cx='12' cy='12' r='2' />",
    'doc': "<path d='M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' /><path d='M14 2v4a2 2 0 0 0 2 2h4' /><path d='M10 9H8' /><path d='M16 13H8' /><path d='M16 17H8' />",
    'dashboard': "<rect width='7' height='9' x='3' y='3' rx='1' /><rect width='7' height='5' x='14' y='3' rx='1' /><rect width='7' height='9' x='14' y='12' rx='1' /><rect width='7' height='5' x='3' y='16' rx='1' />",
    'star': "<path d='M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z' />",
    'users': "<path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' /><circle cx='9' cy='7' r='4' /><path d='M22 21v-2a4 4 0 0 0-3-3.87' /><path d='M16 3.13a4 4 0 0 1 0 7.75' />",
    'settings': "<path d='M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' /><circle cx='12' cy='12' r='3' />",
    'search': "<circle cx='11' cy='11' r='8' /><path d='m21 21-4.3-4.3' />",
    'plus': "<path d='M5 12h14' /><path d='M12 5v14' />",
    'bell': "<path d='M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9' /><path d='M10.3 21a1.94 1.94 0 0 0 3.4 0' />",
    'sparkles': "<path d='M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z' /><path d='M20 3v4' /><path d='M22 5h-4' /><path d='M4 17v2' /><path d='M5 18H3' />",
    'chevron-down': "<path d='m6 9 6 6 6-6' />",
    'chevron-right': "<path d='m9 18 6-6-6-6' />",
    'calendar': "<path d='M8 2v4' /><path d='M16 2v4' /><rect width='18' height='18' x='3' y='4' rx='2' /><path d='M3 10h18' />",
    'comment': "<path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />",
    'paperclip': "<path d='m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48' />",
    'more': "<circle cx='12' cy='12' r='1' /><circle cx='19' cy='12' r='1' /><circle cx='5' cy='12' r='1' />",
    'filter': "<path d='M3 6h18' /><path d='M7 12h10' /><path d='M10 18h4' />",
    'list': "<path d='M3 12h.01' /><path d='M3 18h.01' /><path d='M3 6h.01' /><path d='M8 12h13' /><path d='M8 18h13' /><path d='M8 6h13' />",
    'board': "<rect width='18' height='18' x='3' y='3' rx='2' /><path d='M8 7v7' /><path d='M12 7v4' /><path d='M16 7v9' />",
    'timeline': "<path d='M10 6h8' /><path d='M12 16h6' /><path d='M3 3v16a2 2 0 0 0 2 2h16' /><path d='M8 11h7' />",
    'calendar-view': "<path d='M8 2v4' /><path d='M16 2v4' /><rect width='18' height='18' x='3' y='4' rx='2' /><path d='M3 10h18' /><path d='M8 14h.01' /><path d='M12 14h.01' /><path d='M16 14h.01' /><path d='M8 18h.01' /><path d='M12 18h.01' /><path d='M16 18h.01' />",
    'workload': "<path d='M3 3v16a2 2 0 0 0 2 2h16' /><rect x='15' y='5' width='4' height='12' rx='1' /><rect x='7' y='8' width='4' height='9' rx='1' />",
    'help': "<circle cx='12' cy='12' r='10' /><path d='M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' /><path d='M12 17h.01' />",
    'x': "<path d='M18 6 6 18' /><path d='m6 6 12 12' />",
    'clock': "<circle cx='12' cy='12' r='10' /><polyline points='12 6 12 12 16 14' />",
    'arrow-right': "<path d='M5 12h14' /><path d='m12 5 7 7-7 7' />",
    'arrow-up-right': "<path d='M7 7h10v10' /><path d='M7 17 17 7' />",
    'link': "<path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' /><path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' />",
    'check': "<path d='M20 6 9 17l-5-5' />",
    'alert': "<circle cx='12' cy='12' r='10' /><line x1='12' x2='12' y1='8' y2='12' /><line x1='12' x2='12.01' y1='16' y2='16' />",
    'undo': "<path d='M9 14 4 9l5-5' /><path d='M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11' />",
    'loader': "<path d='M21 12a9 9 0 1 1-6.219-8.56' />",
    'archive': "<rect width='20' height='5' x='2' y='3' rx='1' /><path d='M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8' /><path d='M10 12h4' />",
    'at-sign': "<circle cx='12' cy='12' r='4' /><path d='M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8' />",
    'flag': "<path d='M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z' /><line x1='4' x2='4' y1='22' y2='15' />",
    'zap': "<path d='M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z' />",
    'lock': "<rect width='18' height='11' x='3' y='11' rx='2' ry='2' /><path d='M7 11V7a5 5 0 0 1 10 0v4' />",
    'globe': "<circle cx='12' cy='12' r='10' /><path d='M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20' /><path d='M2 12h20' />",
    'user-plus': "<path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' /><circle cx='9' cy='7' r='4' /><line x1='19' x2='19' y1='8' y2='14' /><line x1='22' x2='16' y1='11' y2='11' />",
    'trash': "<path d='M3 6h18' /><path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' /><path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' /><line x1='10' x2='10' y1='11' y2='17' /><line x1='14' x2='14' y1='11' y2='17' />",
    'copy': "<rect width='14' height='14' x='8' y='8' rx='2' ry='2' /><path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' />",
    'external-link': "<path d='M15 3h6v6' /><path d='M10 14 21 3' /><path d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' />",
    'sun': "<circle cx='12' cy='12' r='4' /><path d='M12 2v2' /><path d='M12 20v2' /><path d='m4.93 4.93 1.41 1.41' /><path d='m17.66 17.66 1.41 1.41' /><path d='M2 12h2' /><path d='M20 12h2' /><path d='m6.34 17.66-1.41 1.41' /><path d='m19.07 4.93-1.41 1.41' />",
    'moon': "<path d='M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z' />",
    'layers': "<path d='m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z' /><path d='m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65' /><path d='m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65' />",
    'git-branch': "<line x1='6' x2='6' y1='3' y2='15' /><circle cx='18' cy='6' r='3' /><circle cx='6' cy='18' r='3' /><path d='M18 9a9 9 0 0 1-9 9' />",
    'eye': "<path d='M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0' /><circle cx='12' cy='12' r='3' />",
    'pencil': "<path d='M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z' /><path d='m15 5 4 4' />",
    'smile': "<circle cx='12' cy='12' r='10' /><path d='M8 14s1.5 2 4 2 4-2 4-2' /><line x1='9' x2='9.01' y1='9' y2='9' /><line x1='15' x2='15.01' y1='9' y2='9' />",
    'send': "<path d='M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z' /><path d='m21.854 2.147-10.94 10.939' />",
    'command': "<path d='M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3' />",
    'grip': "<circle cx='9' cy='12' r='1' /><circle cx='9' cy='5' r='1' /><circle cx='9' cy='19' r='1' /><circle cx='15' cy='12' r='1' /><circle cx='15' cy='5' r='1' /><circle cx='15' cy='19' r='1' />",
    'status-todo': "<circle cx='12' cy='12' r='9'/>",
    'status-progress': "<circle cx='12' cy='12' r='9'/><path d='M12 6.5a5.5 5.5 0 0 1 0 11z' fill='currentColor' stroke='none'/>",
    'status-review': "<circle cx='12' cy='12' r='9'/><path d='M12 6.5a5.5 5.5 0 1 1-5.5 5.5H12z' fill='currentColor' stroke='none'/>",
    'status-blocked': "<circle cx='12' cy='12' r='9'/><path d='M8 12h8'/>",
    'status-done': "<circle cx='12' cy='12' r='10' fill='currentColor' stroke='none'/><path d='m7.8 12.4 2.9 2.9 5.5-5.8' style='stroke: var(--bg-surface)' stroke-width='2.6'/>"
  };

  function Icon(props) {
    var size = props.size || 16;
    var sw = props.strokeWidth || (size <= 14 ? 2.2 : size <= 16 ? 2 : size <= 20 ? 1.75 : 1.6);
    return h('svg', {
      className: cx('ht-icon', props.spin && 'ht-spin', props.className), width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round', style: props.style,
      'aria-hidden': props.label ? undefined : 'true', role: props.label ? 'img' : undefined, 'aria-label': props.label,
      dangerouslySetInnerHTML: { __html: P[props.name] || '' }
    });
  }
  Icon.names = Object.keys(P);

  function Button(p) {
    var variant = p.variant || 'primary', size = p.size || 'md';
    var rest = Object.assign({}, p); ['variant', 'size', 'icon', 'iconRight', 'loading', 'children', 'className'].forEach(function (k) { delete rest[k]; });
    var iconOnly = p.icon && !p.children;
    return h('button', Object.assign({ type: 'button' }, rest, {
      className: cx('ht-btn', 'ht-btn-' + variant, size !== 'md' && 'ht-btn-' + size, iconOnly && 'ht-btn-icon', p.className),
      'aria-busy': p.loading ? 'true' : undefined, disabled: p.disabled
    }),
      p.loading ? h(Icon, { name: 'loader', spin: true }) : (p.icon ? h(Icon, { name: p.icon }) : null),
      p.children,
      p.iconRight ? h(Icon, { name: p.iconRight }) : null);
  }

  function Kbd(p) {
    var keys = Array.isArray(p.keys) ? p.keys : [p.children || p.keys];
    return h('span', { className: 'ht-kbds' }, keys.map(function (k, i) { return h('kbd', { key: i, className: 'ht-kbd' }, k); }));
  }

  function Input(p) {
    var field = h('div', { className: cx('ht-input', p.error && 'ht-input-error', p.disabled && 'ht-input-disabled', p.className), style: p.style },
      p.icon ? h(Icon, { name: p.icon }) : null,
      h('input', { placeholder: p.placeholder, defaultValue: p.value, disabled: p.disabled, 'aria-invalid': p.error ? 'true' : undefined, 'aria-label': p.label || p.placeholder, onChange: p.onChange }),
      p.shortcut ? h(Kbd, { keys: p.shortcut }) : null);
    if (!p.label && !p.error && !p.hint) return field;
    return h('label', { className: 'ht-field' },
      p.label ? h('span', { className: 'ht-field-label' }, p.label) : null, field,
      p.error ? h('span', { className: 'ht-field-msg ht-field-msg-error' }, h(Icon, { name: 'alert', size: 14 }), p.error)
        : (p.hint ? h('span', { className: 'ht-field-msg' }, p.hint) : null));
  }

  function TaskCheckbox(p) {
    return h('button', { type: 'button', role: 'checkbox', 'aria-checked': p.checked ? 'true' : 'false', 'aria-label': p.label || 'Mark complete', className: 'ht-check', onClick: p.onChange },
      h(Icon, { name: 'check', size: 10, strokeWidth: 3.5 }));
  }

  var AVATAR_COLORS = ['blue', 'violet', 'green', 'amber', 'sky', 'rose', 'slate'];
  function Avatar(p) {
    var size = p.size || 24;
    var color = p.color || AVATAR_COLORS[((p.initials || 'A').charCodeAt(0) + (p.initials || 'A').length) % AVATAR_COLORS.length];
    return h('span', { className: 'ht-avatar', title: p.name, 'aria-label': p.name || p.initials, role: 'img',
      style: { width: size, height: size, fontSize: size <= 20 ? 9 : size <= 24 ? 10 : size <= 32 ? 12 : 14, background: 'var(--accent-' + color + '-avatar)', color: 'var(--accent-' + color + '-fg)' } }, p.initials);
  }
  function AvatarGroup(p) {
    var items = p.people || [], max = p.max || 4;
    var shown = items.slice(0, max);
    return h('span', { className: 'ht-avatars' }, shown.map(function (a, i) { return h(Avatar, Object.assign({ key: i, size: p.size || 28 }, a)); }),
      items.length > max ? h('span', { className: 'ht-avatar', style: { width: p.size || 28, height: p.size || 28, fontSize: 11, background: 'var(--bg-subtle)', color: 'var(--text-secondary)' } }, '+' + (items.length - max)) : null);
  }

  function Tag(p) {
    var c = p.color || 'slate';
    return h('span', { className: 'ht-tag' },
      h('i', { style: { background: 'var(--accent-' + c + '-dot)' } }), p.children);
  }

  var STATUS = {
    todo: ['To do', 'status-todo', '--status-todo', '--status-todo-bg'],
    'in-progress': ['In progress', 'status-progress', '--status-progress', '--status-progress-bg'],
    'in-review': ['In review', 'status-review', '--status-review', '--status-review-bg'],
    blocked: ['Blocked', 'status-blocked', '--status-blocked', '--status-blocked-bg'],
    done: ['Done', 'status-done', '--status-done', '--status-done-bg']
  };
  function StatusIcon(p) { var s = STATUS[p.status || 'todo']; return h(Icon, { name: s[1], size: p.size || 16, style: { color: 'var(' + s[2] + ')' }, label: p.label ? s[0] : undefined }); }
  function StatusPill(p) {
    var s = STATUS[p.status || 'todo'];
    return h('span', { className: 'ht-status' }, h(StatusIcon, { status: p.status, size: 14 }), p.label || s[0]);
  }

  var PRI = { urgent: ['Urgent', 3], high: ['High', 3], medium: ['Medium', 2], low: ['Low', 1], none: ['No priority', 0] };
  function PriorityIcon(p) {
    var lvl = p.level || 'none', s = PRI[lvl];
    var inner;
    if (lvl === 'urgent') {
      inner = h(React.Fragment, null, h('rect', { x: 1, y: 1, width: 14, height: 14, rx: 3.5, fill: 'var(--priority-urgent)' }),
        h('rect', { x: 7.1, y: 4, width: 1.8, height: 5.2, rx: 0.9, fill: 'var(--bg-surface)' }), h('rect', { x: 7.1, y: 10.6, width: 1.8, height: 1.8, rx: 0.9, fill: 'var(--bg-surface)' }));
    } else if (lvl === 'none') {
      inner = [2, 6.5, 11].map(function (x, i) { return h('rect', { key: i, x: x, y: 7.25, width: 3, height: 1.5, rx: 0.75, fill: 'var(--priority-bar-empty)' }); });
    } else {
      inner = [0, 1, 2].map(function (i) { return h('rect', { key: i, x: 2 + i * 4.5, y: 11 - i * 3.5, width: 3, height: 3 + i * 3.5, rx: 1, fill: i < s[1] ? 'var(--priority-bar)' : 'var(--priority-bar-empty)' }); });
    }
    return h('svg', { className: 'ht-icon', width: 16, height: 16, viewBox: '0 0 16 16', role: 'img', 'aria-label': 'Priority: ' + s[0] }, inner);
  }
  function Priority(p) {
    if (!p.showLabel) return h(PriorityIcon, { level: p.level });
    return h('span', { className: 'ht-priority' }, h(PriorityIcon, { level: p.level }), PRI[p.level || 'none'][0]);
  }

  function ProgressBar(p) {
    var v = Math.max(0, Math.min(100, p.value || 0));
    return h('div', { className: 'ht-progress', role: 'progressbar', 'aria-valuenow': v, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': p.label, style: Object.assign({ height: p.height }, p.style) },
      h('i', { style: { width: v + '%', background: p.tone === 'success' ? 'var(--status-done)' : undefined } }));
  }

  function NavItem(p) {
    return h('a', { className: 'ht-nav', href: p.href || '#', 'aria-current': p.active ? 'page' : undefined, style: p.style },
      p.dot ? h('span', { className: 'ht-nav-dot', style: { background: 'var(--accent-' + p.dot + '-dot)' } }) : h(Icon, { name: p.icon || 'folder' }),
      h('span', { className: 'ht-nav-label' }, p.label),
      p.count != null ? h('span', { className: 'ht-nav-count' }, p.count) : null);
  }

  function ViewTabs(p) {
    return h('div', { className: 'ht-tabs', role: 'tablist', 'aria-label': p.label || 'Views' }, (p.tabs || []).map(function (t) {
      return h('button', { key: t.id, type: 'button', role: 'tab', className: 'ht-tab', 'aria-selected': t.id === p.value ? 'true' : 'false', onClick: p.onChange ? function () { p.onChange(t.id); } : undefined },
        t.icon ? h(Icon, { name: t.icon }) : null, t.label);
    }));
  }

  function MenuItem(p) {
    return h('div', { className: 'ht-menuitem', role: 'option', 'aria-selected': p.highlighted ? 'true' : 'false', 'data-highlighted': p.highlighted ? 'true' : undefined },
      p.icon ? h(Icon, { name: p.icon, style: p.iconColor ? { color: p.iconColor } : undefined }) : null,
      h('span', { className: 'ht-menuitem-label' }, p.label, p.hint ? h('span', { className: 'ht-menuitem-hint' }, '  ·  ' + p.hint) : null),
      p.shortcut ? h(Kbd, { keys: p.shortcut }) : null);
  }

  function Toast(p) {
    return h('div', { className: 'ht-toast', role: 'status', 'aria-live': 'polite' },
      h(Icon, { name: p.icon || 'status-done', style: { color: p.icon ? undefined : 'var(--status-done)' } }),
      h('span', null, p.message),
      p.action !== false ? h('button', { type: 'button', className: 'ht-toast-action', onClick: p.onAction }, p.action || 'Undo') : null,
      h('button', { type: 'button', className: 'ht-toast-close', 'aria-label': 'Dismiss' }, h(Icon, { name: 'x' })));
  }

  function Due(p) {
    if (!p.children) return null;
    return h('span', { className: cx('ht-due', p.tone === 'danger' && 'ht-due-danger') }, h(Icon, { name: 'calendar', style: p.tone === 'danger' ? undefined : { color: 'var(--text-tertiary)' } }), p.children);
  }

  function GroupHeader(p) {
    return h('div', { className: 'ht-group' },
      h(Icon, { name: p.collapsed ? 'chevron-right' : 'chevron-down', style: { color: 'var(--text-tertiary)' } }),
      p.status ? h(StatusIcon, { status: p.status }) : (p.icon ? h(Icon, { name: p.icon, style: { color: p.iconColor || 'var(--text-secondary)' } }) : null),
      h('span', null, p.label), h('span', { className: 'ht-group-count' }, p.count),
      h(Icon, { name: 'plus', style: { color: 'var(--text-tertiary)' } }));
  }

  function TaskRow(p) {
    var compact = p.compact;
    return h('div', { className: cx('ht-taskrow', p.done && 'ht-taskrow-done'), role: 'row', 'aria-selected': p.selected ? 'true' : undefined },
      h(TaskCheckbox, { checked: p.done }),
      h(PriorityIcon, { level: p.priority || 'none' }),
      h('span', { className: 'ht-taskrow-id' }, p.id),
      h('span', { className: 'ht-taskrow-title', title: p.title }, p.title),
      !compact && p.tag ? h('span', { className: 'ht-cell-tag' }, h(Tag, { color: p.tagColor }, p.tag)) : null,
      h('span', { className: 'ht-cell-status' }, h(StatusPill, { status: p.status || 'todo' })),
      !compact ? h('span', { className: 'ht-cell-due' }, h(Due, { tone: p.dueTone }, p.due)) : null,
      p.assignee ? h(Avatar, { initials: p.assignee, size: 24, color: p.assigneeColor }) : null);
  }

  function BoardCard(p) {
    return h('div', { className: cx('ht-card', p.dragging && 'ht-card-dragging'), style: Object.assign({ opacity: p.muted ? 0.72 : undefined }, p.style) },
      h('div', { className: 'ht-card-top' }, h('span', { className: 'ht-card-id' }, p.id), h(PriorityIcon, { level: p.priority || 'none' })),
      h('div', { className: 'ht-card-title' }, p.title),
      p.tags && p.tags.length ? h('div', { className: 'ht-card-tags' }, p.tags.map(function (t, i) { return h(Tag, { key: i, color: t.color }, t.label); })) : null,
      h('div', { className: 'ht-card-meta' },
        h(Due, { tone: p.dueTone }, p.due),
        p.comments != null ? h('span', { className: 'ht-due' }, h(Icon, { name: 'comment', style: { color: 'var(--text-tertiary)' } }), p.comments) : null,
        h('span', { className: 'ht-spacer' }),
        p.assignee ? h(Avatar, { initials: p.assignee, size: 24, color: p.assigneeColor }) : null));
  }

  window.Hearth = Object.assign(window.Hearth || {}, {
    Button: Button, Icon: Icon, Kbd: Kbd, Input: Input, TaskCheckbox: TaskCheckbox, Avatar: Avatar, AvatarGroup: AvatarGroup, Tag: Tag,
    StatusPill: StatusPill, StatusIcon: StatusIcon, Priority: Priority, PriorityIcon: PriorityIcon, ProgressBar: ProgressBar, NavItem: NavItem,
    ViewTabs: ViewTabs, MenuItem: MenuItem, Toast: Toast, Due: Due, TaskRow: TaskRow, GroupHeader: GroupHeader, BoardCard: BoardCard
  });
})();
