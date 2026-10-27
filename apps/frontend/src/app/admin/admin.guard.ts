import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const home = router.createUrlTree(['/home']);

  return auth.currentUser().pipe(
    map((me) => (me.role === 'admin' ? true : home)),
    catchError(() => of(home)),
  );
};
