import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { memberApi } from '@ardoise/shared';
import { createApiClient } from 'src/app/shared/api-client';
import { API_BASE_URL } from 'src/app/shared/api-config';

@Injectable({ providedIn: 'root' })
export class MemberApiService {
  private readonly api = createApiClient(memberApi, {
    http: inject(HttpClient),
    baseUrl: inject(API_BASE_URL),
  });

  listByGroup = (groupId: number) => this.api.listByGroup({ params: { groupId } });
}
