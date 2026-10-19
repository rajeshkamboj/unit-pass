'use server';

import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getUserMembership, requireUser } from '@/lib/session';

export type CompanySetupState = { error: string | null };

const MAX_INTERVAL_MONTHS = 60;

/**
 * Creates the caller's company and their membership atomically through the
 * `create_company_with_owner` Postgres function (SECURITY DEFINER).
 *
 * The browser never sends a company id: the function derives ownership from the
 * authenticated session, so this action cannot be used to join or create a
 * company on someone else's behalf.
 */
export async function createCompany(_prevState: CompanySetupState, formData: FormData): Promise<CompanySetupState> {
  const user = await requireUser();

  const existing = await getUserMembership(user.id);
  if (existing) redirect('/dashboard');

  const name = stringField(formData, 'name');
  const contactName = stringField(formData, 'contactName');
  const phone = stringField(formData, 'phone');
  const email = stringField(formData, 'email');
  const website = stringField(formData, 'website');
  const address = stringField(formData, 'address');
  const intervalRaw = stringField(formData, 'defaultServiceInterval');

  if (!name) return { error: 'Company name is required.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.' };

  let defaultServiceInterval = 12;
  if (intervalRaw) {
    const parsed = Number.parseInt(intervalRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_INTERVAL_MONTHS) {
      return { error: `Default service interval must be between 1 and ${MAX_INTERVAL_MONTHS} months.` };
    }
    defaultServiceInterval = parsed;
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.rpc('create_company_with_owner', {
    p_name: name,
    p_contact_name: contactName,
    p_phone: phone,
    p_email: email,
    p_website: website,
    p_address: address,
    p_default_service_interval: defaultServiceInterval,
  });

  if (error) {
    console.error('[setup-company] create_company_with_owner failed:', error.message);
    return { error: 'We could not create your company. Please try again.' };
  }

  redirect('/dashboard');
}

function stringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}
