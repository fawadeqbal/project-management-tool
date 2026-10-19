import { Logger } from '@nestjs/common';
import { EventsHandler } from '@nestjs/cqrs';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { WS_EVENT, WS_PRESENCE, type RealtimeEventDto, type UserRefDto } from '@hearth/contracts';
import type { DomainEvent } from '@hearth/domain';
import type { Server, Socket } from 'socket.io';
import { TokenService } from '../auth/token.service';
import { ActorResolver } from '../workspace-context/actor-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
import { toUserRef } from '../mappers/refs';
import { DomainEventEnvelope } from './domain-event.envelope';
import { DomainEventSubscriber } from './domain-event.subscriber';

interface SocketState {
  userId: string;
  workspaceId: string;
  user: UserRefDto;
  viewingTaskId: string | null;
}

const room = (workspaceId: string) => `ws:${workspaceId}`;

/**
 * Websocket adapter: authenticates the handshake (`auth.token`, optional `auth.workspaceId`
 * or query `workspaceId`), joins the workspace room, and tracks presence ("who is viewing
 * this task") so the task panel can show live avatars.
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly sockets = new Map<string, SocketState>();

  constructor(
    private readonly tokens: TokenService,
    private readonly actors: ActorResolver,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const auth = (socket.handshake.auth ?? {}) as { token?: string; workspaceId?: string };
      const query = socket.handshake.query as { workspaceId?: string };
      const { sub } = await this.tokens.verify(auth.token);
      const actor = await this.actors.resolve(sub, auth.workspaceId ?? query.workspaceId ?? null);
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: sub } });
      this.sockets.set(socket.id, {
        userId: sub,
        workspaceId: actor.workspaceId,
        user: toUserRef(user),
        viewingTaskId: null,
      });
      await socket.join(room(actor.workspaceId));
    } catch (e) {
      this.logger.debug(`Rejected socket: ${e instanceof Error ? e.message : String(e)}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    const state = this.sockets.get(socket.id);
    this.sockets.delete(socket.id);
    if (state?.viewingTaskId) this.emitPresence(state.workspaceId, state.viewingTaskId);
  }

  /** Client sends `{ taskId }` when opening a task and `{ taskId: null }` when closing it. */
  @SubscribeMessage(WS_PRESENCE)
  onPresence(@ConnectedSocket() socket: Socket, @MessageBody() body: { taskId?: string | null }): void {
    const state = this.sockets.get(socket.id);
    if (!state) return;
    const previous = state.viewingTaskId;
    state.viewingTaskId = body?.taskId ?? null;
    if (previous && previous !== state.viewingTaskId) this.emitPresence(state.workspaceId, previous);
    if (state.viewingTaskId) this.emitPresence(state.workspaceId, state.viewingTaskId);
  }

  broadcast(event: DomainEvent): void {
    const dto: RealtimeEventDto = {
      type: event.type,
      aggregateId: event.aggregateId,
      actorId: event.actorId,
      workspaceId: event.workspaceId,
      occurredAt: event.occurredAt.toISOString(),
      payload: event.payload as Record<string, unknown>,
    };
    this.server?.to(room(event.workspaceId)).emit(WS_EVENT, dto);
  }

  private emitPresence(workspaceId: string, taskId: string): void {
    const viewers = new Map<string, UserRefDto>();
    for (const s of this.sockets.values())
      if (s.workspaceId === workspaceId && s.viewingTaskId === taskId) viewers.set(s.userId, s.user);
    this.server?.to(room(workspaceId)).emit(WS_PRESENCE, { taskId, viewers: [...viewers.values()] });
  }
}

/** Pushes every domain event to the workspace's sockets; clients turn them into cache refreshes. */
@EventsHandler(DomainEventEnvelope)
export class RealtimeBroadcaster extends DomainEventSubscriber {
  protected readonly types = [''] as const; // '' is a prefix of every type

  constructor(private readonly gateway: RealtimeGateway) {
    super();
  }

  protected on(event: DomainEvent): void {
    this.gateway.broadcast(event);
  }
}
