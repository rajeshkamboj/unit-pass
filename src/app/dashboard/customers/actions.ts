'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCompany } from '@/lib/session';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { customerSchema, type CustomerField } from '@/lib/validation/customer';

export type CustomerActionResult = {
  ok: boolean;
  customerId?: string;
  fieldErrors?: Partial<Record<CustomerField, string>>;
  error?: string;
};

const customerIdSchema = z.string().uuid();

function parseCustomerForm(formData: FormData) {
  return customerSchema.safeParse({
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    city: formData.get('city'),
    state: formData.get('state'),
    postal_code: formData.get('postal_code'),
    country: formData.get('country'),
  });
}

function fieldErrorsFrom(error: z.ZodError): Partial<Record<CustomerField, string>> {
  return Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).flatMap(([field, messages]) =>
      messages?.[0] ? [[field, messages[0]]] : []
    )
  ) as Partial<Record<CustomerField, string>>;
}

function revalidateCustomerViews(customerId?: string) {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/customers');
  if (customerId) revalidatePath(`/dashboard/customers/${customerId}`);
}

export async function createCustomer(formData: FormData): Promise<CustomerActionResult> {
  const membership = await requireCompany();
  const parsed = parseCustomerForm(formData);

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('customers')
    .insert({ ...parsed.data, company_id: membership.companyId })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[customers] Failed to create customer:', error?.message ?? 'No row returned');
    return { ok: false, error: 'We could not save this customer. Please try again.' };
  }

  revalidateCustomerViews(data.id);
  return { ok: true, customerId: data.id };
}

export async function updateCustomer(customerId: string, formData: FormData): Promise<CustomerActionResult> {
  const membership = await requireCompany();
  const parsedId = customerIdSchema.safeParse(customerId);
  if (!parsedId.success) return { ok: false, error: 'Customer not found.' };

  const parsed = parseCustomerForm(formData);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('customers')
    .update(parsed.data)
    .eq('id', parsedId.data)
    .eq('company_id', membership.companyId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[customers] Failed to update customer:', error.message);
    return { ok: false, error: 'We could not save this customer. Please try again.' };
  }
  if (!data) return { ok: false, error: 'Customer not found or you do not have access to it.' };

  revalidateCustomerViews(data.id);
  return { ok: true, customerId: data.id };
}

export async function archiveCustomer(customerId: string): Promise<CustomerActionResult> {
  return setCustomerArchived(customerId, true);
}

export async function unarchiveCustomer(customerId: string): Promise<CustomerActionResult> {
  return setCustomerArchived(customerId, false);
}

async function setCustomerArchived(customerId: string, archived: boolean): Promise<CustomerActionResult> {
  const membership = await requireCompany();
  const parsedId = customerIdSchema.safeParse(customerId);
  if (!parsedId.success) return { ok: false, error: 'Customer not found.' };

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('customers')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', parsedId.data)
    .eq('company_id', membership.companyId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error(`[customers] Failed to ${archived ? 'archive' : 'unarchive'} customer:`, error.message);
    return { ok: false, error: 'We could not update this customer. Please try again.' };
  }
  if (!data) return { ok: false, error: 'Customer not found or you do not have access to it.' };

  revalidateCustomerViews(data.id);
  return { ok: true, customerId: data.id };
}
