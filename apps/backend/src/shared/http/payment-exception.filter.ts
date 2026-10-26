import { InvalidSplit } from '@ardoise/shared';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import {
  ParticipantNotInGroup,
  PayerNotInGroup,
  PaymentNotFound,
} from 'src/payment/domain/payment';

@Catch(PayerNotInGroup, ParticipantNotInGroup, InvalidSplit, PaymentNotFound)
export class PaymentExceptionFilter implements ExceptionFilter<Error> {
  catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof PaymentNotFound) {
      response.status(404).json({ error: 'PAYMENT_NOT_FOUND' });
      return;
    }

    const error =
      exception instanceof InvalidSplit
        ? exception.code
        : exception instanceof PayerNotInGroup
          ? 'PAYER_NOT_IN_GROUP'
          : 'PARTICIPANT_NOT_IN_GROUP';

    response.status(400).json({ error });
  }
}
