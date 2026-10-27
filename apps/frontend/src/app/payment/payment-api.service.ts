import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  type CreatePaymentBody,
  paymentApi,
  paymentShareApi,
  type UpdatePaymentBody,
} from '@ardoise/shared';
import { createApiClient } from 'src/app/shared/api-client';
import { API_BASE_URL } from 'src/app/shared/api-config';

@Injectable({ providedIn: 'root' })
export class PaymentApiService {
  private readonly config = { http: inject(HttpClient), baseUrl: inject(API_BASE_URL) };
  private readonly payments = createApiClient(paymentApi, this.config);
  private readonly shares = createApiClient(paymentShareApi, this.config);

  findOne = (id: number) => this.payments.findOne({ params: { id } });
  sharesOf = (paymentId: number) => this.shares.findByPayment({ params: { paymentId } });
  create = (body: CreatePaymentBody) => this.payments.create({ body });
  update = (id: number, body: UpdatePaymentBody) => this.payments.update({ params: { id }, body });
  delete = (id: number) => this.payments.delete({ params: { id } });
}
