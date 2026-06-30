import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { inviteLinkApi } from '@ardoise/shared';
import { createApiClient } from 'src/app/shared/api-client';
import { API_BASE_URL } from 'src/app/shared/api-config';

@Injectable({ providedIn: 'root' })
export class InviteLinkApiService {
  private readonly api = createApiClient(inviteLinkApi, {
    http: inject(HttpClient),
    baseUrl: inject(API_BASE_URL),
  });

  create = this.api.create;
}
