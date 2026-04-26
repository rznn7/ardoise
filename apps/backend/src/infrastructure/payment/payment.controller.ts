import { Controller, Get, Inject, Param, ParseIntPipe } from '@nestjs/common';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepository,
} from 'src/domain/payment/payment-repository';

@Controller('payments')
export class PaymentController {
  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepository,
  ) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.payments.findById(id);
  }
}
