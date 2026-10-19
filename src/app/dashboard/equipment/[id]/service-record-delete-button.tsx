'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { deleteServiceRecord } from '@/app/dashboard/services/actions';

/**
 * Explicit, confirmed deletion of one service log entry. It never cascades to
 * equipment or customer data and does not change the equipment schedule.
 */
export function ServiceRecordDeleteButton({ recordId }: { recordId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setError(null);
  }

  function handleDelete(event: React.MouseEvent<HTMLButtonElement>) {
    // Keep the dialog open until the server confirms.
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const result = await deleteServiceRecord(recordId);
        if (!result.ok) {
          setError(result.error ?? 'We could not delete this service record. Please try again.');
          return;
        }
        toast.success('Service log entry deleted.');
        setOpen(false);
        router.refresh();
      } catch {
        setError('We could not delete this service record. Please try again.');
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="min-h-9 text-destructive">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this service log entry?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the visit from the dashboard timeline and from the public UnitPass service history. It never
            deletes the equipment or customer record, and it does not change the equipment&apos;s next service date.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? 'Deleting…' : 'Delete entry'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
