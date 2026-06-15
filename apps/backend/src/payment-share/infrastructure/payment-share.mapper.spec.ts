import { describe, expect, it } from 'vitest';

import { toPaymentShareResponse } from './payment-share.mapper';

describe('toPaymentShareResponse', () => {
  it('maps a domain payment share to its response contract', () => {
    expect(
      toPaymentShareResponse({
        paymentId: 9,
        memberId: 4,
        inputValue: 50,
        amount: 2100,
      }),
    ).toEqual({
      paymentId: 9,
      memberId: 4,
      inputValue: 50,
      amount: 2100,
    });
  });
});
