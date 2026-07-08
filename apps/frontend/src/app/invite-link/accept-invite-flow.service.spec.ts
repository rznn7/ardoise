import { TestBed } from '@angular/core/testing';
import { type ConsumeInviteLinkResponse } from '@ardoise/shared';
import { firstValueFrom, type Observable, of, throwError } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { describe, expect, it, vi } from 'vitest';

import { AcceptInviteFlow, AcceptInviteStepError } from './accept-invite-flow.service';
import { InviteLinkApiService } from './invite-link-api.service';

describe(AcceptInviteFlow.name, () => {
  it('loginThenJoin runs login before consume', async () => {
    const calls: string[] = [];
    const login = vi.fn<() => Observable<void>>().mockImplementation(() => {
      calls.push('login');
      return of(undefined);
    });
    const consume = vi
      .fn<(token: string) => Observable<ConsumeInviteLinkResponse>>()
      .mockImplementation(() => {
        calls.push('consume');
        return of({ groupId: 1, alreadyMember: false });
      });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { login } },
        { provide: InviteLinkApiService, useValue: { consume } },
      ],
    });
    const flow = TestBed.inject(AcceptInviteFlow);

    const result = await firstValueFrom(flow.loginThenJoin('token'));

    expect(calls).toEqual(['login', 'consume']);
    expect(result).toEqual({ groupId: 1, alreadyMember: false });
  });

  it('registerThenJoin registers and does NOT log in', async () => {
    const login = vi.fn<() => Observable<void>>();
    const register = vi.fn<(token: string) => Observable<void>>().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { login, register } }],
    });
    const flow = TestBed.inject(AcceptInviteFlow);

    await firstValueFrom(flow.registerThenJoin('token'));

    expect(register).toHaveBeenCalledWith('token');
    expect(login).not.toHaveBeenCalled();
  });

  it('loginThenJoin partial failure surfaces at the consume step', async () => {
    const login = vi.fn<() => Observable<void>>().mockReturnValue(of(undefined));
    const consume = vi
      .fn<(token: string) => Observable<ConsumeInviteLinkResponse>>()
      .mockReturnValue(throwError(() => new Error('consume failed')));
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { login } },
        { provide: InviteLinkApiService, useValue: { consume } },
      ],
    });
    const flow = TestBed.inject(AcceptInviteFlow);

    const error = await firstValueFrom(flow.loginThenJoin('token')).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(AcceptInviteStepError);
    expect((error as AcceptInviteStepError).step).toBe('consume');
    expect(login).toHaveBeenCalled();
  });
});
