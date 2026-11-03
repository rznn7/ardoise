import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  type CreatePaymentBody,
  OP_ID_HEADER,
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
  create = (body: CreatePaymentBody, opId: string) =>
    this.payments.create({ body, headers: { [OP_ID_HEADER]: opId } });
  update = (id: number, body: UpdatePaymentBody, opId: string) =>
    this.payments.update({ params: { id }, body, headers: { [OP_ID_HEADER]: opId } });
  delete = (id: number, opId: string) =>
    this.payments.delete({ params: { id }, headers: { [OP_ID_HEADER]: opId } });
}
