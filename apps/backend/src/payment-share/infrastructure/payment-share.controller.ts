import { paymentShareApi, type PaymentShareResponse } from '@ardoise/shared';
import { Controller, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { FindPaymentSharesByPaymentUseCase } from 'src/payment-share/application/find-payment-shares-by-payment.use-case';
import { toPaymentShareResponse } from 'src/payment-share/infrastructure/payment-share.mapper';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { CurrentUser } from 'src/shared/http/current-user.decorator';
import { type SessionUser } from 'src/shared/http/express';
import { Route } from 'src/shared/http/route.decorator';

@Controller()
@UseGuards(SessionGuard)
export class PaymentShareController {
  constructor(
    private readonly findByPayment: FindPaymentSharesByPaymentUseCase,
  ) {}

  @Route(paymentShareApi.findByPayment)
  async findByPaymentRoute(
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @CurrentUser() user: SessionUser,
  ): Promise<PaymentShareResponse[]> {
    const shares = await this.findByPayment.execute({
      userId: user.id,
      paymentId,
    });
    return shares.map(toPaymentShareResponse);
  }
}
