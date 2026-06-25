import { paymentApi, type PaymentResponse } from '@ardoise/shared';
import {
  Controller,
  NotFoundException,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { FindPaymentUseCase } from 'src/payment/application/find-payment.use-case';
import { toPaymentResponse } from 'src/payment/infrastructure/payment.mapper';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { Route } from 'src/shared/http/route.decorator';

@Controller()
@UseGuards(SessionGuard)
export class PaymentController {
  constructor(private readonly findPayment: FindPaymentUseCase) {}

  @Route(paymentApi.findOne)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PaymentResponse> {
    const payment = await this.findPayment.execute(id);
    if (!payment) throw new NotFoundException();
    return toPaymentResponse(payment);
  }
}
