import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import {
  InvalidSettlement,
  NotInvolvedInSettlement,
  SettlementMemberNotInGroup,
  SettlementNotFound,
} from 'src/settlement/domain/settlement';

@Catch(
  InvalidSettlement,
  SettlementMemberNotInGroup,
  NotInvolvedInSettlement,
  SettlementNotFound,
)
export class SettlementExceptionFilter implements ExceptionFilter<Error> {
  catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof SettlementNotFound) {
      response.status(404).json({ error: 'SETTLEMENT_NOT_FOUND' });
    } else if (exception instanceof NotInvolvedInSettlement) {
      response.status(403).json({ error: 'NOT_INVOLVED_IN_SETTLEMENT' });
    } else if (exception instanceof SettlementMemberNotInGroup) {
      response.status(400).json({ error: 'SETTLEMENT_MEMBER_NOT_IN_GROUP' });
    } else {
      response.status(400).json({ error: 'INVALID_SETTLEMENT' });
    }
  }
}
