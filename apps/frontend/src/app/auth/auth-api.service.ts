import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  authApi,
  type BeginRegistrationRequest,
  type CompleteLoginRequest,
  type CompleteRegistrationRequest,
} from '@ardoise/shared';
import { createApiClient } from 'src/app/shared/api-client';
import { API_BASE_URL } from 'src/app/shared/api-config';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly api = createApiClient(authApi, {
    http: inject(HttpClient),
    baseUrl: inject(API_BASE_URL),
  });

  registerBegin = (body: BeginRegistrationRequest) => this.api.registerBegin({ body });
  registerComplete = (body: CompleteRegistrationRequest) => this.api.registerComplete({ body });
  loginBegin = this.api.loginBegin;
  loginComplete = (body: CompleteLoginRequest) => this.api.loginComplete({ body });
  logout = this.api.logout;
  me = this.api.me;
}
