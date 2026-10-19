'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CustomerFormRow } from '@/lib/types';
import type { CustomerField } from '@/lib/validation/customer';
import { createCustomer, updateCustomer, type CustomerActionResult } from './actions';

type CustomerFormProps = {
  customer?: CustomerFormRow;
};

const FIELD_LABELS: Record<CustomerField, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  email: 'Email',
  phone: 'Phone',
  address: 'Street address',
  city: 'City',
  state: 'State / province',
  postal_code: 'Postal code',
  country: 'Country',
};

export function CustomerForm({ customer }: CustomerFormProps) {
  const [result, setResult] = useState<CustomerActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const fieldErrors = result?.fieldErrors ?? {};
  const isEditing = Boolean(customer);
  const cancelHref = customer ? `/dashboard/customers/${customer.id}` : '/dashboard/customers';

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setResult(null);

    startTransition(async () => {
      try {
        const nextResult = customer
          ? await updateCustomer(customer.id, formData)
          : await createCustomer(formData);
        setResult(nextResult);

        if (nextResult.ok && nextResult.customerId) {
          router.push(`/dashboard/customers/${nextResult.customerId}`);
          router.refresh();
        }
      } catch {
        setResult({ ok: false, error: 'We could not save this customer. Please try again.' });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6" aria-busy={pending}>
      {result?.error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {result.error}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="customer-first-name"
          name="first_name"
          label={FIELD_LABELS.first_name}
          required
          maxLength={100}
          autoComplete="given-name"
          defaultValue={customer?.first_name ?? ''}
          error={fieldErrors.first_name}
        />
        <TextField
          id="customer-last-name"
          name="last_name"
          label={FIELD_LABELS.last_name}
          required
          maxLength={100}
          autoComplete="family-name"
          defaultValue={customer?.last_name ?? ''}
          error={fieldErrors.last_name}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="customer-email"
          name="email"
          label={FIELD_LABELS.email}
          type="email"
          maxLength={254}
          autoComplete="email"
          defaultValue={customer?.email ?? ''}
          error={fieldErrors.email}
        />
        <TextField
          id="customer-phone"
          name="phone"
          label={FIELD_LABELS.phone}
          type="tel"
          maxLength={80}
          autoComplete="tel"
          defaultValue={customer?.phone ?? ''}
          error={fieldErrors.phone}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customer-address">{FIELD_LABELS.address}</Label>
        <Textarea
          id="customer-address"
          name="address"
          maxLength={300}
          autoComplete="street-address"
          defaultValue={customer?.address ?? ''}
          aria-invalid={Boolean(fieldErrors.address)}
          aria-describedby={fieldErrors.address ? 'customer-address-error' : undefined}
        />
        <FieldError id="customer-address-error" message={fieldErrors.address} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="customer-city"
          name="city"
          label={FIELD_LABELS.city}
          maxLength={120}
          autoComplete="address-level2"
          defaultValue={customer?.city ?? ''}
          error={fieldErrors.city}
        />
        <TextField
          id="customer-state"
          name="state"
          label={FIELD_LABELS.state}
          maxLength={120}
          autoComplete="address-level1"
          defaultValue={customer?.state ?? ''}
          error={fieldErrors.state}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="customer-postal-code"
          name="postal_code"
          label={FIELD_LABELS.postal_code}
          maxLength={30}
          autoComplete="postal-code"
          defaultValue={customer?.postal_code ?? ''}
          error={fieldErrors.postal_code}
        />
        <TextField
          id="customer-country"
          name="country"
          label={FIELD_LABELS.country}
          maxLength={120}
          autoComplete="country-name"
          defaultValue={customer?.country ?? ''}
          error={fieldErrors.country}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto">
          {pending ? 'Saving…' : isEditing ? 'Save changes' : 'Create customer'}
        </Button>
        <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}

type TextFieldProps = {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  maxLength: number;
  autoComplete?: string;
  defaultValue: string;
  error?: string;
};

function TextField({
  id,
  name,
  label,
  required = false,
  type = 'text',
  maxLength,
  autoComplete,
  defaultValue,
  error,
}: TextFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      <Input
        id={id}
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}
