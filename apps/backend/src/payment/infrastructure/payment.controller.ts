import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { FindPaymentUseCase } from 'src/payment/application/find-payment.use-case';
import { SessionGuard } from 'src/session/infrastructure/session.guard';

@Controller('payments')
@UseGuards(SessionGuard)
export class PaymentController {
  constructor(private readonly findPayment: FindPaymentUseCase) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.findPayment.execute(id);
  }
}
