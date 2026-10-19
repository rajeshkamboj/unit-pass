import { z } from 'zod';

function normalizeOptionalText(value: unknown): unknown {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value.trim() : value;
}

const optionalText = (maxLength: number) =>
  z.preprocess(
    normalizeOptionalText,
    z.string().max(maxLength, `Use ${maxLength} characters or fewer.`)
  ).transform((value) => (value === '' ? null : value));

const optionalEmail = z
  .preprocess(
    normalizeOptionalText,
    z.union([
      z.literal(''),
      z.string().max(254, 'Email must be 254 characters or fewer.').email('Enter a valid email address.'),
    ])
  )
  .transform((value) => (value === '' ? null : value));

function isHttpUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const optionalHttpUrl = z
  .preprocess(
    normalizeOptionalText,
    z
      .string()
      .max(2048, 'URL must be 2048 characters or fewer.')
      .refine(isHttpUrl, 'Enter a complete http:// or https:// URL.')
  )
  .transform((value) => (value === '' ? null : value));

const serviceInterval = z.preprocess(
  (value) => {
    if (value === null || value === undefined) return 12;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? 12 : Number(trimmed);
    }
    return value;
  },
  z
    .number({ invalid_type_error: 'Enter a whole number from 1 to 60.' })
    .int('Enter a whole number from 1 to 60.')
    .min(1, 'Service interval must be at least 1 month.')
    .max(60, 'Service interval must be 60 months or fewer.')
);

export const companyProfileSchema = z.object({
  name: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string().min(1, 'Company name is required.').max(150, 'Company name must be 150 characters or fewer.')
  ),
  contact_name: optionalText(120),
  phone: optionalText(50),
  email: optionalEmail,
  website: optionalHttpUrl,
  address: optionalText(300),
  service_booking_url: optionalHttpUrl,
  default_service_interval: serviceInterval,
});

export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;
export type CompanyProfileField = keyof CompanyProfileInput;
