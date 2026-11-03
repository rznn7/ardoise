const dateFormats = new Map<string, Intl.DateTimeFormat>();
const numberFormats = new Map<string, Intl.NumberFormat>();

export function dateFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  const cached = dateFormats.get(key);
  if (cached !== undefined) return cached;
  const created = new Intl.DateTimeFormat(locale, options);
  dateFormats.set(key, created);
  return created;
}

export function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  const cached = numberFormats.get(key);
  if (cached !== undefined) return cached;
  const created = new Intl.NumberFormat(locale, options);
  numberFormats.set(key, created);
  return created;
}
