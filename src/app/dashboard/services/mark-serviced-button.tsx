'use client';

import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { formatDateOnly } from '@/lib/equipment';
import { SERVICE_TYPES } from '@/lib/types';
import type { ServiceActionField, ServiceActionResult } from './actions';
import { markEquipmentServiced } from './actions';

type MarkServicedButtonProps = {
  equipmentId: string;
  equipmentName: string;
  customerName: string;
  /** Equipment override, null when the company default applies. */
  serviceInterval: number | null;
  companyDefaultInterval: number;
  defaultServiceDate: string;
  /** Today + 1 day: the validation limit for a visit date. */
  latestServiceDate: string;
};

const selectClassName =
  'flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Mark Serviced: one click logs today's Maintenance visit and rolls the
 * schedule forward. "Customize" opens the same action with overrides.
 */
export function MarkServicedButton({
  equipmentId,
  equipmentName,
  customerName,
  serviceInterval,
  companyDefaultInterval,
  defaultServiceDate,
  latestServiceDate,
}: MarkServicedButtonProps) {
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ServiceActionField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function surfaceResult(result: ServiceActionResult): boolean {
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.error ?? 'We could not log this service visit. Please try again.');
      return false;
    }

    const nextDate = result.nextServiceDate ? formatDateOnly(result.nextServiceDate) : null;
    if (result.warning) {
      toast.warning(result.warning);
    } else {
      toast.success(nextDate ? `Service logged. Next service: ${nextDate}.` : 'Service logged.');
    }
    return true;
  }

  function handleDefault() {
    setFieldErrors({});
    setFormError(null);
    startTransition(async () => {
      try {
        const result = await markEquipmentServiced(equipmentId);
        surfaceResult(result);
        router.refresh();
      } catch {
        toast.error('We could not log this service visit. Please try again.');
      }
    });
  }

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
        const result = await markEquipmentServiced(equipmentId, formData);
        if (surfaceResult(result)) {
          setOpen(false);
          router.refresh();
        }
      } catch {
        setFormError('We could not log this service visit. Please try again.');
      }
    });
  }

  const intervalDefault = serviceInterval ?? companyDefaultInterval;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" className="min-h-10" disabled={pending} onClick={handleDefault}>
        {pending && !open ? 'Marking…' : 'Mark serviced'}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="min-h-10" disabled={pending}>
            Customize
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Mark serviced</DialogTitle>
            <DialogDescription>
              {equipmentName} · {customerName}. The visit is logged and the next service date becomes the service date
              plus the interval.
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
                <Label htmlFor={`mark-date-${formId}`}>
                  Service date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`mark-date-${formId}`}
                  name="service_date"
                  type="date"
                  required
                  max={latestServiceDate}
                  defaultValue={defaultServiceDate}
                  aria-invalid={Boolean(fieldErrors.service_date)}
                  className="min-h-10"
                />
                <FieldError message={fieldErrors.service_date} />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`mark-type-${formId}`}>
                  Service type <span className="text-destructive">*</span>
                </Label>
                <select
                  id={`mark-type-${formId}`}
                  name="service_type"
                  required
                  defaultValue="Maintenance"
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`mark-technician-${formId}`}>Technician</Label>
                <Input
                  id={`mark-technician-${formId}`}
                  name="technician_name"
                  maxLength={120}
                  placeholder="Who performed the work?"
                  aria-invalid={Boolean(fieldErrors.technician_name)}
                  className="min-h-10"
                />
                <FieldError message={fieldErrors.technician_name} />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`mark-interval-${formId}`}>Next interval (months)</Label>
                <Input
                  id={`mark-interval-${formId}`}
                  name="service_interval"
                  type="number"
                  min={1}
                  max={60}
                  defaultValue={intervalDefault}
                  aria-invalid={Boolean(fieldErrors.service_interval)}
                  className="min-h-10"
                />
                <FieldError message={fieldErrors.service_interval} />
                <p className="text-xs text-muted-foreground">
                  The effective interval ({intervalDefault} {intervalDefault === 1 ? 'month' : 'months'}) is prefilled.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`mark-public-notes-${formId}`}>Public notes</Label>
              <Textarea
                id={`mark-public-notes-${formId}`}
                name="public_notes"
                maxLength={2000}
                placeholder="Work performed, parts replaced, recommendations…"
                aria-invalid={Boolean(fieldErrors.public_notes)}
              />
              <FieldError message={fieldErrors.public_notes} />
              <p className="text-xs text-muted-foreground">Shown on the homeowner&apos;s public UnitPass.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`mark-private-notes-${formId}`}>Private notes</Label>
              <Textarea
                id={`mark-private-notes-${formId}`}
                name="private_notes"
                maxLength={4000}
                placeholder="Internal details for your team only."
                aria-invalid={Boolean(fieldErrors.private_notes)}
              />
              <FieldError message={fieldErrors.private_notes} />
              <p className="text-xs font-medium text-muted-foreground">Private — never shown on UnitPass.</p>
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
                {pending ? 'Saving…' : 'Mark serviced'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
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
