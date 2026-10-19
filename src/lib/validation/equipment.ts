import { z } from 'zod';
import { EQUIPMENT_STATUSES, EQUIPMENT_TYPES } from '@/lib/types';

const MAX_NAME = 120;

function normalizeOptionalText(value: unknown): unknown {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value.trim() : value;
}

const requiredName = (label: string, maxLength = MAX_NAME) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z
      .string()
      .min(1, `${label} is required.`)
      .max(maxLength, `${label} must be ${maxLength} characters or fewer.`)
  );

const optionalText = (maxLength: number) =>
  z
    .preprocess(normalizeOptionalText, z.string().max(maxLength, `Use ${maxLength} characters or fewer.`))
    .transform((value) => (value === '' ? null : value));

/** Accepts only a real calendar date in `YYYY-MM-DD` form (what `<input type="date">` sends). */
function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const optionalDate = z
  .preprocess(normalizeOptionalText, z.string().max(10, 'Enter a valid date.'))
  .superRefine((value, ctx) => {
    if (value === '') return;
    if (!isRealIsoDate(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid date (YYYY-MM-DD).' });
    }
  })
  .transform((value) => (value === '' ? null : value));

const optionalInterval = z
  .preprocess((value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    return value;
  }, z.union([z.literal(''), z.coerce.number()]))
  .superRefine((value, ctx) => {
    if (value === '') return;
    if (!Number.isInteger(value) || value < 1 || value > 60) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Service interval must be a whole number of months between 1 and 60.',
      });
    }
  })
  .transform((value) => (value === '' ? null : (value as number)));

/**
 * Server-side validation for equipment create/edit forms.
 *
 * Tenant identifiers are derived from the session and are NOT part of this
 * schema: `company_id` is never accepted from the browser. `customer_id` is
 * validated against the caller's company inside the Server Action (RLS and a
 * database trigger are the backstop).
 */
export const equipmentSchema = z.object({
  customer_id: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z
      .string({ required_error: 'Choose a customer.' })
      .min(1, 'Choose a customer.')
      .uuid('Choose a customer.')
  ),
  equipment_name: requiredName('Equipment name'),
  equipment_type: z.enum(EQUIPMENT_TYPES, {
    errorMap: () => ({ message: 'Choose an equipment type.' }),
  }),
  manufacturer: optionalText(MAX_NAME),
  model_number: optionalText(MAX_NAME),
  serial_number: optionalText(MAX_NAME),
  installation_date: optionalDate,
  warranty_expiration_date: optionalDate,
  warranty_notes: optionalText(2000),
  next_service_date: optionalDate,
  service_interval: optionalInterval,
  installer_notes: optionalText(4000),
  public_notes: optionalText(2000),
  status: z.enum(EQUIPMENT_STATUSES, {
    errorMap: () => ({ message: 'Choose a status.' }),
  }),
});

export type EquipmentInput = z.infer<typeof equipmentSchema>;
export type EquipmentField = keyof EquipmentInput;
