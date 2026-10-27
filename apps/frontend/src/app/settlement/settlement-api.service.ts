import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type CreateSettlementBody, settlementApi } from '@ardoise/shared';
import { createApiClient } from 'src/app/shared/api-client';
import { API_BASE_URL } from 'src/app/shared/api-config';

@Injectable({ providedIn: 'root' })
export class SettlementApiService {
  private readonly settlements = createApiClient(settlementApi, {
    http: inject(HttpClient),
    baseUrl: inject(API_BASE_URL),
  });

  listByGroup = (groupId: number, cursor?: string) =>
    this.settlements.listByGroup({ params: { groupId }, query: { cursor } });
  findOne = (id: number) => this.settlements.findOne({ params: { id } });
  create = (body: CreateSettlementBody) => this.settlements.create({ body });
  delete = (id: number) => this.settlements.delete({ params: { id } });
}
