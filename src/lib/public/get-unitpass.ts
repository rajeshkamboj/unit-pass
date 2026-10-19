import 'server-only';

import { cache } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicDocumentsSchema } from '@/lib/validation/document';
import { isIsoDate } from '@/lib/services/next-service-date';
import type { PublicUnitPass, ServiceHistoryEntry, ServiceType } from '@/lib/types';
import { EQUIPMENT_STATUSES, EQUIPMENT_TYPES, SERVICE_TYPES } from '@/lib/types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public token = UUIDv4 printed into a QR code. Anything that is not a UUID can
 * never identify a record, so it is rejected before touching the database.
 */
export function isUnitPassToken(value: string): boolean {
  return UUID_PATTERN.test(value);
}

let publicClient: SupabaseClient | null = null;

/**
 * Anonymous Supabase client for the public passport.
 *
 * No cookies and no session: the public page must never depend on (or leak) an
 * authenticated session. The only thing it may call is the whitelisting RPC.
 */
function getPublicClient(): SupabaseClient {
  if (publicClient) return publicClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'The public UnitPass page needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  publicClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { 'X-Client-Info': 'unitpass-public-passport' },
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
  return publicClient;
}

/** Keys that must never appear anywhere in the public payload (defence in depth). */
const FORBIDDEN_PUBLIC_KEYS = new Set([
  'id',
  'company_id',
  'customer_id',
  'equipment_id',
  'installer_notes',
  'installerNotes',
  'private_notes',
  'customer',
  'customers',
  'email_private',
  'archived_at',
  'public_token',
  'storage_path',
  'file_url',
  'file_name',
  'uploaded_by',
]);

/** The only keys a public service-history entry may contain. */
const SERVICE_HISTORY_KEYS = new Set<string>([
  'service_date',
  'service_type',
  'technician_name',
  'public_notes',
]);

/**
 * Validates the public history through an allow-list, not a deny-list.
 *
 * A missing key (page deployed before the Phase 4 migration) is treated as an
 * empty history so the passport keeps working. Anything malformed, oversized or
 * carrying an unexpected key fails closed: the page shows the error state
 * instead of leaking data.
 */
function normalizeServiceHistory(raw: unknown): ServiceHistoryEntry[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > 20) return null;

  const entries: ServiceHistoryEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const record = item as Record<string, unknown>;
    if (!Object.keys(record).every((key) => SERVICE_HISTORY_KEYS.has(key))) return null;

    const { service_date, service_type, technician_name, public_notes } = record;
    if (typeof service_date !== 'string' || !isIsoDate(service_date)) return null;
    if (typeof service_type !== 'string' || !SERVICE_TYPES.includes(service_type as ServiceType)) {
      return null;
    }
    if (technician_name !== null && typeof technician_name !== 'string') return null;
    if (public_notes !== null && typeof public_notes !== 'string') return null;

    entries.push({
      service_date,
      service_type: service_type as ServiceType,
      technician_name: technician_name as string | null,
      public_notes: public_notes as string | null,
    });
  }
  return entries;
}

function findForbiddenKey(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findForbiddenKey(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_PUBLIC_KEYS.has(key)) return key;
      const found = findForbiddenKey(child);
      if (found) return found;
    }
  }
  return null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isValidPublicUnitPass(value: unknown): value is PublicUnitPass {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  const company = payload.company as Record<string, unknown> | undefined;
  const equipment = payload.equipment as Record<string, unknown> | undefined;
  if (!company || !equipment) return false;
  if (!isNonEmptyString(company.name) || !isNonEmptyString(equipment.name)) return false;
  if (!EQUIPMENT_TYPES.includes(equipment.type as PublicUnitPass['equipment']['type'])) return false;
  if (!EQUIPMENT_STATUSES.includes(equipment.status as PublicUnitPass['equipment']['status'])) return false;
  if (!Array.isArray(payload.service_history)) return false;
  return true;
}

/**
 * Reads the public passport through `public.get_public_unitpass(uuid)`.
 *
 * Nothing here selects from `equipment`: the RPC returns an explicit whitelist,
 * so private columns never leave the database. Returns null for an unknown token
 * (the caller renders a generic 404). Wrapped in React `cache()` so
 * `generateMetadata` and the page share one round trip per request.
 */
export const getPublicUnitPass = cache(async (token: string): Promise<PublicUnitPass | null> => {
  if (!isUnitPassToken(token)) return null;

  const { data, error } = await getPublicClient().rpc('get_public_unitpass', { p_token: token });

  if (error) {
    console.error('[unitpass] Failed to load the public passport:', error.message);
    throw new Error('Unable to load this UnitPass right now.');
  }
  if (data === null || data === undefined) return null;

  // Strictly validate documents before exempting their ids from the recursive
  // internal-id guard. No other object is allowed to carry an id.
  const { documents: rawDocuments, ...basePayload } = data as Record<string, unknown>;
  const documents = publicDocumentsSchema.safeParse(rawDocuments ?? []);
  if (!documents.success) {
    console.error('[unitpass] Public documents did not match the whitelist.');
    throw new Error('Unable to load this UnitPass right now.');
  }
  const forbidden = findForbiddenKey(basePayload);
  if (forbidden) {
    // A regression in the SQL whitelist must fail closed, never leak.
    console.error(`[unitpass] Public payload contained a forbidden key: ${forbidden}`);
    throw new Error('Unable to load this UnitPass right now.');
  }

  const serviceHistory = normalizeServiceHistory((data as Record<string, unknown>).service_history);
  if (!serviceHistory) {
    console.error('[unitpass] Public service history did not match the expected shape.');
    throw new Error('Unable to load this UnitPass right now.');
  }

  const normalized: unknown = { ...basePayload, service_history: serviceHistory, documents: documents.data };
  if (!isValidPublicUnitPass(normalized)) {
    console.error('[unitpass] Public payload did not match the expected shape.');
    throw new Error('Unable to load this UnitPass right now.');
  }

  return normalized;
});
