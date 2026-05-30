import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthApiService } from 'src/app/auth/auth-api.service';

export const authGuard: CanActivateFn = () => {
  const authApi = inject(AuthApiService);
  const router = inject(Router);

  return authApi.me().pipe(
    map(() => true),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};

export const guestGuard: CanActivateFn = () => {
  const authApi = inject(AuthApiService);
  const router = inject(Router);

  return authApi.me().pipe(
    map(() => router.createUrlTree(['/home'])),
    catchError(() => of(true)),
  );
};
