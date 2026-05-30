import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { FindPaymentSharesByPaymentUseCase } from 'src/payment-share/application/find-payment-shares-by-payment.use-case';
import { SessionGuard } from 'src/session/infrastructure/session.guard';

@Controller('payment-shares')
@UseGuards(SessionGuard)
export class PaymentShareController {
  constructor(
    private readonly findByPayment: FindPaymentSharesByPaymentUseCase,
  ) {}

  @Get('by-payment/:paymentId')
  findByPaymentRoute(@Param('paymentId', ParseIntPipe) paymentId: number) {
    return this.findByPayment.execute(paymentId);
  }
}
