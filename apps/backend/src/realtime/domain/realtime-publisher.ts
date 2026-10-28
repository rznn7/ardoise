import { type GroupChange } from './group-change';

export const REALTIME_PUBLISHER = Symbol('REALTIME_PUBLISHER');

export interface RealtimePublisher {
  groupChanged(change: GroupChange): Promise<void>;
  sessionEnded(sessionId: number): void;
}
