import { inject, Injectable } from '@angular/core';
import { type MeResponse } from '@ardoise/shared';
import {
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import {
  catchError,
  defer,
  from,
  map,
  type Observable,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';

import { AuthApiService } from './auth-api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApiService);
  private cachedUser: Observable<MeResponse> | null = null;

  currentUser(): Observable<MeResponse> {
    this.cachedUser ??= defer(() => this.authApi.me()).pipe(
      catchError((error: unknown) => {
        this.cachedUser = null;
        return throwError(() => error);
      }),
      shareReplay(1),
    );
    return this.cachedUser;
  }

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
      tap(() => {
        this.forgetUser();
      }),
    );
  }

  logout(): Observable<void> {
    return this.authApi.logout().pipe(
      tap(() => {
        this.forgetUser();
      }),
    );
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
      tap(() => {
        this.forgetUser();
      }),
    );
  }

  private forgetUser(): void {
    this.cachedUser = null;
  }
}
