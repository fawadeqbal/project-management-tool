import { describe, expect, it } from 'vitest';
import { makeTask } from '@/test/render';
import { buildColumns, keyboardPlacement, moveToStatus, placeAt, wipLabel } from './board-model';

const t = (id: string, status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE', pos: number) =>
  makeTask({ id, key: `HRT-${id}`, title: id, status, boardPosition: pos });

const tasks = [
  t('a', 'TODO', 1024),
  t('b', 'TODO', 2048),
  t('c', 'IN_PROGRESS', 1024),
  t('d', 'IN_PROGRESS', 2048),
  t('e', 'IN_PROGRESS', 3072),
  t('f', 'DONE', 10),
];

describe('board model', () => {
  it('builds columns in status order, sorted by boardPosition, hiding an empty Blocked', () => {
    const cols = buildColumns([...tasks].reverse(), { IN_PROGRESS: 4 });
    expect(cols.map((c) => c.status)).toEqual(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']);
    expect(cols[1]!.tasks.map((x) => x.id)).toEqual(['c', 'd', 'e']);
    expect(cols[1]).toMatchObject({ count: 3, wipLimit: 4, wipLevel: 'near' });
  });

  it('labels WIP states', () => {
    expect(wipLabel({ count: 3, wipLimit: null, wipLevel: 'ok' })).toEqual({
      text: '3',
      warn: false,
      description: undefined,
    });
    expect(wipLabel({ count: 2, wipLimit: 4, wipLevel: 'ok' })).toMatchObject({
      text: '2 / 4 WIP',
      warn: false,
    });
    expect(wipLabel({ count: 3, wipLimit: 4, wipLevel: 'near' })).toMatchObject({
      text: '3 / 4 WIP',
      warn: true,
    });
    expect(wipLabel({ count: 5, wipLimit: 4, wipLevel: 'over' })).toMatchObject({
      warn: true,
      description: 'Over the work-in-progress limit',
    });
  });

  it('computes neighbours and a midpoint position', () => {
    const cols = buildColumns(tasks);
    expect(placeAt(cols[1]!.tasks, 1, 'IN_PROGRESS', 'a')).toEqual({
      status: 'IN_PROGRESS',
      beforeId: 'c',
      afterId: 'd',
      position: 1536,
    });
    expect(placeAt(cols[1]!.tasks, 0, 'IN_PROGRESS', 'a')).toMatchObject({
      beforeId: null,
      afterId: 'c',
      position: 0,
    });
  });

  it('moves with the keyboard between and within columns', () => {
    const cols = buildColumns(tasks);
    const b = tasks[1]!;
    expect(keyboardPlacement(cols, b, 'right')).toMatchObject({
      status: 'IN_PROGRESS',
      beforeId: 'e',
      afterId: null,
    });
    expect(keyboardPlacement(cols, b, 'left')).toBeNull();
    expect(keyboardPlacement(cols, b, 'up')).toMatchObject({ status: 'TODO', beforeId: null, afterId: 'a' });
    expect(keyboardPlacement(cols, tasks[0]!, 'up')).toBeNull();
    expect(moveToStatus(cols, b, 'DONE')).toMatchObject({ status: 'DONE', beforeId: 'f', afterId: null });
  });
});
