const olderDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const daysBetween = (from: Date, to: Date): number =>
  Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);

const ago = (iso: string, now: Date): string => {
  const date = new Date(iso);
  const days = daysBetween(date, now);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${String(days)} days ago`;
  return olderDay.format(date);
};

export const shortDate = (iso: string): string => olderDay.format(new Date(iso));

export function signedInLabel(lastSignInAt: string | null, createdAt: string, now: Date): string {
  return lastSignInAt === null
    ? `joined ${ago(createdAt, now)}`
    : `signed in ${ago(lastSignInAt, now)}`;
}

export function expiresIn(iso: string, now: Date): string {
  const days = daysBetween(now, new Date(iso));
  if (days <= 0) return 'expires today';
  if (days === 1) return 'expires tomorrow';
  return `expires in ${String(days)} days`;
}

export function groupsLabel(count: number): string {
  if (count === 0) return 'No group';
  return count === 1 ? '1 group' : `${String(count)} groups`;
}
