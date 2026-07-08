import { inject, Injectable } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';

import { InviteLinkApiService } from './invite-link-api.service';

export class AcceptInviteStepError extends Error {
  constructor(
    public readonly step: 'login' | 'consume',
    public readonly stepError: unknown,
  ) {
    super(`Accept invite failed at step: ${step}`);
  }
}

@Injectable({ providedIn: 'root' })
export class AcceptInviteFlow {
  private readonly auth = inject(AuthService);
  private readonly inviteLinkApi = inject(InviteLinkApiService);

  joinLoggedIn(token: string) {
    return this.inviteLinkApi.consume(token);
  }

  loginThenJoin(token: string) {
    return this.auth
      .login()
      .pipe(
        switchMap(() =>
          this.inviteLinkApi
            .consume(token)
            .pipe(
              catchError((error: unknown) =>
                throwError(() => new AcceptInviteStepError('consume', error)),
              ),
            ),
        ),
      );
  }

  registerThenJoin(token: string) {
    return this.auth.register(token);
  }
}
