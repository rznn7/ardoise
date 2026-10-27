import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { type AdminGroup } from '@ardoise/shared';
import { screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { type Observable, of, throwError } from 'rxjs';
import { AdminApiService } from 'src/app/admin/admin-api.service';
import { withHistoryPageIds } from 'src/app/shared/navigation/back';
import { openFirstPage } from 'src/app/shared/navigation/first-page.testing';
import { ToastService } from 'src/app/shared/toast.service';

import { AdminGroupPage } from './admin-group';

@Component({ template: '' })
class Blank {}

const now = new Date();
const inDays = (days: number): string => new Date(now.getTime() + days * 86_400_000).toISOString();

const LISBON: AdminGroup = {
  group: {
    id: 7,
    name: 'Lisbon trip',
    currencyCode: 'EUR',
    createdAt: new Date(2026, 9, 1, 12).toISOString(),
    paymentCount: 31,
    totalSpent: 124000,
  },
  members: [
    { memberId: 11, userId: 1, name: 'Ada', isModerator: true, balance: -4250 },
    { memberId: 12, userId: 2, name: 'Léa', isModerator: false, balance: 4250 },
  ],
  inviteLinks: [
    {
      id: 4,
      singleUse: false,
      status: 'active',
      expiresAt: inDays(5),
      burnedAt: null,
      burnedByName: null,
      revokedAt: null,
      createdAt: inDays(-1),
    },
    {
      id: 3,
      singleUse: true,
      status: 'used',
      expiresAt: inDays(2),
      burnedAt: new Date(2026, 9, 3, 12).toISOString(),
      burnedByName: 'Tom',
      revokedAt: null,
      createdAt: inDays(-5),
    },
    {
      id: 2,
      singleUse: true,
      status: 'expired',
      expiresAt: new Date(2026, 9, 20, 12).toISOString(),
      burnedAt: null,
      burnedByName: null,
      revokedAt: null,
      createdAt: inDays(-10),
    },
    {
      id: 1,
      singleUse: false,
      status: 'revoked',
      expiresAt: inDays(3),
      burnedAt: null,
      burnedByName: null,
      revokedAt: new Date(2026, 9, 21, 12).toISOString(),
      createdAt: inDays(-12),
    },
  ],
};

async function setup(group: Observable<AdminGroup> = of(LISBON)) {
  const revokeInviteLink = vi.fn<(id: number) => Observable<void>>().mockReturnValue(of(undefined));
  const error = vi.fn<(message: string) => void>();
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [
          { path: 'admin', component: Blank },
          { path: 'admin/groups/:groupId', component: AdminGroupPage },
          { path: 'admin/users/:userId', component: Blank },
        ],
        withComponentInputBinding(),
        withHistoryPageIds(),
      ),
      { provide: AdminApiService, useValue: { group: () => group, revokeInviteLink } },
      { provide: ToastService, useValue: { error } },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await openFirstPage(harness, '/admin/groups/7');
  harness.detectChanges();
  return { revokeInviteLink, error };
}

describe('AdminGroupPage', () => {
  it('shows the group, its members and balances', async () => {
    await setup();

    expect(screen.getByRole('heading', { name: 'Lisbon trip' })).toBeTruthy();
    expect(screen.getByText('EUR · created 1 Oct · 31 payments · €1,240.00 spent')).toBeTruthy();
    const ada = screen.getByRole('link', { name: /ada/i });
    expect(within(ada).getByText('Moderator')).toBeTruthy();

    await userEvent.click(screen.getByRole('link', { name: /léa/i }));
    await waitFor(() => {
      expect(TestBed.inject(Router).url).toBe('/admin/users/2');
    });
  });

  it('words each invite link by status, Revoke only on active ones', async () => {
    await setup();

    expect(screen.getByText('Expires in 5 days')).toBeTruthy();
    expect(screen.getByText('Used by Tom · 3 Oct')).toBeTruthy();
    expect(screen.getByText('Expired 20 Oct')).toBeTruthy();
    expect(screen.getByText('Revoked 21 Oct')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(1);
  });

  it('revokes a link after confirming', async () => {
    const { revokeInviteLink } = await setup();

    await userEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('Revoke this link?')).toBeTruthy();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Revoke' }));

    expect(revokeInviteLink).toHaveBeenCalledWith(4);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Revoke' })).toBeNull();
    });
    expect(screen.getAllByText(/^Revoked/)).toHaveLength(2);
  });

  it('puts the link back when the revoke fails', async () => {
    const { revokeInviteLink, error } = await setup();
    revokeInviteLink.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    await userEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Revoke' }),
    );

    expect(await screen.findByRole('button', { name: 'Revoke' })).toBeTruthy();
    expect(error).toHaveBeenCalledWith("Couldn't revoke the link");
  });

  it('says when there are no invite links', async () => {
    await setup(of({ ...LISBON, inviteLinks: [] }));

    expect(screen.getByText('No invite links')).toBeTruthy();
  });

  it('says when the group does not exist', async () => {
    await setup(throwError(() => new HttpErrorResponse({ status: 404 })));

    expect(screen.getByText('This group no longer exists')).toBeTruthy();
  });
});
