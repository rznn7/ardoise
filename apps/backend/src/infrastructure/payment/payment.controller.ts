import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { FindPaymentUseCase } from 'src/application/payment/find-payment.use-case';

@Controller('payments')
export class PaymentController {
  constructor(private readonly findPayment: FindPaymentUseCase) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.findPayment.execute(id);
  }
}
