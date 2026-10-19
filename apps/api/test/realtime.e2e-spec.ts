import type { INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import type { RealtimeEventDto } from '@hearth/contracts';
import { asUser, createTestApp, type UserClient } from './utils';

/** Live updates reach the right people: staff hear everything, guests only their projects. */
describe('Realtime (e2e)', () => {
  let app: INestApplication;
  let url: string;
  let fawad: UserClient;
  let tom: UserClient;
  let mo: UserClient;
  const sockets: Socket[] = [];

  const connect = (token: string) =>
    new Promise<{ socket: Socket; events: RealtimeEventDto[] }>((resolve, reject) => {
      const socket = io(url, { auth: { token }, transports: ['websocket'], forceNew: true });
      const events: RealtimeEventDto[] = [];
      socket.on('domain-event', (e: RealtimeEventDto) => events.push(e));
      socket.on('connect', () => setTimeout(() => resolve({ socket, events }), 150));
      socket.on('connect_error', reject);
      sockets.push(socket);
    });

  const taskId = async (key: string) => (await fawad.get(`/tasks/key/${key}`).expect(200)).body.id as string;
  const settle = () => new Promise((r) => setTimeout(r, 400));

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0);
    url = await app.getUrl();
    fawad = await asUser(app);
    tom = await asUser(app, 'tom@northwind.co');
    mo = await asUser(app, 'mo@acme.com');
  });
  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await app.close();
  });

  it('delivers events to staff and only to guests on that project', async () => {
    const staff = await connect(fawad.token);
    const guest = await connect(tom.token);

    // HRT-151 is on Mobile app v2 — Tom must not hear about it.
    const mobileTask = await taskId('HRT-151');
    await mo
      .patch(`/tasks/${mobileTask}`, { title: 'Fix date picker focus trap in the task modal' })
      .expect(200);
    // HRT-204 is on Website relaunch — Tom is a guest there.
    const webTask = await taskId('HRT-204');
    await mo
      .patch(`/tasks/${webTask}`, { title: 'Write new homepage copy and value propositions' })
      .expect(200);
    await settle();

    const ids = (events: RealtimeEventDto[]) =>
      events.filter((e) => e.type === 'task.renamed').map((e) => e.aggregateId);
    expect(ids(staff.events)).toEqual(expect.arrayContaining([mobileTask, webTask]));
    expect(ids(guest.events)).toEqual([webTask]);
  });

  it('rejects sockets without a valid token', async () => {
    await expect(
      new Promise((resolve, reject) => {
        const s = io(url, {
          auth: { token: 'nope' },
          transports: ['websocket'],
          forceNew: true,
          reconnection: false,
        });
        sockets.push(s);
        s.on('disconnect', () => resolve('disconnected'));
        s.on('connect_error', () => resolve('refused'));
        setTimeout(() => reject(new Error('socket stayed connected')), 3000);
      }),
    ).resolves.toBeDefined();
  });
});
