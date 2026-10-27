import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { adminApi } from '@ardoise/shared';
import { createApiClient } from 'src/app/shared/api-client';
import { API_BASE_URL } from 'src/app/shared/api-config';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly admin = createApiClient(adminApi, {
    http: inject(HttpClient),
    baseUrl: inject(API_BASE_URL),
  });

  overview = () => this.admin.overview();
  user = (userId: number) => this.admin.user({ params: { userId } });
  group = (groupId: number) => this.admin.group({ params: { groupId } });
  revokeInviteLink = (id: number) => this.admin.revokeInviteLink({ params: { id } });
  revokeSession = (id: number) => this.admin.revokeSession({ params: { id } });
}
