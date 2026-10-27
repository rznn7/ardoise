import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type UrlTree } from '@angular/router';
import { type MeResponse } from '@ardoise/shared';
import { firstValueFrom, type Observable, of } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';

import { adminGuard } from './admin.guard';

const run = async (me: MeResponse): Promise<boolean | UrlTree> => {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { currentUser: () => of(me) } },
    ],
  });
  const result = TestBed.runInInjectionContext(() =>
    adminGuard({} as never, {} as never),
  ) as Observable<boolean | UrlTree>;
  return firstValueFrom(result);
};

describe('adminGuard', () => {
  it('lets an admin in', async () => {
    expect(await run({ id: 1, name: 'Ada', role: 'admin' })).toBe(true);
  });

  it('adminGuard redirects a plain user', async () => {
    const result = await run({ id: 2, name: 'Léa', role: 'user' });

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/home');
  });
});
