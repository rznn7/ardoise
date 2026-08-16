import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { expenseGroupApi } from '@ardoise/shared';
import { createApiClient } from 'src/app/shared/api-client';
import { API_BASE_URL } from 'src/app/shared/api-config';

@Injectable({ providedIn: 'root' })
export class ExpenseGroupApiService {
  private readonly api = createApiClient(expenseGroupApi, {
    http: inject(HttpClient),
    baseUrl: inject(API_BASE_URL),
  });

  listMine = this.api.listMine;
  findOne = this.api.findOne;
  create = this.api.create;
}
