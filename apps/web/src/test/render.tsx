import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { MeDto, TaskDto } from '@hearth/contracts';
import { ROLE_PERMISSIONS } from '@hearth/domain';
import { useAuthStore } from '@/shared/auth/auth-store';
import { CommandsProvider } from '@/shared/commands/CommandsProvider';
import { hotkeys } from '@/shared/hotkeys/hotkey-service';
import { ThemeProvider } from '@/shared/theme';
import { ToastRegion, useToastStore } from '@/shared/toast';

type MemoryRouter = ReturnType<typeof createMemoryRouter>;

export const testMe: MeDto = {
  user: {
    id: 'u1',
    email: 'fawad@acme.com',
    name: 'Fawad Iqbal',
    initials: 'FI',
    avatarColor: 'blue',
    jobTitle: 'Designer',
    theme: 'light',
  },
  workspace: { id: 'w1', name: 'Acme Studio', slug: 'acme', keyPrefix: 'HRT', role: 'MEMBER' },
  workspaces: [{ id: 'w1', name: 'Acme Studio', slug: 'acme', keyPrefix: 'HRT', role: 'MEMBER' }],
  permissions: [...ROLE_PERMISSIONS.MEMBER],
};

export const signIn = (me: MeDto = testMe) => useAuthStore.getState().signIn('test-token', me);

export const makeTask = (over: Partial<TaskDto> & Pick<TaskDto, 'id' | 'key' | 'title'>): TaskDto => ({
  number: Number(over.key.split('-')[1] ?? 1),
  status: 'TODO',
  priority: 'MEDIUM',
  assigneeId: 'u1',
  assignee: { id: 'u1', name: 'Fawad Iqbal', initials: 'FI', avatarColor: 'blue' },
  projectId: null,
  project: null,
  sectionId: null,
  parentId: null,
  sprintId: null,
  startDate: null,
  dueDate: null,
  estimatePoints: null,
  estimateHours: null,
  progress: 0,
  epic: null,
  tags: [],
  commentCount: 0,
  subtaskCount: 0,
  subtaskDoneCount: 0,
  blockedBy: [],
  boardPosition: 0,
  listPosition: 0,
  backlogRank: null,
  completedAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  ...over,
});

/** Renders `ui` at `route` inside the same providers the app uses (minus realtime). */
export function renderApp(
  ui: ReactElement,
  { route = '/', path = '*' }: { route?: string; path?: string } = {},
): RenderResult & { client: QueryClient; router: MemoryRouter } {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  const detach = hotkeys.attach(window);
  useToastStore.getState().clear();
  const Shell = ({ children }: { children: ReactNode }) => (
    <CommandsProvider commands={[]}>
      {children}
      <ToastRegion />
    </CommandsProvider>
  );
  const router = createMemoryRouter([{ path, element: <Shell>{ui}</Shell> }], { initialEntries: [route] });
  const result = render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return {
    ...result,
    client,
    router,
    unmount: () => {
      result.unmount();
      detach();
    },
  };
}

/**
 * Pretend the viewport is a phone (390px wide): `(max-width: 767px)` and narrower-than-desktop
 * queries match, everything else (reduced motion, dark scheme) doesn't. Returns a restore function.
 */
export function mockPhoneViewport(): () => void {
  const original = window.matchMedia;
  window.matchMedia = (query: string) =>
    ({
      matches: /max-width:\s*(767|1023)px/.test(query),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
  return () => {
    window.matchMedia = original;
  };
}

/**
 * jsdom has no PointerEvent: alias it to MouseEvent (which carries clientX/clientY) plus a
 * pointerId, and give elements a width so swipe thresholds can be computed.
 */
export function installPointerEvents(width = 390): () => void {
  const w = window as unknown as { PointerEvent?: typeof MouseEvent };
  const hadPointer = 'PointerEvent' in window;
  if (!hadPointer) {
    class FakePointerEvent extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? 'touch';
      }
    }
    w.PointerEvent = FakePointerEvent;
  }
  const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width });
  return () => {
    if (!hadPointer) delete w.PointerEvent;
    if (desc) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', desc);
  };
}
