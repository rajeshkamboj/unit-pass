import { addDays, addMonths } from 'date-fns';

/**
 * Date-only arithmetic shared by every "next service" call site.
 *
 * Dates are stored as PostgreSQL `date` values (`YYYY-MM-DD`). They are parsed
 * into a local midnight Date and formatted back through the same local getters,
 * so DST transitions can never shift the calendar day. `date-fns` is the only
 * date library in the project (no second one may be added).
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_INTERVAL_MONTHS = 1;
const MAX_INTERVAL_MONTHS = 60;
export const FALLBACK_SERVICE_INTERVAL_MONTHS = 12;

function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

export function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** True only for a real calendar date in `YYYY-MM-DD` form. */
export function isIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null;
}

export function addDaysIso(value: string, days: number): string {
  const date = parseIsoDate(value);
  if (!date || !Number.isSafeInteger(days)) return value;
  return formatIsoDate(addDays(date, days));
}

export function addMonthsIso(value: string, months: number): string {
  const date = parseIsoDate(value);
  if (!date || !Number.isSafeInteger(months)) return value;
  return formatIsoDate(addMonths(date, months));
}

export function isValidServiceInterval(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_INTERVAL_MONTHS &&
    value <= MAX_INTERVAL_MONTHS
  );
}

/**
 * The interval actually used for a visit: the equipment override, else the
 * company default, else 12 months. Invalid values are ignored rather than
 * producing a nonsense date.
 */
export function resolveServiceInterval(
  equipmentInterval: number | null | undefined,
  companyDefaultInterval?: number | null
): number {
  if (isValidServiceInterval(equipmentInterval)) return equipmentInterval;
  if (isValidServiceInterval(companyDefaultInterval)) return companyDefaultInterval;
  return FALLBACK_SERVICE_INTERVAL_MONTHS;
}

/**
 * Single source of truth for the next visit:
 *   next = addMonths(service_date, equipment.service_interval ?? company.default_service_interval ?? 12)
 *
 * `date-fns` `addMonths` clamps month-end dates (31 Jan + 1 month = 28/29 Feb),
 * so a visit can never land on an invalid date. Phase 6 reminders must call this
 * helper instead of re-deriving the date.
 */
export function computeNextServiceDate(
  serviceDate: string,
  equipmentInterval: number | null | undefined,
  companyDefaultInterval?: number | null
): string {
  const months = resolveServiceInterval(equipmentInterval, companyDefaultInterval);
  return addMonthsIso(serviceDate, months);
}

/** Whole calendar days from `fromIso` to `toIso` (positive = future). */
export function daysBetweenIso(fromIso: string, toIso: string): number | null {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export type ServiceDueTone = 'overdue' | 'due' | 'upcoming';

export type ServiceDueStatus = {
  tone: ServiceDueTone;
  /** Short chip label: Overdue / Due today / Due in 8 days / Upcoming. */
  label: string;
  days: number | null;
};

/** Status chip shown on the services dashboard and the upcoming list. */
export function describeServiceDue(dateIso: string, todayIso: string): ServiceDueStatus {
  const days = daysBetweenIso(todayIso, dateIso);
  if (days === null) return { tone: 'upcoming', label: 'Upcoming', days: null };
  if (days < 0) return { tone: 'overdue', label: 'Overdue', days };
  if (days === 0) return { tone: 'due', label: 'Due today', days };
  if (days <= 30) {
    return { tone: 'due', label: `Due in ${days} ${days === 1 ? 'day' : 'days'}`, days };
  }
  return { tone: 'upcoming', label: 'Upcoming', days };
}
