'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCompany } from '@/lib/session';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { equipmentSchema, type EquipmentField } from '@/lib/validation/equipment';
import { EQUIPMENT_STATUSES, type EquipmentStatus } from '@/lib/types';

export type EquipmentActionResult = {
  ok: boolean;
  equipmentId?: string;
  fieldErrors?: Partial<Record<EquipmentField, string>>;
  error?: string;
};

const equipmentIdSchema = z.string().uuid();
const equipmentStatusSchema = z.enum(EQUIPMENT_STATUSES);

function parseEquipmentForm(formData: FormData) {
  return equipmentSchema.safeParse({
    customer_id: formData.get('customer_id'),
    equipment_name: formData.get('equipment_name'),
    equipment_type: formData.get('equipment_type'),
    manufacturer: formData.get('manufacturer'),
    model_number: formData.get('model_number'),
    serial_number: formData.get('serial_number'),
    installation_date: formData.get('installation_date'),
    warranty_expiration_date: formData.get('warranty_expiration_date'),
    warranty_notes: formData.get('warranty_notes'),
    next_service_date: formData.get('next_service_date'),
    service_interval: formData.get('service_interval'),
    installer_notes: formData.get('installer_notes'),
    public_notes: formData.get('public_notes'),
    status: formData.get('status') ?? 'Active',
  });
}

function fieldErrorsFrom(error: z.ZodError): Partial<Record<EquipmentField, string>> {
  return Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).flatMap(([field, messages]) =>
      messages?.[0] ? [[field, messages[0]]] : []
    )
  ) as Partial<Record<EquipmentField, string>>;
}

function revalidateEquipmentViews(equipmentId?: string) {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/equipment');
  if (equipmentId) {
    revalidatePath(`/dashboard/equipment/${equipmentId}`);
    revalidatePath(`/dashboard/equipment/${equipmentId}/qr`);
  }
}

/**
 * Verifies that the chosen customer belongs to the caller's company before the
 * write, so a forged `customer_id` fails with a readable form error. RLS and the
 * `equipment_customer_same_company` trigger remain the database backstop.
 */
async function customerBelongsToCompany(
  customerId: string,
  companyId: string
): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) {
    console.error('[equipment] Failed to verify the customer:', error.message);
    return 'We could not verify that customer. Please try again.';
  }
  if (!data) {
    return 'Choose a customer that belongs to your company.';
  }
  return null;
}

export async function createEquipment(formData: FormData): Promise<EquipmentActionResult> {
  const membership = await requireCompany();
  const parsed = parseEquipmentForm(formData);

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const customerError = await customerBelongsToCompany(parsed.data.customer_id, membership.companyId);
  if (customerError) {
    return { ok: false, fieldErrors: { customer_id: customerError } };
  }

  const supabase = getSupabaseServerClient();
  // `company_id` comes from the session, never from the form.
  const { data, error } = await supabase
    .from('equipment')
    .insert({ ...parsed.data, company_id: membership.companyId })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[equipment] Failed to create equipment:', error?.message ?? 'No row returned');
    return { ok: false, error: 'We could not save this equipment. Please try again.' };
  }

  revalidateEquipmentViews(data.id);
  return { ok: true, equipmentId: data.id };
}

export async function updateEquipment(
  equipmentId: string,
  formData: FormData
): Promise<EquipmentActionResult> {
  const membership = await requireCompany();
  const parsedId = equipmentIdSchema.safeParse(equipmentId);
  if (!parsedId.success) return { ok: false, error: 'Equipment not found.' };

  const parsed = parseEquipmentForm(formData);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const customerError = await customerBelongsToCompany(parsed.data.customer_id, membership.companyId);
  if (customerError) {
    return { ok: false, fieldErrors: { customer_id: customerError } };
  }

  const supabase = getSupabaseServerClient();
  // `public_token` is deliberately absent: the database refuses to change it.
  const { data, error } = await supabase
    .from('equipment')
    .update(parsed.data)
    .eq('id', parsedId.data)
    .eq('company_id', membership.companyId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[equipment] Failed to update equipment:', error.message);
    return { ok: false, error: 'We could not save this equipment. Please try again.' };
  }
  if (!data) return { ok: false, error: 'Equipment not found or you do not have access to it.' };

  revalidateEquipmentViews(data.id);
  return { ok: true, equipmentId: data.id };
}

/**
 * Retires (or restores) equipment by changing its status. There is no delete:
 * the public token — and therefore every printed QR code — stays valid forever.
 */
export async function setEquipmentStatus(
  equipmentId: string,
  status: EquipmentStatus
): Promise<EquipmentActionResult> {
  const membership = await requireCompany();
  const parsedId = equipmentIdSchema.safeParse(equipmentId);
  const parsedStatus = equipmentStatusSchema.safeParse(status);
  if (!parsedId.success) return { ok: false, error: 'Equipment not found.' };
  if (!parsedStatus.success) return { ok: false, error: 'Choose a valid status.' };

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('equipment')
    .update({ status: parsedStatus.data })
    .eq('id', parsedId.data)
    .eq('company_id', membership.companyId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[equipment] Failed to change equipment status:', error.message);
    return { ok: false, error: 'We could not update this equipment. Please try again.' };
  }
  if (!data) return { ok: false, error: 'Equipment not found or you do not have access to it.' };

  revalidateEquipmentViews(data.id);
  return { ok: true, equipmentId: data.id };
}
