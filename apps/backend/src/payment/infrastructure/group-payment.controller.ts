import { paymentApi, type PaymentResponse } from '@ardoise/shared';
import { Controller, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ListGroupPaymentsUseCase } from 'src/payment/application/list-group-payments.use-case';
import { toPaymentResponse } from 'src/payment/infrastructure/payment.mapper';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { CurrentUser } from 'src/shared/http/current-user.decorator';
import { type SessionUser } from 'src/shared/http/express';
import { Route } from 'src/shared/http/route.decorator';

@Controller()
@UseGuards(SessionGuard)
export class GroupPaymentController {
  constructor(private readonly listGroupPayments: ListGroupPaymentsUseCase) {}

  @Route(paymentApi.listByGroup)
  async list(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() user: SessionUser,
  ): Promise<PaymentResponse[]> {
    const payments = await this.listGroupPayments.execute({
      userId: user.id,
      groupId,
    });
    return payments.map(toPaymentResponse);
  }
}
