import { type Cursor } from 'src/shared/pagination/cursor';

import { type Settlement } from './settlement';

export const SETTLEMENT_REPOSITORY = Symbol('SETTLEMENT_REPOSITORY');

export interface SettlementRepository {
  findById(id: number): Promise<Settlement | null>;
  findPageByGroup(
    groupId: number,
    after: Cursor | null,
    size: number,
  ): Promise<Settlement[]>;
  create(input: Omit<Settlement, 'id' | 'createdAt'>): Promise<Settlement>;
  delete(id: number): Promise<void>;
}
