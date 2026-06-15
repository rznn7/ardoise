import { type PaymentResponse } from '@ardoise/shared';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { FindPaymentUseCase } from 'src/payment/application/find-payment.use-case';
import { toPaymentResponse } from 'src/payment/infrastructure/payment.mapper';
import { SessionGuard } from 'src/session/infrastructure/session.guard';

@Controller('payments')
@UseGuards(SessionGuard)
export class PaymentController {
  constructor(private readonly findPayment: FindPaymentUseCase) {}

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PaymentResponse> {
    const payment = await this.findPayment.execute(id);
    if (!payment) throw new NotFoundException();
    return toPaymentResponse(payment);
  }
}
