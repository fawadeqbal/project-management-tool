import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiSuggestionDto, TaskDetailDto } from '@hearth/contracts';
import { queryKeys } from '@/shared/api/query-keys';
import { makeTask, renderApp, signIn } from '@/test/render';
import { AiSummarySlot } from './AiSummarySlot';
import { BreakdownSlot } from './BreakdownSlot';
import type * as HttpModule from '@/shared/api/http';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/shared/api/http', async (importOriginal) => {
  const actual = await importOriginal<typeof HttpModule>();
  return { ...actual, http: { ...actual.http, get: http.get, post: http.post } };
});

const task: TaskDetailDto = {
  ...makeTask({ id: 't188', key: 'HRT-188', title: 'Design pricing page in light and dark mode' }),
  description: 'Plan cards and a comparison table.',
  creator: { id: 'u1', name: 'Fawad Iqbal', initials: 'FI', avatarColor: 'blue' },
  subtasks: [],
  comments: [],
  activity: [],
  blocking: [],
  followerIds: [],
  sprint: null,
};

/** A tiny stateful AI server: pending suggestions change with generate/accept/discard. */
const serve = (initial: AiSuggestionDto[], created: AiSuggestionDto, acceptResult: unknown) => {
  let pending = [...initial];
  http.get.mockImplementation(async () => pending);
  http.post.mockImplementation(async (path: string) => {
    const m = path.match(/^\/ai\/suggestions\/([^/]+)\/(accept|discard)$/);
    if (m) {
      const s = pending.find((x) => x.id === m[1])!;
      pending = pending.filter((x) => x.id !== m[1]);
      return m[2] === 'accept' ? acceptResult : { ...s, status: 'DISCARDED' };
    }
    pending = [created, ...pending.filter((x) => x.kind !== created.kind)];
    return created;
  });
};

const summary: AiSuggestionDto = {
  id: 's1',
  taskId: 't188',
  kind: 'summary',
  status: 'PENDING',
  source: 'generated from 12 comments',
  summary: {
    text: 'Light mode is approved. Blocked until Marketing confirms final plan names (HRT-182).',
    suggestedNextStep: null,
  },
  breakdown: null,
  createdAt: '2026-10-19T09:00:00.000Z',
};

describe('AiSummarySlot', () => {
  beforeEach(() => signIn());
  afterEach(() => vi.clearAllMocks());

  it('shows a labelled summary with its source; Add to description writes only on click', async () => {
    serve([summary], summary, {
      suggestion: { ...summary, status: 'ACCEPTED' },
      description: `${task.description}\n\nSummary: ${summary.summary!.text}`,
    });
    const { client, unmount } = renderApp(<AiSummarySlot task={task} />);
    client.setQueryData(queryKeys.task('t188'), task);
    expect(await screen.findByRole('region', { name: 'AI summary' })).toBeInTheDocument();
    expect(screen.getByText('· generated from 12 comments')).toBeInTheDocument();
    expect(http.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Add to description' }));
    // Optimistic: the card leaves and the description gains the summary right away.
    await waitFor(() => expect(screen.queryByRole('region', { name: 'AI summary' })).not.toBeInTheDocument());
    expect((client.getQueryData(queryKeys.task('t188')) as TaskDetailDto).description).toContain(
      'Summary: Light mode is approved.',
    );
    expect(http.post).toHaveBeenCalledWith('/ai/suggestions/s1/accept', {});
    expect(await screen.findByText('Summary added to the description')).toBeInTheDocument();
    unmount();
  });

  it('Edit lets me change the text before accepting', async () => {
    serve([summary], summary, { suggestion: { ...summary, status: 'ACCEPTED' }, description: 'x' });
    const { unmount } = renderApp(<AiSummarySlot task={task} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit the summary' }), {
      target: { value: 'Light mode approved; ship it.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to description' }));
    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith('/ai/suggestions/s1/accept', {
        edited: { text: 'Light mode approved; ship it.' },
      }),
    );
    unmount();
  });

  it('Discard drops the suggestion; then I can summarize again', async () => {
    serve([summary], { ...summary, id: 's2' }, null);
    const { unmount } = renderApp(<AiSummarySlot task={task} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(http.post).toHaveBeenCalledWith('/ai/suggestions/s1/discard'));
    fireEvent.click(await screen.findByRole('button', { name: 'Summarize with AI' }));
    await waitFor(() => expect(http.post).toHaveBeenCalledWith('/tasks/t188/ai/summary'));
    expect(await screen.findByRole('region', { name: 'AI summary' })).toBeInTheDocument();
    unmount();
  });
});

describe('BreakdownSlot', () => {
  beforeEach(() => signIn());
  afterEach(() => vi.clearAllMocks());

  it('proposes subtasks with checkboxes and adds only the chosen ones', async () => {
    const breakdown: AiSuggestionDto = {
      ...summary,
      id: 'b1',
      kind: 'breakdown',
      summary: null,
      source: 'generated from the title (design task)',
      breakdown: { subtasks: ['Sketch layouts', 'Create comps', 'Review with stakeholders'] },
    };
    serve([], breakdown, {
      suggestion: { ...breakdown, status: 'ACCEPTED' },
      createdSubtasks: [
        { id: 'n1', key: 'HRT-330', title: 'Sketch layouts' },
        { id: 'n2', key: 'HRT-331', title: 'Review with stakeholders' },
      ],
    });
    const { unmount } = renderApp(<BreakdownSlot task={task} onAddSubtask={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Break down' }));
    expect(await screen.findByRole('region', { name: 'Suggested subtasks' })).toBeInTheDocument();
    expect(screen.getByText('· generated from the title (design task)')).toBeInTheDocument();
    const comps = screen.getByRole('checkbox', { name: 'Include “Create comps”' });
    expect(comps).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(comps);
    expect(comps).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 subtasks' }));
    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith('/ai/suggestions/b1/accept', {
        edited: { subtasks: ['Sketch layouts', 'Review with stakeholders'] },
      }),
    );
    expect(await screen.findByText('Added 2 subtasks')).toBeInTheDocument();
    unmount();
  });
});
