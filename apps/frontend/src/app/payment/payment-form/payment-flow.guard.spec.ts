import { Location } from '@angular/common';
import { provideLocationMocks, type SpyLocation } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  type ExpenseGroupSummary,
  type GroupMember,
  type MeResponse,
  type PaymentResponse,
  type PaymentShareResponse,
} from '@ardoise/shared';
import { waitFor } from '@testing-library/angular';
import { of, throwError } from 'rxjs';
import { AuthApiService } from 'src/app/auth/auth-api.service';
import { ExpenseGroupApiService } from 'src/app/expense-group/expense-group-api.service';
import { MemberApiService } from 'src/app/member/member-api.service';
import { PaymentApiService } from 'src/app/payment/payment-api.service';
import { PaymentDraft } from 'src/app/payment/payment-draft';

import { paymentFlowGuard } from './payment-flow.guard';

@Component({ template: '' })
class Blank {}

const GROUP: ExpenseGroupSummary = {
  id: 7,
  name: 'Lisbon trip',
  currencyCode: 'EUR',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const ME: MeResponse = { id: 2, name: 'Léa', role: 'user' };

const MEMBERS: GroupMember[] = [
  { id: 11, userId: 1, name: 'Gabriel', nickname: null, isModerator: true },
  { id: 12, userId: 2, name: 'Léa', nickname: null, isModerator: false },
];

const PAYMENT: PaymentResponse = {
  id: 5,
  groupId: 7,
  payerMemberId: 11,
  title: 'Dinner',
  paidAt: '2026-10-25T19:00:00.000Z',
  fullAmount: 4250,
  splitType: 'equal',
  createdAt: '2026-10-25T19:00:00.000Z',
};

const SHARES: PaymentShareResponse[] = [
  { paymentId: 5, memberId: 11, inputValue: 0, amount: 2125 },
  { paymentId: 5, memberId: 12, inputValue: 0, amount: 2125 },
];

const step = (path: string) => ({ path, component: Blank, canActivate: [paymentFlowGuard] });

async function setup({ groupFails = false } = {}): Promise<{
  harness: RouterTestingHarness;
  draft: PaymentDraft;
  router: Router;
}> {
  TestBed.configureTestingModule({
    providers: [
      provideLocationMocks(),
      provideRouter([
        { path: 'group/:groupId', component: Blank },
        {
          path: 'group/:groupId/payments',
          children: [
            { path: 'new', children: [step('amount'), step('title'), step('options')] },
            { path: ':paymentId/edit', children: [step('amount'), step('options')] },
          ],
        },
      ]),
      {
        provide: ExpenseGroupApiService,
        useValue: {
          findOne: () => (groupFails ? throwError(() => new Error('forbidden')) : of(GROUP)),
        },
      },
      { provide: MemberApiService, useValue: { listByGroup: () => of(MEMBERS) } },
      { provide: AuthApiService, useValue: { me: () => of(ME) } },
      {
        provide: PaymentApiService,
        useValue: { findOne: () => of(PAYMENT), sharesOf: () => of(SHARES) },
      },
    ],
  });
  const harness = await RouterTestingHarness.create();
  return { harness, draft: TestBed.inject(PaymentDraft), router: TestBed.inject(Router) };
}

describe('paymentFlowGuard', () => {
  it('redirects new/options with an inactive draft to new/amount, replacing the url', async () => {
    const { harness, router } = await setup();
    await harness.navigateByUrl('/group/7');
    const location = TestBed.inject(Location) as SpyLocation;

    await harness.navigateByUrl('/group/7/payments/new/options');

    expect(router.url).toBe('/group/7/payments/new/amount');
    expect(location.urlChanges.at(-1)).toBe('replace: /group/7/payments/new/amount');
  });

  it('redirects new/title with an inactive draft to new/amount', async () => {
    const { harness, router } = await setup();

    await harness.navigateByUrl('/group/7/payments/new/title');

    expect(router.url).toBe('/group/7/payments/new/amount');
  });

  it('starts a new draft on new/amount with me as payer and the group loaded', async () => {
    const { harness, draft } = await setup();

    await harness.navigateByUrl('/group/7/payments/new/amount');

    expect(draft.active()).toBe(true);
    expect(draft.mode()).toBe('new');
    expect(draft.groupId()).toBe(7);
    expect(draft.payerMemberId()).toBe(12);
    expect(draft.myMemberId()).toBe(12);
    expect(draft.group()).toEqual(GROUP);
  });

  it('lets the later steps through once the draft is active for this group', async () => {
    const { harness, router } = await setup();
    await harness.navigateByUrl('/group/7/payments/new/amount');

    await harness.navigateByUrl('/group/7/payments/new/title');
    await harness.navigateByUrl('/group/7/payments/new/options');

    expect(router.url).toBe('/group/7/payments/new/options');
  });

  it('starts fresh when the add flow is opened again', async () => {
    const { harness, draft } = await setup();
    await harness.navigateByUrl('/group/7/payments/new/amount');
    draft.amountText.set('12');
    await harness.navigateByUrl('/group/7');

    await harness.navigateByUrl('/group/7/payments/new/amount');

    expect(draft.amountText()).toBe('');
  });

  it('keeps the values when coming back to the amount step through history', async () => {
    const { harness, draft, router } = await setup();
    router.setUpLocationChangeListener();
    await harness.navigateByUrl('/group/7/payments/new/amount');
    draft.amountText.set('12');
    await harness.navigateByUrl('/group/7/payments/new/title');

    TestBed.inject(Location).back();

    await waitFor(() => {
      expect(router.url).toBe('/group/7/payments/new/amount');
    });
    expect(draft.amountText()).toBe('12');
  });

  it('sends the user back to the group when the group cannot be loaded', async () => {
    const { harness, router, draft } = await setup({ groupFails: true });

    await harness.navigateByUrl('/group/7/payments/new/amount');

    expect(router.url).toBe('/group/7');
    expect(draft.active()).toBe(false);
  });

  it('loads the payment into an edit draft when entering edit with no draft', async () => {
    const { harness, draft, router } = await setup();

    await harness.navigateByUrl('/group/7/payments/5/edit/options');

    expect(router.url).toBe('/group/7/payments/5/edit/options');
    expect(draft.mode()).toBe('edit');
    expect(draft.paymentId()).toBe(5);
    expect(draft.amountText()).toBe('42,50');
    expect(draft.myMemberId()).toBe(12);
    expect(draft.group()).toEqual(GROUP);
  });

  it('reloads the payment when edit is opened again after the draft was cleared', async () => {
    const { harness, draft } = await setup();
    await harness.navigateByUrl('/group/7/payments/5/edit/options');
    draft.title.set('Abandoned');
    await harness.navigateByUrl('/group/7');
    draft.clear();

    await harness.navigateByUrl('/group/7/payments/5/edit/options');

    expect(draft.title()).toBe('Dinner');
  });

  it('keeps the edit draft when coming back to options through history', async () => {
    const { harness, draft, router } = await setup();
    router.setUpLocationChangeListener();
    await harness.navigateByUrl('/group/7/payments/5/edit/options');
    draft.title.set('Changed');
    await harness.navigateByUrl('/group/7/payments/5/edit/amount');

    TestBed.inject(Location).back();

    await waitFor(() => {
      expect(router.url).toBe('/group/7/payments/5/edit/options');
    });
    expect(draft.title()).toBe('Changed');
  });

  it('keeps the typed amount when Done falls back to options after a direct load', async () => {
    const { harness, draft, router } = await setup();
    await harness.navigateByUrl('/group/7/payments/5/edit/amount');
    draft.amountText.set('99');

    await router.navigateByUrl('/group/7/payments/5/edit/options', { replaceUrl: true });

    expect(router.url).toBe('/group/7/payments/5/edit/options');
    expect(draft.amountText()).toBe('99');
  });

  it('keeps the edit draft when moving between edit steps', async () => {
    const { harness, draft } = await setup();
    await harness.navigateByUrl('/group/7/payments/5/edit/options');
    draft.title.set('Changed');

    await harness.navigateByUrl('/group/7/payments/5/edit/amount');

    expect(draft.title()).toBe('Changed');
  });
});
