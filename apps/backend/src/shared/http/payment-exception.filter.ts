import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { InvalidSplit } from 'src/payment/domain/compute-payment-shares';
import {
  ParticipantNotInGroup,
  PayerNotInGroup,
} from 'src/payment/domain/payment';

@Catch(PayerNotInGroup, ParticipantNotInGroup, InvalidSplit)
export class PaymentExceptionFilter implements ExceptionFilter<Error> {
  catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    const error =
      exception instanceof InvalidSplit
        ? exception.code
        : exception instanceof PayerNotInGroup
          ? 'PAYER_NOT_IN_GROUP'
          : 'PARTICIPANT_NOT_IN_GROUP';

    response.status(400).json({ error });
  }
}
