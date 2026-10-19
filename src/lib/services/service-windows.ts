import { addDaysIso } from '@/lib/services/next-service-date';

/**
 * The service tracking windows exposed in the UI. Pure date logic (no server
 * imports) so the same definitions are testable outside Next.js.
 *
 * Windows are inclusive calendar-day ranges: next N days = [today, today + N].
 */
export const SERVICE_WINDOWS = ['next7', 'next30', 'next60', 'overdue', 'all'] as const;
export type ServiceWindow = (typeof SERVICE_WINDOWS)[number];
export const DEFAULT_SERVICE_WINDOW: ServiceWindow = 'next30';

export const SERVICE_WINDOW_META: Record<ServiceWindow, { label: string; days: number | null }> = {
  next7: { label: 'Next 7 days', days: 7 },
  next30: { label: 'Next 30 days', days: 30 },
  next60: { label: 'Next 60 days', days: 60 },
  overdue: { label: 'Overdue', days: null },
  all: { label: 'All scheduled', days: null },
};

export function resolveServiceWindow(value: string | string[] | undefined): ServiceWindow {
  const candidate = typeof value === 'string' ? value : '';
  return SERVICE_WINDOWS.includes(candidate as ServiceWindow)
    ? (candidate as ServiceWindow)
    : DEFAULT_SERVICE_WINDOW;
}

/** The inclusive future-date range for a window, or null for overdue/all. */
export function serviceWindowRange(
  window: ServiceWindow,
  today: string
): { from: string; to: string } | null {
  const days = SERVICE_WINDOW_META[window].days;
  if (days === null) return null;
  return { from: today, to: addDaysIso(today, days) };
}
