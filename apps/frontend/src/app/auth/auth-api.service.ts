import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  type BeginLoginResponse,
  type BeginRegistrationRequest,
  type BeginRegistrationResponse,
  type CompleteLoginRequest,
  type CompleteRegistrationRequest,
} from '@ardoise/shared';
import { type Observable } from 'rxjs';

const AUTH_ENDPOINT = '/api/auth';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);

  registerBegin(body: BeginRegistrationRequest): Observable<BeginRegistrationResponse> {
    return this.http.post<BeginRegistrationResponse>(`${AUTH_ENDPOINT}/register/begin`, body);
  }

  registerComplete(body: CompleteRegistrationRequest): Observable<void> {
    return this.http.post<void>(`${AUTH_ENDPOINT}/register/complete`, body);
  }

  loginBegin(): Observable<BeginLoginResponse> {
    return this.http.post<BeginLoginResponse>(`${AUTH_ENDPOINT}/login/begin`, {});
  }

  loginComplete(body: CompleteLoginRequest): Observable<void> {
    return this.http.post<void>(`${AUTH_ENDPOINT}/login/complete`, body);
  }
}
