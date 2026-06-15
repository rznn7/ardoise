import { type PaymentShareResponse } from '@ardoise/shared';
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { FindPaymentSharesByPaymentUseCase } from 'src/payment-share/application/find-payment-shares-by-payment.use-case';
import { toPaymentShareResponse } from 'src/payment-share/infrastructure/payment-share.mapper';
import { SessionGuard } from 'src/session/infrastructure/session.guard';

@Controller('payment-shares')
@UseGuards(SessionGuard)
export class PaymentShareController {
  constructor(
    private readonly findByPayment: FindPaymentSharesByPaymentUseCase,
  ) {}

  @Get('by-payment/:paymentId')
  async findByPaymentRoute(
    @Param('paymentId', ParseIntPipe) paymentId: number,
  ): Promise<PaymentShareResponse[]> {
    const shares = await this.findByPayment.execute(paymentId);
    return shares.map(toPaymentShareResponse);
  }
}
