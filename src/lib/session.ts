import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { CompanyRow, Membership, SessionUser } from '@/lib/types';

const COMPANY_COLUMNS =
  'id, name, logo_url, contact_name, phone, email, website, address, default_service_interval, created_at, updated_at';

/**
 * Next.js signals control flow (dynamic rendering, redirect, notFound) by
 * throwing errors with a `digest`. Those must never be swallowed by our
 * "treat failures as signed out" handling.
 */
function isNextControlFlowError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === 'string' &&
    (digest === 'DYNAMIC_SERVER_USAGE' || digest === 'NEXT_NOT_FOUND' || digest.startsWith('NEXT_REDIRECT'))
  );
}

/**
 * Reads the signed-in user from the request cookies.
 * Returns null when there is no valid session (or when Supabase is unreachable).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const supabase = getSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      // "Auth session missing" is a normal signed-out state, not an incident.
      if (error.name !== 'AuthSessionMissingError') {
        console.error('[session] Failed to read the Supabase session:', error.message);
      }
      return null;
    }
    if (!user) return null;

    return { id: user.id, email: user.email ?? null };
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;
    console.error('[session] Failed to read the Supabase session:', error);
    return null;
  }
}

/** Server-side auth gate for pages and server actions. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/auth/sign-in');
  return user;
}

/**
 * Resolves the caller's company from `company_members`, which is the single
 * source of truth for tenancy. `profiles.company_id` is only a convenience
 * pointer and is never used for authorization.
 */
export async function getUserMembership(userId: string): Promise<Membership | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('company_members')
    .select(`company_id, role, companies (${COMPANY_COLUMNS})`)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[session] Failed to load company membership:', error.message);
    return null;
  }
  if (!data) return null;

  const company = (data as { companies: CompanyRow | CompanyRow[] | null }).companies;
  const companyRow = Array.isArray(company) ? company[0] : company;
  if (!companyRow) return null;

  return {
    companyId: data.company_id as string,
    role: data.role as Membership['role'],
    company: companyRow,
  };
}

/** Auth + tenancy gate for pages that require a company. */
export async function requireCompany(): Promise<Membership> {
  const user = await requireUser();
  const membership = await getUserMembership(user.id);
  if (!membership) redirect('/dashboard/setup-company');
  return membership;
}
