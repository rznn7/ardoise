import { type AdminGroup } from '@ardoise/shared';
import { marker } from '@jsverse/transloco-keys-manager/marker';
import { dateFormat, numberFormat } from 'src/app/shared/i18n/intl-cache';
import { type Translator } from 'src/app/shared/i18n/translation-key';

const OLDER_DAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const daysBetween = (from: Date, to: Date): number =>
  Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);

const ago = (iso: string, now: Date, tr: Translator): string => {
  const date = new Date(iso);
  const days = daysBetween(date, now);
  if (days <= 0) return tr.translate(marker('admin.dates.today'));
  if (days === 1) return tr.translate(marker('admin.dates.yesterday'));
  if (days < 7) return tr.translate(marker('admin.dates.daysAgo'), { count: days });
  return tr.translate(marker('admin.dates.onDate'), { date: shortDate(iso, tr.locale) });
};

export const shortDate = (iso: string, locale: string): string =>
  dateFormat(locale, OLDER_DAY).format(new Date(iso));

export function signedInLabel(
  lastSignInAt: string | null,
  createdAt: string,
  now: Date,
  tr: Translator,
): string {
  return lastSignInAt === null
    ? tr.translate(marker('admin.dates.joined'), { when: ago(createdAt, now, tr) })
    : tr.translate(marker('admin.dates.signedIn'), { when: ago(lastSignInAt, now, tr) });
}

export function expiresIn(iso: string, now: Date, tr: Translator): string {
  const days = daysBetween(now, new Date(iso));
  if (days <= 0) return tr.translate(marker('admin.dates.expiresToday'));
  if (days === 1) return tr.translate(marker('admin.dates.expiresTomorrow'));
  return tr.translate(marker('admin.dates.expiresInDays'), { count: days });
}

export function groupsLabel(count: number, tr: Translator): string {
  return tr.translate(marker('admin.dates.groups'), { count });
}

export function groupMeta(group: AdminGroup['group'], tr: Translator): string {
  const spent = numberFormat(tr.locale, {
    style: 'currency',
    currency: group.currencyCode,
  }).format(group.totalSpent / 100);
  return tr.translate(marker('admin.dates.groupMeta'), {
    currency: group.currencyCode,
    date: shortDate(group.createdAt, tr.locale),
    payments: tr.translate(marker('admin.dates.payments'), { count: group.paymentCount }),
    spent,
  });
}
