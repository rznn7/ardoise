import { inject, Injectable } from '@angular/core';
import {
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { from, map, type Observable, switchMap } from 'rxjs';

import { AuthApiService } from './auth-api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApiService);

  register(inviteToken: string): Observable<void> {
    return this.authApi.registerBegin({ inviteToken }).pipe(
      switchMap(({ stateId, options }) =>
        from(
          startRegistration({ optionsJSON: options as PublicKeyCredentialCreationOptionsJSON }),
        ).pipe(map((attestation) => ({ attestation, stateId }))),
      ),
      switchMap(({ attestation, stateId }) =>
        this.authApi.registerComplete({ stateId, attestation }),
      ),
    );
  }

  logout(): Observable<void> {
    return this.authApi.logout();
  }

  login(): Observable<void> {
    return this.authApi.loginBegin().pipe(
      switchMap(({ stateId, options }) =>
        from(
          startAuthentication({ optionsJSON: options as PublicKeyCredentialRequestOptionsJSON }),
        ).pipe(map((assertion) => ({ stateId, assertion }))),
      ),
      switchMap(({ stateId, assertion }) =>
        this.authApi.loginComplete({ stateId, assertion: assertion as { id: string } }),
      ),
    );
  }
}
