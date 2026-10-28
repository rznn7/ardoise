import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { RealtimeService } from 'src/app/shared/realtime/realtime.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const realtime = inject(RealtimeService);

  return auth.currentUser().pipe(
    map(() => {
      realtime.connect();
      return true;
    }),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.currentUser().pipe(
    map(() => router.createUrlTree(['/home'])),
    catchError(() => of(true)),
  );
};
