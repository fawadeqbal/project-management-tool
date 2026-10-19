import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CommentDto, CreateTaskInput, TaskDetailDto, TaskDto, TaskRefDto } from '@hearth/contracts';
import { api } from '@/shared/api/client';
import { queryKeys } from '@/shared/api/query-keys';
import { useAuthStore } from '@/shared/auth/auth-store';
import { useOptimisticMutation } from '@/shared/hooks/useOptimisticMutation';
import { patchTaskDetail, patchTaskInCaches } from '@/shared/tasks/task-cache';
import { TASK_SAVE_KEY } from '@/shared/tasks/useTaskMutations';

const detailKeys = () => [queryKeys.taskRoot];

let seq = 0;
const tempId = (prefix: string) => `optimistic-${prefix}-${Date.now()}-${++seq}`;

/** Writes that only the task detail needs: comments, dependencies, followers, subtasks. */
export function useTaskDetailMutations(task: TaskDetailDto | undefined) {
  const client = useQueryClient();
  const me = useAuthStore((s) => s.me);

  const addComment = useOptimisticMutation<CommentDto, { taskId: string; body: string; temp: string }>({
    mutationFn: ({ taskId, body }) => api.tasks.addComment(taskId, { body }),
    affects: detailKeys,
    apply: (c, { taskId, body, temp }) => {
      if (!me) return;
      const draft: CommentDto = {
        id: temp,
        taskId,
        author: { id: me.user.id, name: me.user.name, initials: me.user.initials, avatarColor: me.user.avatarColor },
        body,
        parentId: null,
        mentions: [],
        createdAt: new Date().toISOString(),
        editedAt: null,
      };
      patchTaskDetail(c, taskId, (d) => ({ ...d, comments: [...d.comments, draft], commentCount: d.commentCount + 1 }));
    },
    onSuccess: (comment, { taskId, temp }) =>
      patchTaskDetail(client, taskId, (d) => ({ ...d, comments: d.comments.map((x) => (x.id === temp ? comment : x)) })),
    errorMessage: () => 'We couldn’t post your comment. It’s back in the box — try sending again.',
  });

  const addDependency = useOptimisticMutation<unknown, { taskId: string; blocker: TaskRefDto }>({
    mutationKey: TASK_SAVE_KEY,
    mutationFn: ({ taskId, blocker }) => api.tasks.addDependency(taskId, blocker.id),
    affects: () => [queryKeys.taskRoot, queryKeys.tasks.all],
    apply: (c, { taskId, blocker }) =>
      patchTaskInCaches(c, taskId, (t) => ({ ...t, blockedBy: [...t.blockedBy.filter((b) => b.id !== blocker.id), blocker] })),
  });

  const removeDependency = useOptimisticMutation<unknown, { taskId: string; blockerId: string }>({
    mutationKey: TASK_SAVE_KEY,
    mutationFn: ({ taskId, blockerId }) => api.tasks.removeDependency(taskId, blockerId),
    affects: () => [queryKeys.taskRoot, queryKeys.tasks.all],
    apply: (c, { taskId, blockerId }) => patchTaskInCaches(c, taskId, (t) => ({ ...t, blockedBy: t.blockedBy.filter((b) => b.id !== blockerId) })),
  });

  const setFollowing = useOptimisticMutation<unknown, { taskId: string; follow: boolean }>({
    mutationFn: ({ taskId, follow }) => (follow ? api.tasks.follow(taskId) : api.tasks.unfollow(taskId)),
    affects: detailKeys,
    apply: (c, { taskId, follow }) => {
      if (!me) return;
      patchTaskDetail(c, taskId, (d) => ({
        ...d,
        followerIds: follow ? [...new Set([...d.followerIds, me.user.id])] : d.followerIds.filter((id) => id !== me.user.id),
      }));
    },
  });

  const addSubtask = useOptimisticMutation<TaskDto, { parent: TaskDetailDto; input: CreateTaskInput; temp: string }>({
    mutationKey: TASK_SAVE_KEY,
    mutationFn: ({ input }) => api.tasks.create(input),
    affects: () => [queryKeys.taskRoot, queryKeys.tasks.all],
    apply: (c, { parent, input, temp }) => {
      const now = new Date().toISOString();
      const draft: TaskDto = {
        ...parent,
        id: temp,
        key: `${parent.key.split('-')[0]}-…`,
        title: input.title,
        status: 'TODO',
        parentId: parent.id,
        tags: [],
        blockedBy: [],
        commentCount: 0,
        subtaskCount: 0,
        subtaskDoneCount: 0,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      patchTaskDetail(c, parent.id, (d) => ({ ...d, subtasks: [...d.subtasks, draft], subtaskCount: d.subtaskCount + 1 }));
    },
    onSuccess: (created, { parent, temp }) =>
      patchTaskDetail(client, parent.id, (d) => ({ ...d, subtasks: d.subtasks.map((s) => (s.id === temp ? created : s)) })),
  });

  return useMemo(() => {
    const isFollowing = !!task && !!me && task.followerIds.includes(me.user.id);
    return {
      isFollowing,
      addComment: (body: string) => (task ? addComment.mutateAsync({ taskId: task.id, body, temp: tempId('c') }).then(() => true, () => false) : Promise.resolve(false)),
      addBlocker: (blocker: TaskRefDto) => task && void addDependency.mutateAsync({ taskId: task.id, blocker }).catch(() => undefined),
      removeBlocker: (blockerId: string) => task && void removeDependency.mutateAsync({ taskId: task.id, blockerId }).catch(() => undefined),
      toggleFollow: () => task && void setFollowing.mutateAsync({ taskId: task.id, follow: !isFollowing }).catch(() => undefined),
      addSubtask: (title: string) =>
        task &&
        void addSubtask
          .mutateAsync({
            parent: task,
            temp: tempId('s'),
            input: { title, parentId: task.id, projectId: task.projectId, sectionId: task.sectionId, assigneeId: task.assigneeId },
          })
          .catch(() => undefined),
    };
  }, [task, me, addComment, addDependency, removeDependency, setFollowing, addSubtask]);
}
