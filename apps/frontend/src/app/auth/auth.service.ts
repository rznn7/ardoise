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
  of,
  shareReplay,
  Subject,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { UserApiService } from 'src/app/user/user-api.service';

import { AuthApiService } from './auth-api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApiService);
  private readonly userApi = inject(UserApiService);
  private readonly signedOutSubject = new Subject<void>();
  private cachedUser: Observable<MeResponse> | null = null;

  readonly signedOut: Observable<void> = this.signedOutSubject.asObservable();

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

  register(inviteToken: string, name?: string): Observable<void> {
    return this.authApi.registerBegin({ inviteToken }).pipe(
      switchMap(({ stateId, options }) =>
        from(
          startRegistration({ optionsJSON: options as PublicKeyCredentialCreationOptionsJSON }),
        ).pipe(map((attestation) => ({ attestation, stateId }))),
      ),
      switchMap(({ attestation, stateId }) =>
        this.authApi.registerComplete({ stateId, attestation, name }),
      ),
      tap(() => {
        this.forgetUser();
      }),
    );
  }

  rename(name: string): Observable<MeResponse> {
    return this.userApi.renameMe({ name }).pipe(
      tap((user) => {
        this.cachedUser = of(user);
      }),
    );
  }

  logout(): Observable<void> {
    return this.authApi.logout().pipe(
      tap(() => {
        this.forgetUser();
        this.signedOutSubject.next();
      }),
    );
  }

  revalidate(): Observable<MeResponse> {
    this.forgetUser();
    return this.currentUser();
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
