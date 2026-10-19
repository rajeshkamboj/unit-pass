'use server';

import { revalidatePath } from 'next/cache';
import { requireCompany } from '@/lib/session';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { companyProfileSchema, type CompanyProfileField } from '@/lib/validation/company';

export type CompanyProfileActionResult = {
  ok: boolean;
  fieldErrors?: Partial<Record<CompanyProfileField, string>>;
  error?: string;
};

export async function updateCompanyProfile(formData: FormData): Promise<CompanyProfileActionResult> {
  const membership = await requireCompany();

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return { ok: false, error: 'Only a company owner or admin can update the company profile.' };
  }

  const parsed = companyProfileSchema.safeParse({
    name: formData.get('name'),
    contact_name: formData.get('contact_name'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    website: formData.get('website'),
    address: formData.get('address'),
    service_booking_url: formData.get('service_booking_url'),
    default_service_interval: formData.get('default_service_interval'),
  });

  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(
      Object.entries(parsed.error.flatten().fieldErrors).flatMap(([field, messages]) =>
        messages?.[0] ? [[field, messages[0]]] : []
      )
    ) as Partial<Record<CompanyProfileField, string>>;
    return { ok: false, fieldErrors };
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('companies')
    .update(parsed.data)
    .eq('id', membership.companyId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[settings] Failed to update company profile:', error.message);
    return { ok: false, error: 'We could not save your company profile. Please try again.' };
  }
  if (!data) {
    return { ok: false, error: 'Your company profile could not be updated. Check your access and try again.' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings');

  return { ok: true };
}
