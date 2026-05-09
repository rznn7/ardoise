import { HttpClient } from '@angular/common/http';
import {
  BeginLoginResponse,
  BeginRegistrationRequest,
  BeginRegistrationResponse,
  CompleteLoginRequest,
  CompleteRegistrationRequest,
} from '@ardoise/shared';
import { Observable } from 'rxjs';
import { inject, Injectable } from '@angular/core';

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
