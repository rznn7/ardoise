import { TestBed } from '@angular/core/testing';
import { type MeResponse } from '@ardoise/shared';
import { firstValueFrom, of, throwError } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { AuthApiService } from 'src/app/auth/auth-api.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ME: MeResponse = { id: 1, name: 'Alice', role: 'user' };

describe('AuthService.currentUser', () => {
  let me: ReturnType<typeof vi.fn>;
  let logout: ReturnType<typeof vi.fn>;
  let auth: AuthService;

  beforeEach(() => {
    me = vi.fn(() => of(ME));
    logout = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      providers: [{ provide: AuthApiService, useValue: { me, logout } }],
    });
    auth = TestBed.inject(AuthService);
  });

  it('asks the server once and reuses the answer', async () => {
    expect(await firstValueFrom(auth.currentUser())).toEqual(ME);
    expect(await firstValueFrom(auth.currentUser())).toEqual(ME);
    expect(me).toHaveBeenCalledTimes(1);
  });

  it('does not keep a failed answer', async () => {
    me.mockReturnValueOnce(throwError(() => new Error('401')));
    await expect(firstValueFrom(auth.currentUser())).rejects.toThrow('401');
    expect(await firstValueFrom(auth.currentUser())).toEqual(ME);
    expect(me).toHaveBeenCalledTimes(2);
  });

  it('asks again after logging out', async () => {
    await firstValueFrom(auth.currentUser());
    await firstValueFrom(auth.logout());
    await firstValueFrom(auth.currentUser());
    expect(me).toHaveBeenCalledTimes(2);
  });
});
