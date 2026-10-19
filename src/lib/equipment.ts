/**
 * Formatting helpers shared by the dashboard equipment screens and the public
 * UnitPass page. Dates in the database are `date` columns (no time zone), so
 * they are always formatted in UTC to avoid an off-by-one-day shift.
 */
export function formatDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

export function formatTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
}

/** Today as `YYYY-MM-DD` in UTC — comparable with the database `date` values. */
export function todayIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export type WarrantyInfo = {
  /** Human-readable status, e.g. "Active · expires 12 Mar 2027". */
  label: string;
  tone: 'active' | 'expired' | 'unknown';
  expiresOn: string | null;
};

export function describeWarranty(
  expirationDate: string | null | undefined,
  now: Date = new Date()
): WarrantyInfo {
  if (!expirationDate) {
    return { label: 'Not recorded', tone: 'unknown', expiresOn: null };
  }

  const formatted = formatDateOnly(expirationDate) ?? expirationDate;
  const today = todayIsoDate(now);

  if (expirationDate < today) {
    return { label: `Expired on ${formatted}`, tone: 'expired', expiresOn: formatted };
  }
  return { label: `Active · expires ${formatted}`, tone: 'active', expiresOn: formatted };
}

/** "3 months overdue" / "Due in 12 days" style helper for service dates. */
export function describeServiceDate(value: string | null | undefined, now: Date = new Date()): string | null {
  if (!value) return null;
  const formatted = formatDateOnly(value) ?? value;
  const target = new Date(`${value}T00:00:00Z`).getTime();
  if (Number.isNaN(target)) return formatted;

  const today = new Date(`${todayIsoDate(now)}T00:00:00Z`).getTime();
  const days = Math.round((target - today) / 86_400_000);

  if (days === 0) return `Due today (${formatted})`;
  if (days > 0) return `Due in ${days} ${days === 1 ? 'day' : 'days'} (${formatted})`;
  const overdue = Math.abs(days);
  return `Overdue by ${overdue} ${overdue === 1 ? 'day' : 'days'} (${formatted})`;
}
