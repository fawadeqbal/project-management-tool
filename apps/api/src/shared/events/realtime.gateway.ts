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
import type { Actor, DomainEvent } from '@hearth/domain';
import type { Server, Socket } from 'socket.io';
import { TokenService } from '../auth/token.service';
import { ActorResolver } from '../workspace-context/actor-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
import { toUserRef } from '../mappers/refs';
import { DomainEventEnvelope } from './domain-event.envelope';
import { DomainEventSubscriber } from './domain-event.subscriber';
import { audienceFor, canSeeProject, presenceAudience, roomsForActor } from './event-audience';

interface SocketState {
  actor: Actor;
  user: UserRefDto;
  viewing: { taskId: string; projectId: string | null } | null;
}

/**
 * Websocket adapter: authenticates the handshake (`auth.token`, optional `auth.workspaceId`
 * or query `workspaceId`), joins the rooms the actor may hear (see event-audience.ts), and tracks
 * presence ("who is viewing this task") for people allowed to see that task.
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
      this.sockets.set(socket.id, { actor, user: toUserRef(user), viewing: null });
      await socket.join(roomsForActor(actor));
    } catch (e) {
      this.logger.debug(`Rejected socket: ${e instanceof Error ? e.message : String(e)}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    const state = this.sockets.get(socket.id);
    this.sockets.delete(socket.id);
    if (state?.viewing) this.emitPresence(state.actor.workspaceId, state.viewing);
  }

  /** Client sends `{ taskId }` when opening a task and `{ taskId: null }` when closing it. */
  @SubscribeMessage(WS_PRESENCE)
  async onPresence(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { taskId?: string | null },
  ): Promise<void> {
    const state = this.sockets.get(socket.id);
    if (!state) return;
    const previous = state.viewing;
    state.viewing = body?.taskId ? await this.visibleTask(state.actor, body.taskId) : null;
    if (previous && previous.taskId !== state.viewing?.taskId)
      this.emitPresence(state.actor.workspaceId, previous);
    if (state.viewing) this.emitPresence(state.actor.workspaceId, state.viewing);
  }

  broadcast(event: DomainEvent): void {
    const audience = audienceFor(event);
    if (!this.server || audience.length === 0) return;
    const dto: RealtimeEventDto = {
      type: event.type,
      aggregateId: event.aggregateId,
      actorId: event.actorId,
      workspaceId: event.workspaceId,
      occurredAt: event.occurredAt.toISOString(),
      payload: event.payload as Record<string, unknown>,
    };
    this.server.to(audience).emit(WS_EVENT, dto);
  }

  /** The task, if it exists in the actor's workspace and the actor may see its project. */
  private async visibleTask(actor: Actor, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId: actor.workspaceId },
      select: { id: true, projectId: true },
    });
    return task && canSeeProject(actor, task.projectId)
      ? { taskId: task.id, projectId: task.projectId }
      : null;
  }

  private emitPresence(workspaceId: string, viewing: { taskId: string; projectId: string | null }): void {
    const viewers = new Map<string, UserRefDto>();
    for (const s of this.sockets.values())
      if (s.actor.workspaceId === workspaceId && s.viewing?.taskId === viewing.taskId)
        viewers.set(s.actor.userId, s.user);
    this.server
      ?.to(presenceAudience(workspaceId, viewing.projectId))
      .emit(WS_PRESENCE, { taskId: viewing.taskId, viewers: [...viewers.values()] });
  }
}

/** Pushes every domain event to the sockets allowed to hear it; clients turn them into cache refreshes. */
@EventsHandler(DomainEventEnvelope)
export class RealtimeBroadcaster extends DomainEventSubscriber {
  protected readonly types = ['*'] as const;

  constructor(private readonly gateway: RealtimeGateway) {
    super();
  }

  protected on(event: DomainEvent): void {
    this.gateway.broadcast(event);
  }
}
