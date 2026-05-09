import { inject, Injectable } from '@angular/core';
import { AuthApiService } from './auth-api.service';
import {
  startRegistration,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  startAuthentication,
} from '@simplewebauthn/browser';
import { from, map, Observable, switchMap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApiService);

  register(inviteToken: string): Observable<void> {
    return this.authApi.registerBegin({ inviteToken }).pipe(
      switchMap(({ registrationState, options }) =>
        from(
          startRegistration({ optionsJSON: options as PublicKeyCredentialCreationOptionsJSON }),
        ).pipe(map((attestation) => ({ attestation, registrationState }))),
      ),
      switchMap(({ attestation, registrationState }) =>
        this.authApi.registerComplete({ registrationState, attestation }),
      ),
    );
  }

  login(): Observable<void> {
    return this.authApi.loginBegin().pipe(
      switchMap(({ loginState, options }) =>
        from(
          startAuthentication({ optionsJSON: options as PublicKeyCredentialRequestOptionsJSON }),
        ).pipe(map((assertion) => ({ loginState, assertion }))),
      ),
      switchMap(({ loginState, assertion }) =>
        this.authApi.loginComplete({ loginState, assertion: assertion as { id: string } }),
      ),
    );
  }
}
