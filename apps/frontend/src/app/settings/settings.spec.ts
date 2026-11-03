import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { type MeResponse } from '@ardoise/shared';
import { screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { type Observable, of, throwError } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { type ThemePreference, ThemeService } from 'src/app/shared/theme/theme.service';
import { AppVersion } from 'src/app/shared/version/app-version';

import { Settings } from './settings';

@Component({ template: '' })
class Blank {}

const ME: MeResponse = { id: 1, name: 'Gabriel', role: 'user' };

async function setup({
  logout = vi.fn<() => Observable<void>>().mockReturnValue(of(undefined)),
}: { logout?: ReturnType<typeof vi.fn<() => Observable<void>>> } = {}) {
  const preference = signal<ThemePreference>('system');
  const setPreference = vi.fn((value: ThemePreference) => {
    preference.set(value);
  });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'settings', component: Settings },
        { path: 'login', component: Blank },
        { path: 'home', component: Blank },
      ]),
      { provide: AuthService, useValue: { currentUser: () => of(ME), logout } },
      { provide: ThemeService, useValue: { preference, setPreference } },
      { provide: AppVersion, useValue: { label: signal('Version a1b2c3d · 3 Nov 2026') } },
    ],
  });
  const harness = await RouterTestingHarness.create('/settings');
  harness.detectChanges();
  return { logout, setPreference, router: TestBed.inject(Router) };
}

describe('Settings', () => {
  it('shows the theme choice and applies it at once', async () => {
    const { setPreference } = await setup();

    expect(screen.getByRole('button', { name: 'System', pressed: true })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));

    expect(setPreference).toHaveBeenCalledWith('dark');
    expect(screen.getByRole('button', { name: 'Dark', pressed: true })).toBeTruthy();
  });

  it('asks before signing out', async () => {
    const { logout } = await setup();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Sign out?');
    expect(dialog.textContent).toContain(
      "You'll need your passkey on this device to sign back in.",
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(logout).not.toHaveBeenCalled();
  });

  it('signs out and goes to login', async () => {
    const { logout, router } = await setup();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(logout).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(router.url).toBe('/login');
    });
  });

  it('keeps me signed in when sign out fails', async () => {
    const logout = vi
      .fn<() => Observable<void>>()
      .mockReturnValue(throwError(() => new Error('offline')));
    const { router } = await setup({ logout });

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByText("Couldn't sign out. Try again.")).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' }).hasAttribute('disabled')).toBe(false);
    expect(router.url).toBe('/settings');
  });

  it('shows the version', async () => {
    await setup();

    expect(screen.getByText('Version a1b2c3d · 3 Nov 2026')).toBeTruthy();
  });
});
