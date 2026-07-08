import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  type ConsumeInviteLinkResponse,
  type MeResponse,
  type PreviewInviteLinkResponse,
} from '@ardoise/shared';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { type Observable, of, throwError } from 'rxjs';
import { AuthApiService } from 'src/app/auth/auth-api.service';
import { AcceptInviteFlow } from 'src/app/invite-link/accept-invite-flow.service';
import { InviteLinkApiService } from 'src/app/invite-link/invite-link-api.service';
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

  it('logged-out secondary action invokes registerThenJoin', async () => {
    const preview = vi
      .fn<(token: string) => Observable<PreviewInviteLinkResponse>>()
      .mockReturnValue(of({ groupName: 'Trip to Lisbon' }));
    const me = vi
      .fn<() => Observable<MeResponse>>()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const loginThenJoin = vi.fn<(token: string) => Observable<ConsumeInviteLinkResponse>>();
    const registerThenJoin = vi
      .fn<(token: string) => Observable<ConsumeInviteLinkResponse>>()
      .mockReturnValue(of({ groupId: 1, alreadyMember: false }));
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

    expect(registerThenJoin).toHaveBeenCalledWith('x');
    expect(loginThenJoin).not.toHaveBeenCalled();
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
});
