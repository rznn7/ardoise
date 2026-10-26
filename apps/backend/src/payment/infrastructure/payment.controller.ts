import {
  type CreatePaymentRequest,
  type CreatePaymentResponse,
  paymentApi,
  type PaymentResponse,
  type UpdatePaymentRequest,
} from '@ardoise/shared';
import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { CreatePaymentUseCase } from 'src/payment/application/create-payment.use-case';
import { DeletePaymentUseCase } from 'src/payment/application/delete-payment.use-case';
import { FindPaymentUseCase } from 'src/payment/application/find-payment.use-case';
import { UpdatePaymentUseCase } from 'src/payment/application/update-payment.use-case';
import { toPaymentResponse } from 'src/payment/infrastructure/payment.mapper';
import { toPaymentShareResponse } from 'src/payment-share/infrastructure/payment-share.mapper';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { CurrentUser } from 'src/shared/http/current-user.decorator';
import { type SessionUser } from 'src/shared/http/express';
import { Route } from 'src/shared/http/route.decorator';
import { ZodValidationPipe } from 'src/shared/http/zod-validation.pipe';

@Controller()
@UseGuards(SessionGuard)
export class PaymentController {
  constructor(
    private readonly findPayment: FindPaymentUseCase,
    private readonly createPayment: CreatePaymentUseCase,
    private readonly updatePayment: UpdatePaymentUseCase,
    private readonly deletePayment: DeletePaymentUseCase,
  ) {}

  @Route(paymentApi.findOne)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ): Promise<PaymentResponse> {
    const payment = await this.findPayment.execute({
      userId: user.id,
      paymentId: id,
    });
    return toPaymentResponse(payment);
  }

  @Route(paymentApi.create)
  async create(
    @Body(new ZodValidationPipe(paymentApi.create.body))
    body: CreatePaymentRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<CreatePaymentResponse> {
    const { payment, shares } = await this.createPayment.execute({
      ...body,
      userId: user.id,
    });

    return {
      payment: toPaymentResponse(payment),
      shares: shares.map(toPaymentShareResponse),
    };
  }

  @Route(paymentApi.update)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(paymentApi.update.body))
    body: UpdatePaymentRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<CreatePaymentResponse> {
    const { payment, shares } = await this.updatePayment.execute({
      ...body,
      paymentId: id,
      userId: user.id,
    });

    return {
      payment: toPaymentResponse(payment),
      shares: shares.map(toPaymentShareResponse),
    };
  }

  @Route(paymentApi.delete)
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.deletePayment.execute({ userId: user.id, paymentId: id });
  }
}
