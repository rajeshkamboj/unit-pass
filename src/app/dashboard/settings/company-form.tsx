'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateCompanyProfile, type CompanyProfileActionResult } from './actions';
import type { CompanyRow } from '@/lib/types';
import type { CompanyProfileField } from '@/lib/validation/company';

type CompanyProfileFormProps = {
  company: CompanyRow;
  canEdit: boolean;
};

const FIELD_LABELS: Record<CompanyProfileField, string> = {
  name: 'Company name',
  contact_name: 'Contact name',
  phone: 'Phone',
  email: 'Email',
  website: 'Website',
  address: 'Address',
  service_booking_url: 'Service booking URL',
  default_service_interval: 'Default service interval',
};

export function CompanyProfileForm({ company, canEdit }: CompanyProfileFormProps) {
  const [result, setResult] = useState<CompanyProfileActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const fieldErrors = result?.fieldErrors ?? {};

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setResult(null);

    startTransition(async () => {
      try {
        const nextResult = await updateCompanyProfile(formData);
        setResult(nextResult);
        if (nextResult.ok) router.refresh();
      } catch {
        setResult({ ok: false, error: 'We could not save your company profile. Please try again.' });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-busy={pending}>
      {!canEdit ? (
        <div role="status" className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          This profile is read-only. Ask a company owner or admin to make changes.
        </div>
      ) : null}

      {result?.error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {result.error}
        </div>
      ) : null}
      {result?.ok ? (
        <div
          role="status"
          className="rounded-md border border-emerald-600/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
        >
          Company profile saved.
        </div>
      ) : null}

      <fieldset disabled={!canEdit || pending} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="company-name">
            {FIELD_LABELS.name} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="company-name"
            name="name"
            required
            maxLength={150}
            autoComplete="organization"
            defaultValue={company.name}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? 'company-name-error' : undefined}
          />
          <FieldError id="company-name-error" message={fieldErrors.name} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="contact-name"
            name="contact_name"
            label={FIELD_LABELS.contact_name}
            maxLength={120}
            autoComplete="name"
            defaultValue={company.contact_name ?? ''}
            error={fieldErrors.contact_name}
          />
          <TextField
            id="company-phone"
            name="phone"
            label={FIELD_LABELS.phone}
            type="tel"
            maxLength={50}
            autoComplete="tel"
            defaultValue={company.phone ?? ''}
            error={fieldErrors.phone}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="company-email"
            name="email"
            label={FIELD_LABELS.email}
            type="email"
            maxLength={254}
            autoComplete="email"
            defaultValue={company.email ?? ''}
            error={fieldErrors.email}
          />
          <TextField
            id="company-website"
            name="website"
            label={FIELD_LABELS.website}
            type="url"
            maxLength={2048}
            autoComplete="url"
            placeholder="https://example.com"
            defaultValue={company.website ?? ''}
            error={fieldErrors.website}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company-address">{FIELD_LABELS.address}</Label>
          <Textarea
            id="company-address"
            name="address"
            maxLength={300}
            autoComplete="street-address"
            defaultValue={company.address ?? ''}
            aria-invalid={Boolean(fieldErrors.address)}
            aria-describedby={fieldErrors.address ? 'company-address-error' : undefined}
          />
          <FieldError id="company-address-error" message={fieldErrors.address} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="service-booking-url">{FIELD_LABELS.service_booking_url}</Label>
          <Input
            id="service-booking-url"
            name="service_booking_url"
            type="url"
            maxLength={2048}
            placeholder="https://example.com/book-service"
            defaultValue={company.service_booking_url ?? ''}
            aria-invalid={Boolean(fieldErrors.service_booking_url)}
            aria-describedby={
              fieldErrors.service_booking_url ? 'service-booking-url-error service-booking-url-hint' : 'service-booking-url-hint'
            }
          />
          <p id="service-booking-url-hint" className="text-xs text-muted-foreground">
            Use a complete link beginning with http:// or https://.
          </p>
          <FieldError id="service-booking-url-error" message={fieldErrors.service_booking_url} />
        </div>

        <div className="space-y-2 sm:max-w-xs">
          <Label htmlFor="default-service-interval">
            {FIELD_LABELS.default_service_interval} (months)
          </Label>
          <Input
            id="default-service-interval"
            name="default_service_interval"
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            step={1}
            defaultValue={company.default_service_interval || 12}
            aria-invalid={Boolean(fieldErrors.default_service_interval)}
            aria-describedby={fieldErrors.default_service_interval ? 'service-interval-error' : undefined}
          />
          <FieldError id="service-interval-error" message={fieldErrors.default_service_interval} />
        </div>
      </fieldset>

      <Button type="submit" disabled={!canEdit || pending} className="min-h-11 w-full sm:w-auto">
        {pending ? 'Saving…' : 'Save company profile'}
      </Button>
    </form>
  );
}

type TextFieldProps = {
  id: string;
  name: string;
  label: string;
  type?: string;
  maxLength: number;
  autoComplete?: string;
  placeholder?: string;
  defaultValue: string;
  error?: string;
};

function TextField({
  id,
  name,
  label,
  type = 'text',
  maxLength,
  autoComplete,
  placeholder,
  defaultValue,
  error,
}: TextFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        maxLength={maxLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
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
