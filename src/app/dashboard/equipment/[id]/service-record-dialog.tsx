'use client';

import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SERVICE_TYPES, type ServiceType } from '@/lib/types';
import type { ServiceActionField } from '@/app/dashboard/services/actions';
import { createServiceRecord, updateServiceRecord } from '@/app/dashboard/services/actions';

export type ServiceRecordValues = {
  id: string;
  service_date: string;
  service_type: ServiceType;
  technician_name: string | null;
  public_notes: string | null;
  private_notes: string | null;
  next_service_date: string | null;
};

type ServiceRecordDialogProps = {
  equipmentId: string;
  defaultServiceDate: string;
  /** Today + 1 day: the validation limit for a visit date. */
  latestServiceDate: string;
  record?: ServiceRecordValues;
  triggerLabel: string;
  triggerVariant?: ButtonProps['variant'];
  triggerSize?: ButtonProps['size'];
  triggerClassName?: string;
};

const selectClassName =
  'flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Create/edit dialog for a service log entry. Calls the server action, renders
 * inline field errors and refreshes the timeline on success.
 */
export function ServiceRecordDialog({
  equipmentId,
  defaultServiceDate,
  latestServiceDate,
  record,
  triggerLabel,
  triggerVariant = 'outline',
  triggerSize = 'default',
  triggerClassName,
}: ServiceRecordDialogProps) {
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ServiceActionField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const isEditing = Boolean(record);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setFieldErrors({});
      setFormError(null);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      try {
        const result = record
          ? await updateServiceRecord(record.id, formData)
          : await createServiceRecord(equipmentId, formData);

        if (!result.ok) {
          setFieldErrors(result.fieldErrors ?? {});
          setFormError(result.error ?? 'We could not save this service record. Please try again.');
          return;
        }

        toast.success(record ? 'Service record updated.' : 'Service visit logged.');
        setOpen(false);
        router.refresh();
      } catch {
        setFormError('We could not save this service record. Please try again.');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant={triggerVariant} size={triggerSize} className={triggerClassName}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit service record' : 'Log a service visit'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Correct the details of this visit. Editing history does not change the equipment schedule.'
              : 'Public notes appear on the UnitPass service history. Private notes never leave the dashboard.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={pending}>
          {formError ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {formError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`service-date-${formId}`}>
                Service date <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`service-date-${formId}`}
                name="service_date"
                type="date"
                required
                max={latestServiceDate}
                defaultValue={record?.service_date ?? defaultServiceDate}
                aria-invalid={Boolean(fieldErrors.service_date)}
                className="min-h-10"
              />
              <FieldError message={fieldErrors.service_date} />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`service-type-${formId}`}>
                Service type <span className="text-destructive">*</span>
              </Label>
              <select
                id={`service-type-${formId}`}
                name="service_type"
                required
                defaultValue={record?.service_type ?? 'Maintenance'}
                aria-invalid={Boolean(fieldErrors.service_type)}
                className={selectClassName}
              >
                {SERVICE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <FieldError message={fieldErrors.service_type} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`technician-${formId}`}>Technician</Label>
            <Input
              id={`technician-${formId}`}
              name="technician_name"
              maxLength={120}
              defaultValue={record?.technician_name ?? ''}
              placeholder="Who performed the work?"
              aria-invalid={Boolean(fieldErrors.technician_name)}
              className="min-h-10"
            />
            <FieldError message={fieldErrors.technician_name} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`public-notes-${formId}`}>Public notes</Label>
            <Textarea
              id={`public-notes-${formId}`}
              name="public_notes"
              maxLength={2000}
              defaultValue={record?.public_notes ?? ''}
              placeholder="Work performed, parts replaced, recommendations…"
              aria-invalid={Boolean(fieldErrors.public_notes)}
            />
            <FieldError message={fieldErrors.public_notes} />
            <p className="text-xs text-muted-foreground">Shown on the homeowner&apos;s public UnitPass.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`private-notes-${formId}`}>Private notes</Label>
            <Textarea
              id={`private-notes-${formId}`}
              name="private_notes"
              maxLength={4000}
              defaultValue={record?.private_notes ?? ''}
              placeholder="Internal details for your team only."
              aria-invalid={Boolean(fieldErrors.private_notes)}
            />
            <FieldError message={fieldErrors.private_notes} />
            <p className="text-xs font-medium text-muted-foreground">Private — never shown on UnitPass.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`next-service-${formId}`}>Next service date</Label>
            <Input
              id={`next-service-${formId}`}
              name="next_service_date"
              type="date"
              defaultValue={record?.next_service_date ?? ''}
              aria-invalid={Boolean(fieldErrors.next_service_date)}
              className="min-h-10"
            />
            <FieldError message={fieldErrors.next_service_date} />
            <p className="text-xs text-muted-foreground">
              Optional. Use Mark serviced to log a visit and roll the equipment schedule forward in one step.
            </p>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="min-h-10" disabled={pending}>
              {pending ? 'Saving…' : isEditing ? 'Save changes' : 'Log visit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}
