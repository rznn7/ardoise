import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  type ConsumeInviteLinkResponse,
  type MeResponse,
  type PreviewInviteLinkResponse,
} from '@ardoise/shared';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NEVER, type Observable, of, throwError } from 'rxjs';
import { AuthApiService } from 'src/app/auth/auth-api.service';
import { LastGroupService } from 'src/app/expense-group/last-group.service';
import { AcceptInviteFlow } from 'src/app/invite-link/accept-invite-flow.service';
import { InviteLinkApiService } from 'src/app/invite-link/invite-link-api.service';
import { LANGUAGE_STORAGE_KEY, LanguageService } from 'src/app/shared/i18n/language.service';
import { describe, expect, it, vi } from 'vitest';

import { AcceptInvite } from './accept-invite';

describe(AcceptInvite.name, () => {
  it('missing token shows the invalid state', async () => {
    const preview = vi.fn<(token: string) => Observable<PreviewInviteLinkResponse>>();
    await render(AcceptInvite, {
      providers: [
        { provide: InviteLinkApiService, useValue: { preview } },
        { provide: AuthApiService, useValue: {} },
      ],
    });

    expect(screen.getByText(/no longer valid/i)).toBeTruthy();
    expect(preview).not.toHaveBeenCalled();
  });

  it('failed preview shows the invalid state', async () => {
    const preview = vi
      .fn<(token: string) => Observable<PreviewInviteLinkResponse>>()
      .mockReturnValue(
        throwError(
          () => new HttpErrorResponse({ status: 400, error: { error: 'INVITE_NOT_FOUND' } }),
        ),
      );
    await render(AcceptInvite, {
      inputs: { token: 'x' },
      providers: [
        { provide: InviteLinkApiService, useValue: { preview } },
        { provide: AuthApiService, useValue: {} },
      ],
    });

    expect(await screen.findByText(/no longer valid/i)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(preview).toHaveBeenCalledWith('x');
  });

  it('logged-in user sees a one-tap join', async () => {
    const preview = vi
      .fn<(token: string) => Observable<PreviewInviteLinkResponse>>()
      .mockReturnValue(of({ groupName: 'Trip to Lisbon' }));
    const me = vi
      .fn<() => Observable<MeResponse>>()
      .mockReturnValue(of({ id: 1, name: 'john', role: 'user' }));
    await render(AcceptInvite, {
      inputs: { token: 'x' },
      providers: [
        { provide: InviteLinkApiService, useValue: { preview } },
        { provide: AuthApiService, useValue: { me } },
      ],
    });

    expect(await screen.findByRole('button', { name: 'Join Trip to Lisbon' })).toBeTruthy();
  });

  it('logged-in join consumes and navigates', async () => {
    const preview = vi
      .fn<(token: string) => Observable<PreviewInviteLinkResponse>>()
      .mockReturnValue(of({ groupName: 'Trip to Lisbon' }));
    const me = vi
      .fn<() => Observable<MeResponse>>()
      .mockReturnValue(of({ id: 1, name: 'john', role: 'user' }));
    const consume = vi
      .fn<(token: string) => Observable<ConsumeInviteLinkResponse>>()
      .mockReturnValue(of({ groupId: 1, alreadyMember: false }));
    const navigate = vi.fn();
    await render(AcceptInvite, {
      inputs: { token: 'x' },
      providers: [
        { provide: InviteLinkApiService, useValue: { preview, consume } },
        { provide: AuthApiService, useValue: { me } },
        { provide: Router, useValue: { navigate } },
      ],
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Join Trip to Lisbon' }));

    expect(consume).toHaveBeenCalledWith('x');
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(['/home']);
    });
  });

  it('logged-out user sees login-primary, register-secondary', async () => {
    const preview = vi
      .fn<(token: string) => Observable<PreviewInviteLinkResponse>>()
      .mockReturnValue(of({ groupName: 'Trip to Lisbon' }));
    const me = vi
      .fn<() => Observable<MeResponse>>()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    await render(AcceptInvite, {
      inputs: { token: 'x' },
      providers: [
        { provide: InviteLinkApiService, useValue: { preview } },
        { provide: AuthApiService, useValue: { me } },
      ],
    });

    expect(
      await screen.findByRole('button', { name: 'Log in to join Trip to Lisbon' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New here? Join with a passkey' })).toBeTruthy();
  });

  it('presents the invite with the group name', async () => {
    const preview = vi
      .fn<(token: string) => Observable<PreviewInviteLinkResponse>>()
      .mockReturnValue(of({ groupName: 'Trip to Lisbon' }));
    const me = vi
      .fn<() => Observable<MeResponse>>()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    await render(AcceptInvite, {
      inputs: { token: 'x' },
      providers: [
        { provide: InviteLinkApiService, useValue: { preview } },
        { provide: AuthApiService, useValue: { me } },
      ],
    });

    expect(await screen.findByText("You're invited to")).toBeTruthy();
    expect(screen.getByText('Trip to Lisbon')).toBeTruthy();
  });

  it('logged-out primary action invokes loginThenJoin', async () => {
    const preview = vi
      .fn<(token: string) => Observable<PreviewInviteLinkResponse>>()
      .mockReturnValue(of({ groupName: 'Trip to Lisbon' }));
    const me = vi
      .fn<() => Observable<MeResponse>>()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const loginThenJoin = vi
      .fn<(token: string) => Observable<ConsumeInviteLinkResponse>>()
      .mockReturnValue(of({ groupId: 1, alreadyMember: false }));
    const registerThenJoin = vi.fn<(token: string) => Observable<ConsumeInviteLinkResponse>>();
    await render(AcceptInvite, {
      inputs: { token: 'x' },
      providers: [
        { provide: InviteLinkApiService, useValue: { preview } },
        { provide: AuthApiService, useValue: { me } },
        { provide: AcceptInviteFlow, useValue: { loginThenJoin, registerThenJoin } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });

    await userEvent.click(
      await screen.findByRole('button', { name: 'Log in to join Trip to Lisbon' }),
    );

    expect(loginThenJoin).toHaveBeenCalledWith('x');
    expect(registerThenJoin).not.toHaveBeenCalled();
  });

  const renderLoggedOut = async () => {
    const preview = vi
      .fn<(token: string) => Observable<PreviewInviteLinkResponse>>()
      .mockReturnValue(of({ groupName: 'Trip to Lisbon' }));
    const me = vi
      .fn<() => Observable<MeResponse>>()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const loginThenJoin = vi.fn<(token: string) => Observable<ConsumeInviteLinkResponse>>();
    const registerThenJoin = vi
      .fn<(token: string, name?: string) => Observable<void>>()
      .mockReturnValue(of(undefined));
    await render(AcceptInvite, {
      inputs: { token: 'x' },
      providers: [
        { provide: InviteLinkApiService, useValue: { preview } },
        { provide: AuthApiService, useValue: { me } },
        { provide: AcceptInviteFlow, useValue: { loginThenJoin, registerThenJoin } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'New here? Join with a passkey' }),
    );
    return { loginThenJoin, registerThenJoin };
  };

  it('asks for my name before the passkey', async () => {
    const { registerThenJoin } = await renderLoggedOut();

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Your name' });
    expect(input.placeholder).toBe('Optional');
    expect(input.maxLength).toBe(50);
    expect(
      screen.getByText('Shown to everyone in your groups. You can change it later in Settings.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create passkey' })).toBeTruthy();
    expect(registerThenJoin).not.toHaveBeenCalled();
  });

  it('sends the trimmed name', async () => {
    const { registerThenJoin, loginThenJoin } = await renderLoggedOut();

    await userEvent.type(screen.getByRole('textbox', { name: 'Your name' }), '  Ana ');
    await userEvent.click(screen.getByRole('button', { name: 'Create passkey' }));

    expect(registerThenJoin).toHaveBeenCalledWith('x', 'Ana');
    expect(loginThenJoin).not.toHaveBeenCalled();
  });

  it('sends no name when left blank', async () => {
    const { registerThenJoin } = await renderLoggedOut();

    await userEvent.type(screen.getByRole('textbox', { name: 'Your name' }), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Create passkey' }));

    expect(registerThenJoin).toHaveBeenCalledWith('x', undefined);
  });

  it('moves focus to the name field, and back to the join button', async () => {
    await renderLoggedOut();

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Your name' }));
    });
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'New here? Join with a passkey' }),
      );
    });
  });

  it('goes back to the two choices', async () => {
    await renderLoggedOut();

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('button', { name: 'Log in to join Trip to Lisbon' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New here? Join with a passkey' })).toBeTruthy();
  });

  it('success shows a brief success state, then navigates', async () => {
    const preview = vi
      .fn<(token: string) => Observable<PreviewInviteLinkResponse>>()
      .mockReturnValue(of({ groupName: 'Trip to Lisbon' }));
    const me = vi
      .fn<() => Observable<MeResponse>>()
      .mockReturnValue(of({ id: 1, name: 'john', role: 'user' }));
    const consume = vi
      .fn<(token: string) => Observable<ConsumeInviteLinkResponse>>()
      .mockReturnValue(of({ groupId: 1, alreadyMember: false }));
    const navigate = vi.fn();
    await render(AcceptInvite, {
      inputs: { token: 'x' },
      providers: [
        { provide: InviteLinkApiService, useValue: { preview, consume } },
        { provide: AuthApiService, useValue: { me } },
        { provide: Router, useValue: { navigate } },
      ],
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Join Trip to Lisbon' }));

    expect(await screen.findByText("You're in! — Trip to Lisbon")).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(['/home']);
    });
  });

  it('already-a-member is treated as success', async () => {
    const preview = vi
      .fn<(token: string) => Observable<PreviewInviteLinkResponse>>()
      .mockReturnValue(of({ groupName: 'Trip to Lisbon' }));
    const me = vi
      .fn<() => Observable<MeResponse>>()
      .mockReturnValue(of({ id: 1, name: 'john', role: 'user' }));
    const consume = vi
      .fn<(token: string) => Observable<ConsumeInviteLinkResponse>>()
      .mockReturnValue(of({ groupId: 1, alreadyMember: true }));
    const navigate = vi.fn();
    await render(AcceptInvite, {
      inputs: { token: 'x' },
      providers: [
        { provide: InviteLinkApiService, useValue: { preview, consume } },
        { provide: AuthApiService, useValue: { me } },
        { provide: Router, useValue: { navigate } },
      ],
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Join Trip to Lisbon' }));

    expect(screen.queryByRole('alert')).toBeNull();
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(['/home']);
    });
  });

  it('action failure shows retry and preserves context', async () => {
    const preview = vi
      .fn<(token: string) => Observable<PreviewInviteLinkResponse>>()
      .mockReturnValue(of({ groupName: 'Trip to Lisbon' }));
    const me = vi
      .fn<() => Observable<MeResponse>>()
      .mockReturnValue(of({ id: 1, name: 'john', role: 'user' }));
    const consume = vi
      .fn<(token: string) => Observable<ConsumeInviteLinkResponse>>()
      .mockReturnValue(throwError(() => new Error('consume failed')));
    await render(AcceptInvite, {
      inputs: { token: 'x' },
      providers: [
        { provide: InviteLinkApiService, useValue: { preview, consume } },
        { provide: AuthApiService, useValue: { me } },
      ],
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Join Trip to Lisbon' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
    expect(screen.getByText(/Trip to Lisbon/)).toBeTruthy();
  });

  it('passkey cancellation is neutral, not an error', async () => {
    const preview = vi
      .fn<(token: string) => Observable<PreviewInviteLinkResponse>>()
      .mockReturnValue(of({ groupName: 'Trip to Lisbon' }));
    const me = vi
      .fn<() => Observable<MeResponse>>()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const loginThenJoin = vi
      .fn<(token: string) => Observable<ConsumeInviteLinkResponse>>()
      .mockReturnValue(throwError(() => new DOMException('cancelled', 'NotAllowedError')));
    await render(AcceptInvite, {
      inputs: { token: 'x' },
      providers: [
        { provide: InviteLinkApiService, useValue: { preview } },
        { provide: AuthApiService, useValue: { me } },
        { provide: AcceptInviteFlow, useValue: { loginThenJoin } },
      ],
    });

    await userEvent.click(
      await screen.findByRole('button', { name: 'Log in to join Trip to Lisbon' }),
    );

    expect(await screen.findByText(/tap to try again/i)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(/Trip to Lisbon/)).toBeTruthy();
  });

  it('couldn’t-load state on a preview network failure', async () => {
    const preview = vi
      .fn<(token: string) => Observable<PreviewInviteLinkResponse>>()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    await render(AcceptInvite, {
      inputs: { token: 'x' },
      providers: [
        { provide: InviteLinkApiService, useValue: { preview } },
        { provide: AuthApiService, useValue: {} },
      ],
    });

    expect(await screen.findByText(/couldn't load/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
    expect(screen.queryByText(/no longer valid/i)).toBeNull();
  });

  it('announces loading in French on a French device', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    await render(AcceptInvite, {
      inputs: { token: 'x' },
      providers: [
        {
          provide: InviteLinkApiService,
          useValue: { preview: vi.fn().mockReturnValue(NEVER) },
        },
        { provide: AuthApiService, useValue: {} },
      ],
    });

    await TestBed.inject(LanguageService).ready();

    expect(await screen.findByRole('status', { name: 'Chargement' })).toBeTruthy();
  });

  it('non-401 me() falls back to logged-out', async () => {
    const preview = vi
      .fn<(token: string) => Observable<PreviewInviteLinkResponse>>()
      .mockReturnValue(of({ groupName: 'Trip to Lisbon' }));
    const me = vi
      .fn<() => Observable<MeResponse>>()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    await render(AcceptInvite, {
      inputs: { token: 'x' },
      providers: [
        { provide: InviteLinkApiService, useValue: { preview } },
        { provide: AuthApiService, useValue: { me } },
      ],
    });

    expect(
      await screen.findByRole('button', { name: 'Log in to join Trip to Lisbon' }),
    ).toBeTruthy();
  });

  it('remembers the joined group so home does not bounce to another one', async () => {
    const preview = vi
      .fn<(token: string) => Observable<PreviewInviteLinkResponse>>()
      .mockReturnValue(of({ groupName: 'Trip to Lisbon' }));
    const me = vi
      .fn<() => Observable<MeResponse>>()
      .mockReturnValue(of({ id: 1, name: 'john', role: 'user' }));
    const consume = vi
      .fn<(token: string) => Observable<ConsumeInviteLinkResponse>>()
      .mockReturnValue(of({ groupId: 42, alreadyMember: false }));
    const remember = vi.fn<(groupId: number) => void>();
    const navigate = vi.fn();
    await render(AcceptInvite, {
      inputs: { token: 'x' },
      providers: [
        { provide: InviteLinkApiService, useValue: { preview, consume } },
        { provide: AuthApiService, useValue: { me } },
        { provide: LastGroupService, useValue: { remember } },
        { provide: Router, useValue: { navigate } },
      ],
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Join Trip to Lisbon' }));

    expect(remember).toHaveBeenCalledWith(42);
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(['/home']);
    });
  });

  it('skips the launch redirect after joining by registering', async () => {
    const preview = vi
      .fn<(token: string) => Observable<PreviewInviteLinkResponse>>()
      .mockReturnValue(of({ groupName: 'Trip to Lisbon' }));
    const me = vi
      .fn<() => Observable<MeResponse>>()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const skipLaunchRedirect = vi.fn<() => void>();
    await render(AcceptInvite, {
      inputs: { token: 'x' },
      providers: [
        { provide: InviteLinkApiService, useValue: { preview } },
        { provide: AuthApiService, useValue: { me } },
        { provide: AcceptInviteFlow, useValue: { registerThenJoin: () => of(undefined) } },
        { provide: LastGroupService, useValue: { remember: vi.fn(), skipLaunchRedirect } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });

    await userEvent.click(
      await screen.findByRole('button', { name: 'New here? Join with a passkey' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create passkey' }));

    expect(skipLaunchRedirect).toHaveBeenCalled();
  });
});
