'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  EQUIPMENT_STATUSES,
  EQUIPMENT_TYPES,
  type CustomerOption,
  type EquipmentFormRow,
} from '@/lib/types';
import type { EquipmentField } from '@/lib/validation/equipment';
import { createEquipment, updateEquipment, type EquipmentActionResult } from './actions';

type EquipmentFormProps = {
  customers: CustomerOption[];
  equipment?: EquipmentFormRow;
  defaultCustomerId?: string;
};

const selectClassName =
  'flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function EquipmentForm({ customers, equipment, defaultCustomerId }: EquipmentFormProps) {
  const [result, setResult] = useState<EquipmentActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const fieldErrors = result?.fieldErrors ?? {};
  const isEditing = Boolean(equipment);
  const cancelHref = equipment ? `/dashboard/equipment/${equipment.id}` : '/dashboard/equipment';

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setResult(null);

    startTransition(async () => {
      try {
        const nextResult = equipment
          ? await updateEquipment(equipment.id, formData)
          : await createEquipment(formData);
        setResult(nextResult);

        if (nextResult.ok && nextResult.equipmentId) {
          router.push(`/dashboard/equipment/${nextResult.equipmentId}`);
          router.refresh();
        }
      } catch {
        setResult({ ok: false, error: 'We could not save this equipment. Please try again.' });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8" aria-busy={pending}>
      {result?.error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {result.error}
        </div>
      ) : null}

      <section className="space-y-5" aria-labelledby="equipment-identity-heading">
        <div>
          <h2 id="equipment-identity-heading" className="text-base font-semibold">
            Equipment
          </h2>
          <p className="text-sm text-muted-foreground">
            Name, type and the customer this unit belongs to.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="equipment-customer">
            Customer <span className="text-destructive">*</span>
          </Label>
          <select
            id="equipment-customer"
            name="customer_id"
            required
            defaultValue={equipment?.customer_id ?? defaultCustomerId ?? ''}
            aria-invalid={Boolean(fieldErrors.customer_id)}
            aria-describedby={fieldErrors.customer_id ? 'equipment-customer-error' : undefined}
            className={selectClassName}
          >
            <option value="">Select a customer…</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.last_name}, {customer.first_name}
              </option>
            ))}
          </select>
          <FieldError id="equipment-customer-error" message={fieldErrors.customer_id} />
          {customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No customers yet.{' '}
              <Link href="/dashboard/customers/new" className="font-medium text-primary underline-offset-4 hover:underline">
                Add a customer first
              </Link>
              .
            </p>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="equipment-name"
            name="equipment_name"
            label="Equipment name"
            required
            maxLength={120}
            placeholder="Downstairs AC"
            defaultValue={equipment?.equipment_name ?? ''}
            error={fieldErrors.equipment_name}
          />
          <div className="space-y-2">
            <Label htmlFor="equipment-type">
              Equipment type <span className="text-destructive">*</span>
            </Label>
            <select
              id="equipment-type"
              name="equipment_type"
              required
              defaultValue={equipment?.equipment_type ?? ''}
              aria-invalid={Boolean(fieldErrors.equipment_type)}
              aria-describedby={fieldErrors.equipment_type ? 'equipment-type-error' : undefined}
              className={selectClassName}
            >
              <option value="">Select a type…</option>
              {EQUIPMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <FieldError id="equipment-type-error" message={fieldErrors.equipment_type} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <TextField
            id="equipment-manufacturer"
            name="manufacturer"
            label="Manufacturer"
            maxLength={120}
            defaultValue={equipment?.manufacturer ?? ''}
            error={fieldErrors.manufacturer}
          />
          <TextField
            id="equipment-model"
            name="model_number"
            label="Model number"
            maxLength={120}
            defaultValue={equipment?.model_number ?? ''}
            error={fieldErrors.model_number}
          />
          <TextField
            id="equipment-serial"
            name="serial_number"
            label="Serial number"
            maxLength={120}
            defaultValue={equipment?.serial_number ?? ''}
            error={fieldErrors.serial_number}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="equipment-status">Status</Label>
          <select
            id="equipment-status"
            name="status"
            defaultValue={equipment?.status ?? 'Active'}
            className={selectClassName}
          >
            {EQUIPMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Every status keeps the public QR code working. Use “Replaced” to retire a unit.
          </p>
        </div>
      </section>

      <section className="space-y-5 border-t pt-6" aria-labelledby="equipment-service-heading">
        <div>
          <h2 id="equipment-service-heading" className="text-base font-semibold">
            Warranty and service
          </h2>
          <p className="text-sm text-muted-foreground">
            Warranty details appear on the public UnitPass page.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="equipment-installation-date"
            name="installation_date"
            label="Installation date"
            type="date"
            maxLength={10}
            defaultValue={equipment?.installation_date ?? ''}
            error={fieldErrors.installation_date}
          />
          <TextField
            id="equipment-warranty-expiration"
            name="warranty_expiration_date"
            label="Warranty expiration date"
            type="date"
            maxLength={10}
            defaultValue={equipment?.warranty_expiration_date ?? ''}
            error={fieldErrors.warranty_expiration_date}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="equipment-warranty-notes">Warranty notes (public)</Label>
          <Textarea
            id="equipment-warranty-notes"
            name="warranty_notes"
            maxLength={2000}
            defaultValue={equipment?.warranty_notes ?? ''}
            aria-invalid={Boolean(fieldErrors.warranty_notes)}
            aria-describedby={fieldErrors.warranty_notes ? 'equipment-warranty-notes-error' : undefined}
          />
          <FieldError id="equipment-warranty-notes-error" message={fieldErrors.warranty_notes} />
          <p className="text-xs text-muted-foreground">Shown on the public UnitPass page.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="equipment-next-service-date"
            name="next_service_date"
            label="Next service date"
            type="date"
            maxLength={10}
            defaultValue={equipment?.next_service_date ?? ''}
            error={fieldErrors.next_service_date}
          />
          <TextField
            id="equipment-service-interval"
            name="service_interval"
            label="Service interval (months)"
            type="number"
            min={1}
            max={60}
            maxLength={2}
            defaultValue={equipment?.service_interval?.toString() ?? ''}
            error={fieldErrors.service_interval}
            hint="Leave empty to use the company default."
          />
        </div>
      </section>

      <section className="space-y-5 border-t pt-6" aria-labelledby="equipment-notes-heading">
        <div>
          <h2 id="equipment-notes-heading" className="text-base font-semibold">
            Notes
          </h2>
          <p className="text-sm text-muted-foreground">You decide what the homeowner can see.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="equipment-public-notes">Public notes</Label>
          <Textarea
            id="equipment-public-notes"
            name="public_notes"
            maxLength={2000}
            defaultValue={equipment?.public_notes ?? ''}
            aria-invalid={Boolean(fieldErrors.public_notes)}
            aria-describedby={fieldErrors.public_notes ? 'equipment-public-notes-error' : undefined}
          />
          <FieldError id="equipment-public-notes-error" message={fieldErrors.public_notes} />
          <p className="text-xs text-muted-foreground">Shown on the public UnitPass page.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="equipment-private-notes">Private notes</Label>
          <Textarea
            id="equipment-private-notes"
            name="installer_notes"
            maxLength={4000}
            defaultValue={equipment?.installer_notes ?? ''}
            aria-invalid={Boolean(fieldErrors.installer_notes)}
            aria-describedby={fieldErrors.installer_notes ? 'equipment-private-notes-error' : undefined}
          />
          <FieldError id="equipment-private-notes-error" message={fieldErrors.installer_notes} />
          <p className="text-xs font-medium text-muted-foreground">
            Private — never shown on UnitPass.
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center">
        <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto">
          {pending ? 'Saving…' : isEditing ? 'Save changes' : 'Add equipment'}
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
  min?: number;
  max?: number;
  maxLength: number;
  placeholder?: string;
  defaultValue: string;
  error?: string;
  hint?: string;
};

function TextField({
  id,
  name,
  label,
  required = false,
  type = 'text',
  min,
  max,
  maxLength,
  placeholder,
  defaultValue,
  error,
  hint,
}: TextFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

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
        min={min}
        max={max}
        maxLength={maxLength}
        placeholder={placeholder}
        defaultValue={defaultValue}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
      />
      <FieldError id={errorId} message={error} />
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
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
