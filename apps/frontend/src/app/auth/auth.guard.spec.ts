import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  type RouterStateSnapshot,
} from '@angular/router';
import { firstValueFrom, type Observable, of, throwError } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { RealtimeService } from 'src/app/shared/realtime/realtime.service';

import { authGuard } from './auth.guard';

function setup(currentUser: () => Observable<unknown>) {
  const connect = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser } },
      { provide: RealtimeService, useValue: { connect } },
    ],
  });
  const run = () =>
    firstValueFrom(
      TestBed.runInInjectionContext(() =>
        authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      ) as Observable<unknown>,
    );
  return { connect, run };
}

describe('authGuard', () => {
  it('opens the live stream once the user is known', async () => {
    const { connect, run } = setup(() => of({ id: 1 }));

    expect(await run()).toBe(true);

    expect(connect).toHaveBeenCalledOnce();
  });

  it('opens nothing when there is no session', async () => {
    const { connect, run } = setup(() => throwError(() => new Error('401')));

    await run();

    expect(connect).not.toHaveBeenCalled();
  });
});
