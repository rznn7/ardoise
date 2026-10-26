import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import {
  computePaymentShares,
  type GroupMember,
  InvalidSplit,
  type PaymentResponse,
  type PaymentShareResponse,
  PERCENT_TOTAL,
  type SplitParticipant,
  type SplitType,
  type UpdatePaymentBody,
} from '@ardoise/shared';

import {
  defaultTitle,
  formatAmountInput,
  formatPercentInput,
  parseAmount,
  parsePercent,
  parseShareAmount,
} from './money-input';

export const NOW = new InjectionToken<() => Date>('NOW', {
  providedIn: 'root',
  factory: () => () => new Date(),
});

export interface RunningTotal {
  readonly entered: number;
  readonly target: number;
}

const pad = (value: number): string => String(value).padStart(2, '0');

const toDateText = (date: Date): string =>
  `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const noonOf = (dateText: string): Date => {
  const [year = 0, month = 1, day = 1] = dateText.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};

const allWeightsOne = (members: readonly GroupMember[]): ReadonlyMap<number, number> =>
  new Map(members.map((m) => [m.id, 1]));

const textsOf = (
  shares: readonly PaymentShareResponse[],
  format: (value: number) => string,
): ReadonlyMap<number, string> => new Map(shares.map((s) => [s.memberId, format(s.inputValue)]));

@Injectable({ providedIn: 'root' })
export class PaymentDraft {
  private readonly now = inject(NOW);
  private readonly started = signal(false);
  private storedPaidAt: string | null = null;
  private storedDate: string | null = null;

  readonly mode = signal<'new' | 'edit'>('new');
  readonly groupId = signal(0);
  readonly paymentId = signal<number | null>(null);
  readonly members = signal<readonly GroupMember[]>([]);
  readonly amountText = signal('');
  readonly title = signal('');
  readonly payerMemberId = signal<number | null>(null);
  readonly date = signal('');
  private readonly splitTypeState = signal<SplitType>('equal');
  readonly splitType = this.splitTypeState.asReadonly();
  readonly included = signal<ReadonlySet<number>>(new Set());
  readonly weights = signal<ReadonlyMap<number, number>>(new Map());
  readonly percentTexts = signal<ReadonlyMap<number, string>>(new Map());
  readonly exactTexts = signal<ReadonlyMap<number, string>>(new Map());

  readonly active = computed(() => this.started());
  readonly amountCents = computed(() => parseAmount(this.amountText()));

  private readonly participants = computed((): readonly SplitParticipant[] | null => {
    const type = this.splitType();
    const entries: SplitParticipant[] = [];
    for (const { id } of this.members()) {
      if (!this.included().has(id)) continue;
      const inputValue = this.inputValueOf(type, id);
      if (inputValue === null) return null;
      entries.push({ memberId: id, inputValue });
    }
    return entries;
  });

  readonly preview = computed((): ReadonlyMap<number, number> => {
    const fullAmount = this.amountCents();
    const payerMemberId = this.payerMemberId();
    const participants = this.participants();
    if (fullAmount === null || payerMemberId === null || participants === null) {
      return new Map();
    }
    try {
      const shares = computePaymentShares({
        fullAmount,
        splitType: this.splitType(),
        payerMemberId,
        participants,
      });
      return new Map(shares.map((s) => [s.memberId, s.amount]));
    } catch (error) {
      if (error instanceof InvalidSplit) return new Map();
      throw error;
    }
  });

  readonly runningTotal = computed((): RunningTotal | null => {
    const type = this.splitType();
    if (type !== 'percent' && type !== 'exact') return null;
    const participants = this.participants() ?? [];
    const entered = participants.reduce((sum, p) => sum + p.inputValue, 0);
    return {
      entered,
      target: type === 'percent' ? PERCENT_TOTAL : (this.amountCents() ?? 0),
    };
  });

  readonly valid = computed(() => this.preview().size > 0);

  toRequest(): UpdatePaymentBody {
    const type = this.splitType();
    const date = this.date();
    return {
      payerMemberId: this.payerMemberId() ?? 0,
      title: this.title().trim() || defaultTitle(this.dateOrNow(date)),
      paidAt: this.paidAtOf(date),
      fullAmount: this.amountCents() ?? 0,
      splitType: type,
      participants: (this.participants() ?? []).map((p) => ({
        memberId: p.memberId,
        inputValue: type === 'equal' ? 0 : p.inputValue,
      })),
    };
  }

  startNew(groupId: number, members: readonly GroupMember[], me: number): void {
    this.reset();
    this.mode.set('new');
    this.groupId.set(groupId);
    this.members.set(members);
    this.payerMemberId.set(me);
    this.included.set(new Set(members.map((m) => m.id)));
    this.weights.set(allWeightsOne(members));
    this.date.set(toDateText(this.now()));
    this.started.set(true);
  }

  startEdit(
    payment: PaymentResponse,
    shares: readonly PaymentShareResponse[],
    members: readonly GroupMember[],
  ): void {
    this.reset();
    this.mode.set('edit');
    this.groupId.set(payment.groupId);
    this.paymentId.set(payment.id);
    this.members.set(members);
    this.amountText.set(formatAmountInput(payment.fullAmount));
    this.title.set(payment.title);
    this.payerMemberId.set(payment.payerMemberId);
    this.splitTypeState.set(payment.splitType);
    this.included.set(new Set(shares.map((s) => s.memberId)));
    this.weights.set(
      new Map([
        ...allWeightsOne(members),
        ...(payment.splitType === 'shares'
          ? shares.map((s): [number, number] => [s.memberId, s.inputValue])
          : []),
      ]),
    );
    if (payment.splitType === 'percent') {
      this.percentTexts.set(textsOf(shares, formatPercentInput));
    }
    if (payment.splitType === 'exact') {
      this.exactTexts.set(textsOf(shares, formatAmountInput));
    }
    this.storedPaidAt = payment.paidAt;
    this.storedDate = toDateText(new Date(payment.paidAt));
    this.date.set(this.storedDate);
    this.started.set(true);
  }

  setSplitType(type: SplitType): void {
    this.splitTypeState.set(type);
    if (type === 'shares') this.weights.set(allWeightsOne(this.members()));
    if (type === 'percent') this.percentTexts.set(new Map());
    if (type === 'exact') this.exactTexts.set(new Map());
  }

  clear(): void {
    this.reset();
    this.started.set(false);
  }

  private reset(): void {
    this.mode.set('new');
    this.groupId.set(0);
    this.paymentId.set(null);
    this.members.set([]);
    this.amountText.set('');
    this.title.set('');
    this.payerMemberId.set(null);
    this.date.set('');
    this.splitTypeState.set('equal');
    this.included.set(new Set());
    this.weights.set(new Map());
    this.percentTexts.set(new Map());
    this.exactTexts.set(new Map());
    this.storedPaidAt = null;
    this.storedDate = null;
  }

  private inputValueOf(type: SplitType, memberId: number): number | null {
    switch (type) {
      case 'equal':
        return 0;
      case 'shares':
        return this.weights().get(memberId) ?? 1;
      case 'percent':
        return parsePercent(this.percentTexts().get(memberId) ?? '');
      case 'exact':
        return parseShareAmount(this.exactTexts().get(memberId) ?? '');
    }
  }

  private dateOrNow(dateText: string): Date {
    return dateText === '' ? this.now() : noonOf(dateText);
  }

  private paidAtOf(dateText: string): string {
    if (this.storedPaidAt !== null && dateText === this.storedDate) {
      return this.storedPaidAt;
    }
    if (dateText === toDateText(this.now())) return this.now().toISOString();
    return noonOf(dateText).toISOString();
  }
}
