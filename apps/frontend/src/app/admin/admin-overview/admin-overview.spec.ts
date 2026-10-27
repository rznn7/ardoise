import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { type AdminOverview } from '@ardoise/shared';
import { screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { type Observable, of, Subject, throwError } from 'rxjs';
import { AdminApiService } from 'src/app/admin/admin-api.service';
import { withHistoryPageIds } from 'src/app/shared/navigation/back';
import { openFirstPage } from 'src/app/shared/navigation/first-page.testing';

import { AdminOverviewPage } from './admin-overview';

@Component({ template: '' })
class Blank {}

const today = new Date().toISOString();

const OVERVIEW: AdminOverview = {
  counts: { users: 3, groups: 2, payments: 31 },
  users: [
    { id: 1, name: 'Ada', role: 'admin', createdAt: today, lastSignInAt: today, groupCount: 4 },
    { id: 2, name: 'Léa', role: 'user', createdAt: today, lastSignInAt: today, groupCount: 1 },
    { id: 3, name: 'Zoé', role: 'user', createdAt: today, lastSignInAt: null, groupCount: 0 },
  ],
  groups: [
    {
      id: 7,
      name: 'Lisbon trip',
      currencyCode: 'EUR',
      createdAt: today,
      memberCount: 5,
      paymentCount: 31,
    },
  ],
};

async function setup(overview: Observable<AdminOverview> = of(OVERVIEW), url = '/admin') {
  const load = vi.fn<() => Observable<AdminOverview>>().mockReturnValue(overview);
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [
          { path: 'home', component: Blank },
          { path: 'admin', component: AdminOverviewPage },
          { path: 'admin/users/:userId', component: Blank },
          { path: 'admin/groups/:groupId', component: Blank },
        ],
        withComponentInputBinding(),
        withHistoryPageIds(),
      ),
      { provide: AdminApiService, useValue: { overview: load } },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await openFirstPage(harness, url);
  harness.detectChanges();
  return { load };
}

describe('AdminOverviewPage', () => {
  it('shows the counts and the users', async () => {
    await setup();

    expect(screen.getByRole('heading', { name: 'Admin' })).toBeTruthy();
    expect(screen.getByText('31')).toBeTruthy();
    const ada = screen.getByRole('link', { name: /ada/i });
    expect(within(ada).getByText('Admin')).toBeTruthy();
    expect(within(ada).getByText('4 groups · signed in today')).toBeTruthy();
    expect(screen.getByText('No group · joined today')).toBeTruthy();
  });

  it('switches to the groups without a history entry', async () => {
    await setup();
    const location = TestBed.inject(Location);
    const go = vi.spyOn(location, 'go');

    await userEvent.click(screen.getByRole('button', { name: 'Groups' }));

    await waitFor(() => {
      expect(location.path()).toBe('/admin?tab=groups');
    });
    expect(screen.getByText('5 members · 31 payments · EUR')).toBeTruthy();
    expect(go).not.toHaveBeenCalled();
  });

  it('opens on the groups tab from the URL', async () => {
    await setup(of(OVERVIEW), '/admin?tab=groups');

    expect(screen.getByRole('link', { name: /lisbon trip/i })).toBeTruthy();
  });

  it('shows a loading state', async () => {
    await setup(new Subject());

    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
  });

  it('offers a retry on error', async () => {
    const { load } = await setup(throwError(() => new HttpErrorResponse({ status: 500 })));

    load.mockReturnValue(of(OVERVIEW));
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('link', { name: /ada/i })).toBeTruthy();
  });
});
