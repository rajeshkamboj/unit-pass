import { z } from 'zod';

function normalizeOptionalText(value: unknown): unknown {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value.trim() : value;
}

const requiredName = (label: string) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z
      .string()
      .min(1, `${label} is required.`)
      .max(100, `${label} must be 100 characters or fewer.`)
  );

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

/**
 * Server-side validation for customer create/edit forms. Tenant identifiers and
 * archive state are deliberately absent: actions derive those from the session.
 */
export const customerSchema = z.object({
  first_name: requiredName('First name'),
  last_name: requiredName('Last name'),
  email: optionalEmail,
  phone: optionalText(80),
  address: optionalText(300),
  city: optionalText(120),
  state: optionalText(120),
  postal_code: optionalText(30),
  country: optionalText(120),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type CustomerField = keyof CustomerInput;
