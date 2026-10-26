import { TestBed } from '@angular/core/testing';
import { type GroupMember, type PaymentResponse, type PaymentShareResponse } from '@ardoise/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { NOW, PaymentDraft } from './payment-draft';

const member = (id: number): GroupMember => ({
  id,
  userId: id,
  nickname: `m${String(id)}`,
  isModerator: false,
  name: `Member ${String(id)}`,
});

const members = [member(1), member(2), member(3), member(4)];
const clock = new Date(2026, 9, 26, 15, 30);

describe('PaymentDraft', () => {
  let draft: PaymentDraft;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: NOW, useValue: () => clock }],
    });
    draft = TestBed.inject(PaymentDraft);
    draft.startNew(7, members, 3);
  });

  it('is inactive before start and after clear', () => {
    const fresh = TestBed.runInInjectionContext(() => new PaymentDraft());
    expect(fresh.active()).toBe(false);
    expect(draft.active()).toBe(true);
    draft.clear();
    expect(draft.active()).toBe(false);
  });

  it('forgets the group on clear and on a new start', () => {
    const group = { id: 7, name: 'Lisbon trip', currencyCode: 'EUR', createdAt: '' };
    draft.group.set(group);
    draft.clear();
    expect(draft.group()).toBeNull();
    draft.group.set(group);
    draft.startNew(8, members, 3);
    expect(draft.group()).toBeNull();
  });

  it('starts new with equal split, everyone included, me as payer', () => {
    expect(draft.mode()).toBe('new');
    expect(draft.groupId()).toBe(7);
    expect(draft.paymentId()).toBeNull();
    expect(draft.splitType()).toBe('equal');
    expect(draft.payerMemberId()).toBe(3);
    expect([...draft.included()]).toEqual([1, 2, 3, 4]);
    expect([...draft.weights().values()]).toEqual([1, 1, 1, 1]);
    expect(draft.date()).toBe('2026-10-26');
  });

  it('previews 2450 equally with the extra cents on the payer side', () => {
    draft.startNew(7, members, 1);
    draft.amountText.set('24,50');
    const preview = draft.preview();
    expect([...preview.values()].reduce((a, b) => a + b, 0)).toBe(2450);
    expect([...preview.values()]).toEqual([613, 613, 612, 612]);
    expect(draft.valid()).toBe(true);
  });

  it('is invalid without an amount', () => {
    expect(draft.valid()).toBe(false);
    expect(draft.preview().size).toBe(0);
  });

  it('is invalid when everyone is unticked', () => {
    draft.amountText.set('10');
    draft.included.set(new Set());
    expect(draft.valid()).toBe(false);
  });

  it('is invalid when all share weights are 0', () => {
    draft.amountText.set('10');
    draft.setSplitType('shares');
    draft.weights.set(new Map(members.map((m) => [m.id, 0])));
    expect(draft.valid()).toBe(false);
  });

  it('is invalid when percents sum to 9999', () => {
    draft.amountText.set('10');
    draft.setSplitType('percent');
    draft.percentTexts.set(
      new Map([
        [1, '33,33'],
        [2, '33,33'],
        [3, '33,33'],
      ]),
    );
    expect(draft.valid()).toBe(false);
    expect(draft.runningTotal()).toEqual({ entered: 9999, target: 10000 });
  });

  it('is invalid when exact is off by one cent', () => {
    draft.amountText.set('24,50');
    draft.setSplitType('exact');
    draft.exactTexts.set(
      new Map([
        [1, '18,50'],
        [2, '5,99'],
      ]),
    );
    expect(draft.valid()).toBe(false);
    draft.exactTexts.set(
      new Map([
        [1, '18,50'],
        [2, '6'],
      ]),
    );
    expect(draft.valid()).toBe(true);
  });

  it('reports the running total for exact and none for equal', () => {
    draft.amountText.set('24,50');
    expect(draft.runningTotal()).toBeNull();
    draft.setSplitType('exact');
    draft.exactTexts.set(new Map([[1, '18,50']]));
    expect(draft.runningTotal()).toEqual({ entered: 1850, target: 2450 });
  });

  it('resets a mode to its defaults when selected again', () => {
    draft.setSplitType('shares');
    draft.weights.set(new Map([[1, 5]]));
    draft.setSplitType('equal');
    draft.setSplitType('shares');
    expect([...draft.weights().values()]).toEqual([1, 1, 1, 1]);
  });

  describe('toRequest', () => {
    it('falls back to the default title and uses now for today', () => {
      draft.amountText.set('24,50');
      draft.title.set('  ');
      const request = draft.toRequest();
      expect(request.title).toBe('Payment, 26 Oct');
      expect(request.paidAt).toBe(clock.toISOString());
      expect(request.fullAmount).toBe(2450);
      expect(request.payerMemberId).toBe(3);
      expect(request.splitType).toBe('equal');
      expect(request.participants).toEqual([
        { memberId: 1, inputValue: 0 },
        { memberId: 2, inputValue: 0 },
        { memberId: 3, inputValue: 0 },
        { memberId: 4, inputValue: 0 },
      ]);
    });

    it('follows the clock between calls', () => {
      draft.amountText.set('10');
      let current = clock;
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: NOW, useValue: () => current }],
      });
      const live = TestBed.inject(PaymentDraft);
      live.startNew(7, members, 3);
      live.amountText.set('10');
      const first = live.toRequest().paidAt;
      current = new Date(2026, 9, 26, 15, 45);
      expect(first).toBe(clock.toISOString());
      expect(live.toRequest().paidAt).toBe(current.toISOString());
    });

    it('uses noon local time for a past date', () => {
      draft.amountText.set('10');
      draft.title.set('Dinner');
      draft.date.set('2026-10-20');
      const request = draft.toRequest();
      expect(request.title).toBe('Dinner');
      expect(request.paidAt).toBe(new Date(2026, 9, 20, 12).toISOString());
    });
  });

  describe('startEdit', () => {
    const payment: PaymentResponse = {
      id: 9,
      payerMemberId: 2,
      groupId: 7,
      title: 'Taxi',
      paidAt: new Date(2026, 9, 20, 9, 15).toISOString(),
      fullAmount: 2450,
      splitType: 'percent',
      createdAt: new Date(2026, 9, 20).toISOString(),
    };
    const shares: PaymentShareResponse[] = [
      { paymentId: 9, memberId: 1, inputValue: 5000, amount: 1225 },
      { paymentId: 9, memberId: 2, inputValue: 5000, amount: 1225 },
    ];

    beforeEach(() => {
      draft.startEdit(payment, shares, members);
    });

    it('round-trips a percent payment', () => {
      expect(draft.mode()).toBe('edit');
      expect(draft.paymentId()).toBe(9);
      expect(draft.amountText()).toBe('24,50');
      expect(draft.title()).toBe('Taxi');
      expect(draft.payerMemberId()).toBe(2);
      expect(draft.date()).toBe('2026-10-20');
      expect(draft.splitType()).toBe('percent');
      expect([...draft.included()]).toEqual([1, 2]);
      expect(draft.percentTexts().get(1)).toBe('50');
      expect(draft.percentTexts().get(2)).toBe('50');
      expect(draft.valid()).toBe(true);
    });

    it('keeps the stored paidAt when the date is unchanged', () => {
      expect(draft.toRequest().paidAt).toBe(payment.paidAt);
    });

    it('uses noon when the date changes', () => {
      draft.date.set('2026-10-21');
      expect(draft.toRequest().paidAt).toBe(new Date(2026, 9, 21, 12).toISOString());
    });

    it('maps shares weights and exact amounts back', () => {
      draft.startEdit(
        { ...payment, splitType: 'shares' },
        [
          { paymentId: 9, memberId: 1, inputValue: 2, amount: 1633 },
          { paymentId: 9, memberId: 2, inputValue: 1, amount: 817 },
        ],
        members,
      );
      expect(draft.weights().get(1)).toBe(2);
      expect(draft.weights().get(2)).toBe(1);
      draft.startEdit(
        { ...payment, splitType: 'exact' },
        [
          { paymentId: 9, memberId: 1, inputValue: 1850, amount: 1850 },
          { paymentId: 9, memberId: 2, inputValue: 600, amount: 600 },
        ],
        members,
      );
      expect(draft.exactTexts().get(1)).toBe('18,50');
      expect(draft.valid()).toBe(true);
    });
  });
});
