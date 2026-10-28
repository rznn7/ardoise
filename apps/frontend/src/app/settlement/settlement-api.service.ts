import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type CreateSettlementBody, OP_ID_HEADER, settlementApi } from '@ardoise/shared';
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
  create = (body: CreateSettlementBody, opId: string) =>
    this.settlements.create({ body, headers: { [OP_ID_HEADER]: opId } });
  delete = (id: number, opId: string) =>
    this.settlements.delete({ params: { id }, headers: { [OP_ID_HEADER]: opId } });
}
