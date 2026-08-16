import { inject, Injectable } from '@angular/core';
import { switchMap } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';

import { InviteLinkApiService } from './invite-link-api.service';

@Injectable({ providedIn: 'root' })
export class AcceptInviteFlow {
  private readonly auth = inject(AuthService);
  private readonly inviteLinkApi = inject(InviteLinkApiService);

  joinLoggedIn(token: string) {
    return this.inviteLinkApi.consume(token);
  }

  loginThenJoin(token: string) {
    return this.auth.login().pipe(switchMap(() => this.inviteLinkApi.consume(token)));
  }

  registerThenJoin(token: string) {
    return this.auth.register(token);
  }
}
