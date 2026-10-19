'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCompany } from '@/lib/session';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { todayIsoDate } from '@/lib/equipment';
import {
  computeNextServiceDate,
  resolveServiceInterval,
} from '@/lib/services/next-service-date';
import {
  serviceIntervalField,
  serviceRecordSchema,
  type ServiceRecordField,
} from '@/lib/validation/service-record';

const uuidSchema = z.string().uuid();

export type ServiceActionField = ServiceRecordField | 'service_interval';

export type ServiceActionResult = {
  ok: boolean;
  recordId?: string;
  equipmentId?: string;
  /** The date the equipment schedule was rolled forward to (Mark Serviced). */
  nextServiceDate?: string;
  /** The interval used to compute it, in months. */
  intervalMonths?: number;
  /** A partial success the UI must show (for example, schedule update failed). */
  warning?: string;
  fieldErrors?: Partial<Record<ServiceActionField, string>>;
  error?: string;
};

function parseServiceForm(formData: FormData) {
  return serviceRecordSchema.safeParse({
    service_date: formData.get('service_date'),
    service_type: formData.get('service_type'),
    technician_name: formData.get('technician_name'),
    public_notes: formData.get('public_notes'),
    private_notes: formData.get('private_notes'),
    next_service_date: formData.get('next_service_date'),
  });
}

function fieldErrorsFrom(error: z.ZodError): Partial<Record<ServiceActionField, string>> {
  return Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).flatMap(([field, messages]) =>
      messages?.[0] ? [[field, messages[0]]] : []
    )
  ) as Partial<Record<ServiceActionField, string>>;
}

function revalidateServiceViews(equipmentId?: string) {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/services');
  revalidatePath('/dashboard/equipment');
  if (equipmentId) revalidatePath(`/dashboard/equipment/${equipmentId}`);
}

/**
 * Resolves an equipment row inside the caller's company. RLS is the backstop;
 * this also turns a forged id into a clean error instead of a silent no-op.
 */
async function equipmentInCompany(
  equipmentId: string,
  companyId: string
): Promise<{ id: string; service_interval: number | null } | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('equipment')
    .select('id, service_interval')
    .eq('id', equipmentId)
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) {
    console.error('[services] Failed to resolve equipment:', error.message);
    return null;
  }
  return (data as { id: string; service_interval: number | null } | null) ?? null;
}

/** Creates a service log entry from the equipment page. */
export async function createServiceRecord(
  equipmentId: string,
  formData: FormData
): Promise<ServiceActionResult> {
  const membership = await requireCompany();
  const parsedId = uuidSchema.safeParse(equipmentId);
  if (!parsedId.success) return { ok: false, error: 'Equipment not found.' };

  const parsed = parseServiceForm(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };

  const equipment = await equipmentInCompany(parsedId.data, membership.companyId);
  if (!equipment) return { ok: false, error: 'Equipment not found or you do not have access to it.' };

  const supabase = getSupabaseServerClient();
  // The database trigger resolves company_id from equipment; sending the
  // session value as well keeps the intent explicit and harmless.
  const { data, error } = await supabase
    .from('service_records')
    .insert({
      equipment_id: equipment.id,
      company_id: membership.companyId,
      ...parsed.data,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[services] Failed to create a service record:', error?.message ?? 'No row returned');
    return { ok: false, error: 'We could not save this service record. Please try again.' };
  }

  revalidateServiceViews(equipment.id);
  return { ok: true, recordId: data.id as string, equipmentId: equipment.id };
}

/** Edits an existing log entry. The equipment and tenant can never change. */
export async function updateServiceRecord(
  recordId: string,
  formData: FormData
): Promise<ServiceActionResult> {
  const membership = await requireCompany();
  const parsedId = uuidSchema.safeParse(recordId);
  if (!parsedId.success) return { ok: false, error: 'Service record not found.' };

  const parsed = parseServiceForm(formData);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = getSupabaseServerClient();
  const { data: existing, error: lookupError } = await supabase
    .from('service_records')
    .select('id, equipment_id')
    .eq('id', parsedId.data)
    .eq('company_id', membership.companyId)
    .maybeSingle();

  if (lookupError) {
    console.error('[services] Failed to load the service record:', lookupError.message);
    return { ok: false, error: 'We could not save this service record. Please try again.' };
  }
  if (!existing) return { ok: false, error: 'Service record not found or you do not have access to it.' };

  const { data, error } = await supabase
    .from('service_records')
    .update(parsed.data)
    .eq('id', parsedId.data)
    .eq('company_id', membership.companyId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[services] Failed to update the service record:', error.message);
    return { ok: false, error: 'We could not save this service record. Please try again.' };
  }
  if (!data) return { ok: false, error: 'Service record not found or you do not have access to it.' };

  const equipmentId = (existing as { equipment_id: string }).equipment_id;
  revalidateServiceViews(equipmentId);
  return { ok: true, recordId: data.id as string, equipmentId };
}

/**
 * Deletes one log entry (explicit confirmation in the UI). This is the only
 * destructive action in the phase and it never touches equipment/customer rows.
 */
export async function deleteServiceRecord(recordId: string): Promise<ServiceActionResult> {
  const membership = await requireCompany();
  const parsedId = uuidSchema.safeParse(recordId);
  if (!parsedId.success) return { ok: false, error: 'Service record not found.' };

  const supabase = getSupabaseServerClient();
  const { data: existing, error: lookupError } = await supabase
    .from('service_records')
    .select('id, equipment_id')
    .eq('id', parsedId.data)
    .eq('company_id', membership.companyId)
    .maybeSingle();

  if (lookupError) {
    console.error('[services] Failed to load the service record:', lookupError.message);
    return { ok: false, error: 'We could not delete this service record. Please try again.' };
  }
  if (!existing) return { ok: false, error: 'Service record not found or you do not have access to it.' };

  const { error } = await supabase
    .from('service_records')
    .delete()
    .eq('id', parsedId.data)
    .eq('company_id', membership.companyId);

  if (error) {
    console.error('[services] Failed to delete the service record:', error.message);
    return { ok: false, error: 'We could not delete this service record. Please try again.' };
  }

  const equipmentId = (existing as { equipment_id: string }).equipment_id;
  revalidateServiceViews(equipmentId);
  return { ok: true, recordId: parsedId.data, equipmentId };
}

/**
 * Mark Serviced: logs today's Maintenance visit (or a customized one) and rolls
 * `equipment.next_service_date` forward by the resolved interval.
 *
 * Phase 6 derives reminders from `next_service_date`; Phase 7 will wrap this
 * single action in plan checks. Keep it as the one write path for "serviced".
 */
export async function markEquipmentServiced(
  equipmentId: string,
  formData?: FormData
): Promise<ServiceActionResult> {
  const membership = await requireCompany();
  const parsedId = uuidSchema.safeParse(equipmentId);
  if (!parsedId.success) return { ok: false, error: 'Equipment not found.' };

  const equipment = await equipmentInCompany(parsedId.data, membership.companyId);
  if (!equipment) return { ok: false, error: 'Equipment not found or you do not have access to it.' };

  const form = formData ?? new FormData();

  // The default path is one click: today, Maintenance, existing interval.
  const parsed = serviceRecordSchema.safeParse({
    service_date: form.get('service_date') || todayIsoDate(),
    service_type: form.get('service_type') || 'Maintenance',
    technician_name: form.get('technician_name'),
    public_notes: form.get('public_notes'),
    private_notes: form.get('private_notes'),
    next_service_date: null,
  });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };

  const parsedInterval = serviceIntervalField.safeParse(form.get('service_interval') ?? '');
  if (!parsedInterval.success) {
    return {
      ok: false,
      fieldErrors: { service_interval: parsedInterval.error.flatten().formErrors[0] ?? 'Enter a valid interval.' },
    };
  }

  const intervalMonths = resolveServiceInterval(
    parsedInterval.data ?? equipment.service_interval,
    membership.company.default_service_interval
  );
  const nextServiceDate = computeNextServiceDate(
    parsed.data.service_date,
    intervalMonths,
    membership.company.default_service_interval
  );

  const supabase = getSupabaseServerClient();
  const { data: record, error: insertError } = await supabase
    .from('service_records')
    .insert({
      equipment_id: equipment.id,
      company_id: membership.companyId,
      ...parsed.data,
      next_service_date: nextServiceDate,
    })
    .select('id')
    .single();

  if (insertError || !record) {
    console.error('[services] Failed to log the service visit:', insertError?.message ?? 'No row returned');
    return { ok: false, error: 'We could not log this service visit. Please try again.' };
  }

  const { data: updated, error: updateError } = await supabase
    .from('equipment')
    .update({ next_service_date: nextServiceDate })
    .eq('id', equipment.id)
    .eq('company_id', membership.companyId)
    .select('id')
    .maybeSingle();

  revalidateServiceViews(equipment.id);

  if (updateError || !updated) {
    console.error(
      '[services] Service logged but the equipment schedule was not updated:',
      updateError?.message ?? 'No equipment row updated'
    );
    return {
      ok: true,
      recordId: record.id as string,
      equipmentId: equipment.id,
      nextServiceDate,
      intervalMonths,
      warning:
        'The visit was logged, but the equipment next-service date could not be updated. Set it from the equipment page.',
    };
  }

  return {
    ok: true,
    recordId: record.id as string,
    equipmentId: equipment.id,
    nextServiceDate,
    intervalMonths,
  };
}
