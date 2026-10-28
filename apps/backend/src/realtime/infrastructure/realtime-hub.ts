import { type GroupEvent, type RealtimeMessage } from '@ardoise/shared';
import {
  Inject,
  Injectable,
  Logger,
  type MessageEvent,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  concat,
  defer,
  filter,
  from,
  interval,
  map,
  merge,
  type Observable,
  of,
  Subject,
  takeUntil,
  timer,
} from 'rxjs';
import {
  MEMBER_REPOSITORY,
  type MemberRepository,
} from 'src/member/domain/member-repository';
import { toPaymentResponse } from 'src/payment/infrastructure/payment.mapper';
import { formatEventId } from 'src/realtime/domain/event-id';
import { type GroupChange } from 'src/realtime/domain/group-change';
import { type RealtimePublisher } from 'src/realtime/domain/realtime-publisher';
import { replayAfter } from 'src/realtime/domain/replay';
import { toSettlementResponse } from 'src/settlement/infrastructure/settlement.mapper';

const BUFFER_SIZE = 1000;
const PING_INTERVAL_MS = 25_000;

type Entry = {
  readonly seq: number;
  readonly recipients: ReadonlySet<number>;
  readonly message: GroupEvent;
};

export type StreamViewer = {
  userId: number;
  sessionId: number;
  sessionExpiresAt: Date;
};

const toGroupEvent = (change: GroupChange): GroupEvent => {
  const opId = change.opId ?? null;
  switch (change.type) {
    case 'payment.saved':
      return {
        type: change.type,
        groupId: change.payment.groupId,
        opId,
        payment: toPaymentResponse(change.payment),
      };
    case 'settlement.saved':
      return {
        type: change.type,
        groupId: change.settlement.groupId,
        opId,
        settlement: toSettlementResponse(change.settlement),
      };
    case 'payment.deleted':
    case 'settlement.deleted':
      return {
        type: change.type,
        groupId: change.groupId,
        opId,
        id: change.id,
      };
    case 'member.joined':
      return {
        type: change.type,
        groupId: change.groupId,
        userId: change.userId,
      };
    case 'group.created':
      return { type: change.type, groupId: change.groupId };
  }
};

const sseEvent = (data: RealtimeMessage, id?: string): MessageEvent =>
  id === undefined ? { data } : { id, data };

@Injectable()
export class RealtimeHub implements RealtimePublisher, OnApplicationShutdown {
  private readonly logger = new Logger(RealtimeHub.name);
  private boot = randomBytes(6).toString('hex');
  private current = 0;
  private buffer: Entry[] = [];
  private queue: Promise<void> = Promise.resolve();
  private readonly published = new Subject<Entry>();
  private readonly resets = new Subject<void>();
  private readonly endedSessions = new Subject<number>();
  private readonly shutdown = new Subject<void>();

  constructor(
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepository,
  ) {}

  groupChanged(change: GroupChange): Promise<void> {
    const next = this.queue
      .then(() => this.publish(change))
      .catch((error: unknown) => {
        this.logger.error(`could not publish ${change.type}`, error);
        this.resetEveryone();
      });
    this.queue = next;
    return next;
  }

  sessionEnded(sessionId: number): void {
    this.endedSessions.next(sessionId);
  }

  stream(
    viewer: StreamViewer,
    lastEventId: string | undefined,
  ): Observable<MessageEvent> {
    const sees = (entry: Entry) => entry.recipients.has(viewer.userId);
    const toEvent = (entry: Entry) =>
      sseEvent(entry.message, formatEventId(this.boot, entry.seq));

    return defer(() => {
      const replay = replayAfter(
        this.buffer,
        this.current,
        this.boot,
        lastEventId,
      );
      const currentId = this.currentId();
      const catchUp =
        replay === 'reset'
          ? [sseEvent({ type: 'reset' }, currentId)]
          : replay.filter(sees).map(toEvent);

      return merge(
        this.resets.pipe(
          map(() => sseEvent({ type: 'reset' }, this.currentId())),
        ),
        concat(
          from(catchUp),
          of(sseEvent({ type: 'ready' }, currentId)),
          merge(
            this.published.pipe(filter(sees), map(toEvent)),
            interval(PING_INTERVAL_MS).pipe(
              map(() => sseEvent({ type: 'ping' })),
            ),
          ),
        ),
      );
    }).pipe(
      takeUntil(
        merge(
          this.endedSessions.pipe(filter((id) => id === viewer.sessionId)),
          timer(viewer.sessionExpiresAt),
          this.shutdown,
        ),
      ),
    );
  }

  onApplicationShutdown(): void {
    this.shutdown.next();
  }

  private currentId(): string {
    return formatEventId(this.boot, this.current);
  }

  private resetEveryone(): void {
    this.boot = randomBytes(6).toString('hex');
    this.buffer = [];
    this.resets.next();
  }

  private async publish(change: GroupChange): Promise<void> {
    const message = toGroupEvent(change);
    const recipients =
      change.type === 'group.created'
        ? [change.userId]
        : (await this.members.findByGroupId(message.groupId)).map(
            (member) => member.userId,
          );
    const entry: Entry = {
      seq: ++this.current,
      recipients: new Set(recipients),
      message,
    };
    this.buffer.push(entry);
    if (this.buffer.length > BUFFER_SIZE) this.buffer.shift();
    this.published.next(entry);
  }
}
