import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { FindPaymentSharesByPaymentUseCase } from 'src/application/payment-share/find-payment-shares-by-payment.use-case';

@Controller('payment-shares')
export class PaymentShareController {
  constructor(
    private readonly findByPayment: FindPaymentSharesByPaymentUseCase,
  ) {}

  @Get('by-payment/:paymentId')
  findByPaymentRoute(@Param('paymentId', ParseIntPipe) paymentId: number) {
    return this.findByPayment.execute(paymentId);
  }
}
