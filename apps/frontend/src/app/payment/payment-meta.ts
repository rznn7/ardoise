import { type GroupMember, type PaymentResponse, type SplitType } from '@ardoise/shared';
import { marker } from '@jsverse/transloco-keys-manager/marker';
import { type TranslationKey, type Translator } from 'src/app/shared/i18n/translation-key';

import { shortDay } from './day-label';

export const SPLIT_LABEL_KEYS: Readonly<Record<SplitType, TranslationKey>> = {
  equal: marker('payment.split.equal'),
  shares: marker('payment.split.shares'),
  percent: marker('payment.split.percent'),
  exact: marker('payment.split.exact'),
};

export function paymentMeta(
  payment: Pick<PaymentResponse, 'payerMemberId' | 'paidAt' | 'splitType'>,
  members: readonly GroupMember[],
  meUserId: number,
  tr: Translator,
): string {
  const payer = members.find((member) => member.id === payment.payerMemberId);
  const name =
    payer?.userId === meUserId
      ? tr.translate(marker('payment.meta.you'))
      : (payer?.name ?? tr.translate(marker('payment.meta.someone')));
  return [
    tr.translate(marker('payment.meta.paidBy'), { name }),
    shortDay(payment.paidAt, tr.locale),
    tr.translate(SPLIT_LABEL_KEYS[payment.splitType]),
  ].join(' · ');
}
