import { marker } from '@jsverse/transloco-keys-manager/marker';
import { dateFormat } from 'src/app/shared/i18n/intl-cache';
import { type Translator } from 'src/app/shared/i18n/translation-key';

const OLDER_DAY: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const shortDay = (iso: string, locale: string): string =>
  dateFormat(locale, OLDER_DAY).format(new Date(iso));

export function dayLabel(date: Date, today: Date, tr: Translator): string {
  if (isSameDay(date, today)) return tr.translate(marker('common.today'));
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, yesterday)) return tr.translate(marker('common.yesterday'));
  return dateFormat(tr.locale, OLDER_DAY).format(date);
}
