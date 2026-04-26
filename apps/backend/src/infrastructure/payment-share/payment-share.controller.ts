import { Controller, Get, Inject, Param, ParseIntPipe } from '@nestjs/common';
import {
  PAYMENT_SHARE_REPOSITORY,
  type PaymentShareRepository,
} from 'src/domain/payment-share/payment-share-repository';

@Controller('payment-shares')
export class PaymentShareController {
  constructor(
    @Inject(PAYMENT_SHARE_REPOSITORY)
    private readonly paymentShares: PaymentShareRepository,
  ) {}

  @Get('by-payment/:paymentId')
  findByPayment(@Param('paymentId', ParseIntPipe) paymentId: number) {
    return this.paymentShares.findByPayment(paymentId);
  }
}
