'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { archiveCustomer, unarchiveCustomer } from './actions';

type ArchiveCustomerButtonProps = {
  customerId: string;
  archived: boolean;
  compact?: boolean;
};

export function ArchiveCustomerButton({ customerId, archived, compact = false }: ArchiveCustomerButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const result = archived ? await unarchiveCustomer(customerId) : await archiveCustomer(customerId);
        if (!result.ok) {
          setError(result.error ?? 'We could not update this customer. Please try again.');
          return;
        }
        router.refresh();
      } catch {
        setError('We could not update this customer. Please try again.');
      }
    });
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant={archived ? 'outline' : 'secondary'}
        disabled={pending}
        onClick={handleClick}
        className={compact ? 'min-h-10' : 'min-h-10 w-full sm:w-auto'}
      >
        {pending ? 'Updating…' : archived ? 'Unarchive' : 'Archive'}
      </Button>
      {error ? (
        <p role="alert" className="max-w-xs text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
