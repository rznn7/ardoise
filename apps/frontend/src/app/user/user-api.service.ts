import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type RenameUserRequest, userApi } from '@ardoise/shared';
import { createApiClient } from 'src/app/shared/api-client';
import { API_BASE_URL } from 'src/app/shared/api-config';

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly api = createApiClient(userApi, {
    http: inject(HttpClient),
    baseUrl: inject(API_BASE_URL),
  });

  renameMe = (body: RenameUserRequest) => this.api.renameMe({ body });
}
