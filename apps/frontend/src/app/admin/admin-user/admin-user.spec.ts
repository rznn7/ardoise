import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { type AdminUser } from '@ardoise/shared';
import { screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { type Observable, of, throwError } from 'rxjs';
import { AdminApiService } from 'src/app/admin/admin-api.service';
import { withHistoryPageIds } from 'src/app/shared/navigation/back';
import { openFirstPage } from 'src/app/shared/navigation/first-page.testing';
import { ToastService } from 'src/app/shared/toast.service';

import { AdminUserPage } from './admin-user';

@Component({ template: '' })
class Blank {}

const now = new Date();
const inDays = (days: number): string => new Date(now.getTime() + days * 86_400_000).toISOString();

const LEA: AdminUser = {
  user: {
    id: 2,
    name: 'Léa',
    role: 'user',
    createdAt: inDays(-20),
    lastSignInAt: inDays(0),
    passkeyCount: 1,
  },
  groups: [
    {
      groupId: 7,
      name: 'Lisbon trip',
      currencyCode: 'EUR',
      isModerator: false,
      memberCount: 5,
      balance: 8820,
    },
    {
      groupId: 8,
      name: 'Flatshare',
      currencyCode: 'EUR',
      isModerator: true,
      memberCount: 2,
      balance: -1830,
    },
  ],
  sessions: [
    { id: 41, issuedAt: inDays(0), expiresAt: inDays(6), current: false },
    { id: 40, issuedAt: inDays(-3), expiresAt: inDays(3), current: true },
  ],
};

async function setup(user: Observable<AdminUser> = of(LEA)) {
  const revokeSession = vi.fn<(id: number) => Observable<void>>().mockReturnValue(of(undefined));
  const error = vi.fn<(message: string) => void>();
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [
          { path: 'admin', component: Blank },
          { path: 'admin/users/:userId', component: AdminUserPage },
          { path: 'admin/groups/:groupId', component: Blank },
        ],
        withComponentInputBinding(),
        withHistoryPageIds(),
      ),
      { provide: AdminApiService, useValue: { user: () => user, revokeSession } },
      { provide: ToastService, useValue: { error } },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await openFirstPage(harness, '/admin/users/2');
  harness.detectChanges();
  return { revokeSession, error };
}

describe('AdminUserPage', () => {
  it('shows the account, its groups with role and balance', async () => {
    await setup();

    expect(screen.getByRole('heading', { name: 'Léa' })).toBeTruthy();
    expect(screen.getByText(/signed in today · 1 passkey/)).toBeTruthy();
    const flat = screen.getByRole('link', { name: /flatshare/i });
    expect(within(flat).getByText('Moderator · 2 members')).toBeTruthy();
    expect(within(flat).getByText('−€18.30')).toBeTruthy();

    await userEvent.click(screen.getByRole('link', { name: /lisbon trip/i }));
    await waitFor(() => {
      expect(TestBed.inject(Router).url).toBe('/admin/groups/7');
    });
  });

  it('user with no group', async () => {
    await setup(of({ ...LEA, groups: [], sessions: [] }));

    expect(screen.getByText('No group')).toBeTruthy();
    expect(screen.getByText('No active session')).toBeTruthy();
  });

  it('marks the current session and offers no Revoke on it', async () => {
    await setup();

    expect(screen.getByText('This device')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(1);
  });

  it('revokes a session after confirming', async () => {
    const { revokeSession } = await setup();

    await userEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('Sign this session out?')).toBeTruthy();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Revoke' }));

    expect(revokeSession).toHaveBeenCalledWith(41);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Revoke' })).toBeNull();
    });
  });

  it('puts the session back when the revoke fails', async () => {
    const { revokeSession, error } = await setup();
    revokeSession.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    await userEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Revoke' }),
    );

    expect(await screen.findByRole('button', { name: 'Revoke' })).toBeTruthy();
    expect(error).toHaveBeenCalledWith("Couldn't revoke the session");
  });

  it('says when the user does not exist', async () => {
    await setup(throwError(() => new HttpErrorResponse({ status: 404 })));

    expect(screen.getByText('This user no longer exists')).toBeTruthy();
  });
});
