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

type Rename = ReturnType<typeof vi.fn<(name: string) => Observable<MeResponse>>>;

async function setup({
  logout = vi.fn<() => Observable<void>>().mockReturnValue(of(undefined)),
  rename = vi
    .fn<(name: string) => Observable<MeResponse>>()
    .mockImplementation((name) => of({ ...ME, name })),
}: { logout?: ReturnType<typeof vi.fn<() => Observable<void>>>; rename?: Rename } = {}) {
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
      { provide: AuthService, useValue: { currentUser: () => of(ME), logout, rename } },
      { provide: ThemeService, useValue: { preference, setPreference } },
      { provide: AppVersion, useValue: { label: signal('Version a1b2c3d · 3 Nov 2026') } },
    ],
  });
  const harness = await RouterTestingHarness.create('/settings');
  harness.detectChanges();
  return { logout, rename, setPreference, router: TestBed.inject(Router) };
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

  const openNameSheet = async (): Promise<HTMLInputElement> => {
    await userEvent.click(screen.getByRole('button', { name: /^Name/ }));
    await screen.findByRole('dialog');
    return screen.getByRole<HTMLInputElement>('textbox', { name: 'Your name' });
  };

  const typeName = async (value: string): Promise<void> => {
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Your name' });
    await userEvent.clear(input);
    await userEvent.type(input, value);
  };

  const saveButton = (): HTMLButtonElement =>
    screen.getByRole<HTMLButtonElement>('button', { name: 'Save' });

  it('shows my name', async () => {
    await setup();

    expect(screen.getByRole('button', { name: /^Name/ }).textContent).toContain('Gabriel');
    expect(screen.getByText('Shown to everyone in your groups.')).toBeTruthy();
  });

  it('opens the name sheet prefilled', async () => {
    await setup();

    const input = await openNameSheet();

    expect(screen.getByRole('dialog').textContent).toContain('Your name');
    expect(input.value).toBe('Gabriel');
    expect(input.maxLength).toBe(50);
  });

  it('disables Save for a blank or unchanged name', async () => {
    await setup();
    await openNameSheet();

    await typeName('   ');
    expect(saveButton().disabled).toBe(true);
    await typeName(' Gabriel ');
    expect(saveButton().disabled).toBe(true);
    await typeName('Ana');
    expect(saveButton().disabled).toBe(false);
  });

  it('saves the trimmed name and closes', async () => {
    const { rename } = await setup();
    await openNameSheet();

    await typeName('  Ana ');
    await userEvent.click(saveButton());

    expect(rename).toHaveBeenCalledWith('Ana');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('button', { name: /^Name/ }).textContent).toContain('Ana');
  });

  it('keeps my edit when saving fails', async () => {
    const rename = vi
      .fn<(name: string) => Observable<MeResponse>>()
      .mockReturnValue(throwError(() => new Error('offline')));
    await setup({ rename });
    await openNameSheet();

    await typeName('Ana');
    await userEvent.click(saveButton());

    expect(await screen.findByText("Couldn't save your name. Try again.")).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Your name' }).value).toBe('Ana');
    expect(saveButton().disabled).toBe(false);
  });
});
