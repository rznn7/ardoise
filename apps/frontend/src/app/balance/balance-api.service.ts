import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { balanceApi } from '@ardoise/shared';
import { createApiClient } from 'src/app/shared/api-client';
import { API_BASE_URL } from 'src/app/shared/api-config';

@Injectable({ providedIn: 'root' })
export class BalanceApiService {
  private readonly balances = createApiClient(balanceApi, {
    http: inject(HttpClient),
    baseUrl: inject(API_BASE_URL),
  });

  listByGroup = (groupId: number) => this.balances.listByGroup({ params: { groupId } });
  listMine = () => this.balances.listMine();
}
