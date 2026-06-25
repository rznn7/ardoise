import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  authApi,
  type BeginLoginResponse,
  type BeginRegistrationRequest,
  type BeginRegistrationResponse,
  type CompleteLoginRequest,
  type CompleteRegistrationRequest,
  type MeResponse,
} from '@ardoise/shared';
import { type Observable } from 'rxjs';
import { createApiClient } from 'src/app/shared/api-client';
import { API_BASE_URL } from 'src/app/shared/api-config';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly api = createApiClient(authApi, {
    http: inject(HttpClient),
    baseUrl: inject(API_BASE_URL),
  });

  registerBegin(body: BeginRegistrationRequest): Observable<BeginRegistrationResponse> {
    return this.api.registerBegin({ body });
  }

  registerComplete(body: CompleteRegistrationRequest): Observable<void> {
    return this.api.registerComplete({ body });
  }

  loginBegin(): Observable<BeginLoginResponse> {
    return this.api.loginBegin();
  }

  loginComplete(body: CompleteLoginRequest): Observable<void> {
    return this.api.loginComplete({ body });
  }

  logout(): Observable<void> {
    return this.api.logout();
  }

  me(): Observable<MeResponse> {
    return this.api.me();
  }
}
