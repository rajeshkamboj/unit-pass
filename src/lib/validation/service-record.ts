import { z } from 'zod';
import { todayIsoDate } from '@/lib/equipment';
import { addDaysIso, isIsoDate } from '@/lib/services/next-service-date';
import { SERVICE_TYPES } from '@/lib/types';

const MAX_TECHNICIAN = 120;
const MAX_PUBLIC_NOTES = 2000;
const MAX_PRIVATE_NOTES = 4000;

function normalizeOptionalText(value: unknown): unknown {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value.trim() : value;
}

const optionalText = (maxLength: number, message: string) =>
  z
    .preprocess(normalizeOptionalText, z.string().max(maxLength, message))
    .transform((value) => (value === '' ? null : value));

const requiredDate = z.preprocess(
  normalizeOptionalText,
  z
    .string()
    .min(1, 'Service date is required.')
    .superRefine((value, ctx) => {
      if (!isIsoDate(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid date (YYYY-MM-DD).' });
      }
    })
);

const optionalDate = z
  .preprocess(normalizeOptionalText, z.string().max(10, 'Enter a valid date.'))
  .superRefine((value, ctx) => {
    if (value === '') return;
    if (!isIsoDate(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid date (YYYY-MM-DD).' });
    }
  })
  .transform((value) => (value === '' ? null : value));

/**
 * Optional interval override used by the Mark Serviced dialog. Empty means
 * "use the equipment interval, then the company default".
 */
export const serviceIntervalField = z
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
        message: 'Interval must be a whole number of months between 1 and 60.',
      });
    }
  })
  .transform((value) => (value === '' ? null : (value as number)));

/**
 * Server-side validation for service log entries.
 *
 * `company_id` and `equipment_id` are deliberately absent: the equipment is
 * chosen by the route/action and the database resolves the tenant from it. A
 * form can never set either identifier.
 */
export const serviceRecordSchema = z
  .object({
    service_date: requiredDate,
    service_type: z.enum(SERVICE_TYPES, {
      errorMap: () => ({ message: 'Choose a service type.' }),
    }),
    technician_name: optionalText(
      MAX_TECHNICIAN,
      `Technician name must be ${MAX_TECHNICIAN} characters or fewer.`
    ),
    public_notes: optionalText(
      MAX_PUBLIC_NOTES,
      `Public notes must be ${MAX_PUBLIC_NOTES} characters or fewer.`
    ),
    private_notes: optionalText(
      MAX_PRIVATE_NOTES,
      `Private notes must be ${MAX_PRIVATE_NOTES} characters or fewer.`
    ),
    next_service_date: optionalDate,
  })
  .superRefine((data, ctx) => {
    const latestAllowed = addDaysIso(todayIsoDate(), 1);
    if (data.service_date > latestAllowed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['service_date'],
        message: 'Service date cannot be more than 1 day in the future.',
      });
    }
    if (data.next_service_date && data.next_service_date < data.service_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['next_service_date'],
        message: 'Next service date cannot be before the service date.',
      });
    }
  });

export type ServiceRecordField = keyof z.infer<typeof serviceRecordSchema>;
export type ServiceRecordInput = z.infer<typeof serviceRecordSchema>;
export type ServiceIntervalValue = z.infer<typeof serviceIntervalField>;
