import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  type ExpenseGroupSummary,
  type GroupEvent,
  type GroupMember,
  type MeResponse,
  type SettlementResponse,
} from '@ardoise/shared';
import { screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { type Observable, of, Subject, throwError } from 'rxjs';
import { AuthApiService } from 'src/app/auth/auth-api.service';
import { ExpenseGroupApiService } from 'src/app/expense-group/expense-group-api.service';
import { FeedStore } from 'src/app/feed/feed-store';
import { MemberApiService } from 'src/app/member/member-api.service';
import { shortDay } from 'src/app/payment/day-label';
import { SettlementApiService } from 'src/app/settlement/settlement-api.service';
import { withHistoryPageIds } from 'src/app/shared/navigation/back';
import { openFirstPage } from 'src/app/shared/navigation/first-page.testing';
import { RealtimeService } from 'src/app/shared/realtime/realtime.service';
import { ToastService } from 'src/app/shared/toast.service';

import { SettlementDetails } from './settlement-details';

@Component({ template: '' })
class Blank {}

const GROUP: ExpenseGroupSummary = {
  id: 7,
  name: 'Lisbon trip',
  currencyCode: 'EUR',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const ME: MeResponse = { id: 1, name: 'Gabriel', role: 'user' };

const MEMBERS: GroupMember[] = [
  { id: 11, userId: 1, name: 'Gabriel', nickname: null, isModerator: true },
  { id: 12, userId: 2, name: 'Léa', nickname: null, isModerator: false },
  { id: 13, userId: 3, name: 'Tom', nickname: null, isModerator: false },
];

const REPAYMENT: SettlementResponse = {
  id: 9,
  groupId: 7,
  fromMemberId: 11,
  toMemberId: 12,
  amount: 3000,
  settledAt: new Date(2026, 9, 25, 12).toISOString(),
  createdByMemberId: 11,
  createdAt: '2026-10-25T12:00:00.000Z',
};

type FindOne = ReturnType<typeof vi.fn<(id: number) => Observable<SettlementResponse>>>;

async function setup({
  findOne = vi.fn<(id: number) => Observable<SettlementResponse>>().mockReturnValue(of(REPAYMENT)),
}: { findOne?: FindOne } = {}) {
  const undoSettlement = vi.fn<(groupId: number, id: number) => void>();
  const events = new Subject<GroupEvent>();
  const message = vi.fn<(text: string) => void>();
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [
          { path: 'group/:groupId', component: Blank },
          { path: 'group/:groupId/settlements/:settlementId', component: SettlementDetails },
        ],
        withComponentInputBinding(),
        withHistoryPageIds(),
      ),
      { provide: SettlementApiService, useValue: { findOne } },
      { provide: MemberApiService, useValue: { listByGroup: () => of(MEMBERS) } },
      { provide: ExpenseGroupApiService, useValue: { findOne: () => of(GROUP) } },
      { provide: AuthApiService, useValue: { me: () => of(ME) } },
      { provide: FeedStore, useValue: { undoSettlement } },
      { provide: RealtimeService, useValue: { events } },
      { provide: ToastService, useValue: { message } },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await openFirstPage(harness, '/group/7/settlements/9');
  harness.detectChanges();
  return { undoSettlement, findOne, events, message, router: TestBed.inject(Router) };
}

describe('SettlementDetails', () => {
  it('shows who repaid whom, how much and when', async () => {
    await setup();

    expect(screen.getByRole('heading', { name: 'You paid Léa back' })).toBeTruthy();
    expect(screen.getByText('€30.00')).toBeTruthy();
    expect(screen.getByText(`Repayment · ${shortDay(REPAYMENT.settledAt)}`)).toBeTruthy();
  });

  it('hides Undo from a member who is neither side', async () => {
    await setup({
      findOne: vi
        .fn<(id: number) => Observable<SettlementResponse>>()
        .mockReturnValue(of({ ...REPAYMENT, fromMemberId: 13 })),
    });

    expect(screen.getByRole('heading', { name: 'Tom paid Léa back' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo repayment' })).toBeNull();
  });

  it('undoes after confirming, then goes back to the group', async () => {
    const { undoSettlement } = await setup();

    await userEvent.click(screen.getByRole('button', { name: 'Undo repayment' }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('Undo this repayment?')).toBeTruthy();
    expect(within(sheet).getByText("Everyone's balances will be updated.")).toBeTruthy();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Undo repayment' }));

    expect(undoSettlement).toHaveBeenCalledWith(7, 9);
    await waitFor(() => {
      expect(TestBed.inject(Router).url).toBe('/group/7');
    });
  });

  it('cancels without undoing', async () => {
    const { undoSettlement } = await setup();

    await userEvent.click(screen.getByRole('button', { name: 'Undo repayment' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(undoSettlement).not.toHaveBeenCalled();
  });

  it('says the repayment was undone when it no longer exists', async () => {
    await setup({
      findOne: vi
        .fn<(id: number) => Observable<SettlementResponse>>()
        .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 }))),
    });

    expect(screen.getByText('This repayment was undone')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to group' })).toBeTruthy();
  });

  it('offers a retry on error', async () => {
    const findOne = vi
      .fn<(id: number) => Observable<SettlementResponse>>()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValue(of(REPAYMENT));
    await setup({ findOne });

    expect(screen.getByText("Couldn't load this repayment")).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('heading', { name: 'You paid Léa back' })).toBeTruthy();
  });

  it('shows a skeleton while loading', async () => {
    await setup({
      findOne: vi
        .fn<(id: number) => Observable<SettlementResponse>>()
        .mockReturnValue(new Subject()),
    });

    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
  });

  describe('live changes', () => {
    it('leaves with a message when someone else undoes the repayment', async () => {
      const { events, message, router } = await setup();

      events.next({ type: 'settlement.deleted', groupId: 7, opId: null, id: 9 });

      expect(message).toHaveBeenCalledWith('This repayment was undone');
      await waitFor(() => {
        expect(router.url).toBe('/group/7');
      });
    });

    it('ignores the undo of another repayment', async () => {
      const { events, message } = await setup();

      events.next({ type: 'settlement.deleted', groupId: 7, opId: null, id: 10 });

      expect(message).not.toHaveBeenCalled();
    });

    it('says nothing about a repayment I undid myself', async () => {
      const { events, message, router } = await setup();
      vi.spyOn(router, 'navigateByUrl').mockReturnValue(new Promise(() => undefined));

      await userEvent.click(screen.getByRole('button', { name: 'Undo repayment' }));
      const sheet = await screen.findByRole('dialog');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Undo repayment' }));
      events.next({ type: 'settlement.deleted', groupId: 7, opId: 'mine', id: 9 });

      expect(message).not.toHaveBeenCalled();
    });
  });
});
