import 'server-only';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { todayIsoDate } from '@/lib/equipment';
import { addDaysIso, describeServiceDue, type ServiceDueStatus } from '@/lib/services/next-service-date';
import { serviceWindowRange, type ServiceWindow } from '@/lib/services/service-windows';
import type {
  ServiceOpportunityRow,
  ServiceRecordRow,
} from '@/lib/types';

/**
 * Shared, tenant-scoped reads for the Services screen and the dashboard.
 *
 * Every query is scoped by `company_id` **and** protected by RLS. "Service
 * opportunities" are equipment with a non-null `next_service_date`; replaced
 * units are excluded unless the caller explicitly opts in. The date windows are
 * inclusive calendar-day windows: next N days = [today, today + N].
 */

const OPPORTUNITY_COLUMNS =
  'id, customer_id, equipment_name, equipment_type, next_service_date, status, service_interval, customers (first_name, last_name, phone, email)';

export type ServiceOpportunitiesResult = {
  rows: ServiceOpportunityRow[];
  total: number;
  error: boolean;
};

/** Equipment due in one window, newest urgency first (oldest date first). */
export async function getServiceOpportunities(
  companyId: string,
  window: ServiceWindow,
  options: { includeReplaced?: boolean; limit?: number } = {}
): Promise<ServiceOpportunitiesResult> {
  const supabase = getSupabaseServerClient();
  const today = todayIsoDate();

  let query = supabase
    .from('equipment')
    .select(OPPORTUNITY_COLUMNS, { count: 'exact' })
    .eq('company_id', companyId)
    .not('next_service_date', 'is', null);

  if (!options.includeReplaced) {
    query = query.neq('status', 'Replaced');
  }

  if (window === 'overdue') {
    query = query.lt('next_service_date', today);
  } else {
    const range = serviceWindowRange(window, today);
    if (range) {
      query = query.gte('next_service_date', range.from).lte('next_service_date', range.to);
    }
  }

  const limit = options.limit ?? 200;
  const { data, error, count } = await query
    .order('next_service_date', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[services] Failed to load service opportunities:', error.message);
    return { rows: [], total: 0, error: true };
  }

  return {
    rows: (data ?? []) as unknown as ServiceOpportunityRow[],
    total: count ?? 0,
    error: false,
  };
}

export type ServiceSummary = {
  totalCustomers: number | null;
  totalEquipment: number | null;
  dueSoon: number | null;
  overdue: number | null;
  failed: boolean;
};

/**
 * Numbers for the Services screen and the main dashboard. Counts are computed
 * by the database (head requests) with the same predicates as the list queries.
 */
export async function getServiceSummary(companyId: string): Promise<ServiceSummary> {
  const supabase = getSupabaseServerClient();
  const today = todayIsoDate();
  const dueSoonEnd = addDaysIso(today, 30);

  const [customers, equipment, dueSoon, overdue] = await Promise.all([
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .is('archived_at', null),
    supabase
      .from('equipment')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'Active'),
    supabase
      .from('equipment')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .neq('status', 'Replaced')
      .not('next_service_date', 'is', null)
      .gte('next_service_date', today)
      .lte('next_service_date', dueSoonEnd),
    supabase
      .from('equipment')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .neq('status', 'Replaced')
      .not('next_service_date', 'is', null)
      .lt('next_service_date', today),
  ]);

  const errors = [customers.error, equipment.error, dueSoon.error, overdue.error].filter(Boolean);
  errors.forEach((error) => console.error('[services] Failed to load summary:', error?.message));

  return {
    totalCustomers: customers.error ? null : (customers.count ?? 0),
    totalEquipment: equipment.error ? null : (equipment.count ?? 0),
    dueSoon: dueSoon.error ? null : (dueSoon.count ?? 0),
    overdue: overdue.error ? null : (overdue.count ?? 0),
    failed: errors.length > 0,
  };
}

export type UpcomingService = {
  id: string;
  customer_id: string;
  equipment_name: string;
  equipment_type: string;
  next_service_date: string;
  customers: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
};

/** The next `limit` scheduled visits (today or later, replaced units excluded). */
export async function getUpcomingServices(
  companyId: string,
  limit = 5
): Promise<{ rows: UpcomingService[]; error: boolean }> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('equipment')
    .select('id, customer_id, equipment_name, equipment_type, next_service_date, customers (first_name, last_name)')
    .eq('company_id', companyId)
    .neq('status', 'Replaced')
    .not('next_service_date', 'is', null)
    .gte('next_service_date', todayIsoDate())
    .order('next_service_date', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[services] Failed to load upcoming services:', error.message);
    return { rows: [], error: true };
  }
  return { rows: (data ?? []) as unknown as UpcomingService[], error: false };
}

/** Earliest scheduled date for the empty-state hint, or null. */
export async function getNextUpcomingServiceDate(companyId: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('equipment')
    .select('next_service_date')
    .eq('company_id', companyId)
    .neq('status', 'Replaced')
    .not('next_service_date', 'is', null)
    .gte('next_service_date', todayIsoDate())
    .order('next_service_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[services] Failed to load the next service date:', error.message);
    return null;
  }
  return (data as { next_service_date: string } | null)?.next_service_date ?? null;
}

/** Service timeline for one equipment record (authenticated dashboard only). */
export async function getServiceHistory(
  equipmentId: string,
  companyId: string,
  limit = 100
): Promise<{ rows: ServiceRecordRow[]; error: boolean }> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('service_records')
    .select(
      'id, equipment_id, company_id, service_date, service_type, technician_name, public_notes, private_notes, next_service_date, created_at, updated_at'
    )
    .eq('equipment_id', equipmentId)
    .eq('company_id', companyId)
    .order('service_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[services] Failed to load the service history:', error.message);
    return { rows: [], error: true };
  }
  return { rows: (data ?? []) as ServiceRecordRow[], error: false };
}

/** Re-exported so pages can build chips from one helper. */
export function serviceDueFor(
  dateIso: string,
  todayIso: string = todayIsoDate()
): ServiceDueStatus {
  return describeServiceDue(dateIso, todayIso);
}
