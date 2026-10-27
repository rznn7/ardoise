import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { feedApi } from '@ardoise/shared';
import { createApiClient } from 'src/app/shared/api-client';
import { API_BASE_URL } from 'src/app/shared/api-config';

@Injectable({ providedIn: 'root' })
export class FeedApiService {
  private readonly feed = createApiClient(feedApi, {
    http: inject(HttpClient),
    baseUrl: inject(API_BASE_URL),
  });

  listByGroup = (groupId: number) => this.feed.listByGroup({ params: { groupId } });
}
