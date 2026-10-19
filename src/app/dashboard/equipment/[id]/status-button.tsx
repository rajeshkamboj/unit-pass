'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { EquipmentStatus } from '@/lib/types';
import { setEquipmentStatus } from '../actions';

type EquipmentStatusButtonProps = {
  equipmentId: string;
  status: EquipmentStatus;
};

export function EquipmentStatusButton({ equipmentId, status }: EquipmentStatusButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isReplaced = status === 'Replaced';

  function handleClick() {
    const confirmed = window.confirm(
      isReplaced
        ? 'Restore this unit to active? Its QR code and UnitPass never changed.'
        : 'Mark this unit as replaced? The record is kept and the QR code keeps working forever.'
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      try {
        const result = await setEquipmentStatus(equipmentId, isReplaced ? 'Active' : 'Replaced');
        if (!result.ok) {
          setError(result.error ?? 'We could not update this equipment. Please try again.');
          return;
        }
        router.refresh();
      } catch {
        setError('We could not update this equipment. Please try again.');
      }
    });
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant={isReplaced ? 'outline' : 'secondary'}
        disabled={pending}
        onClick={handleClick}
        className="min-h-10 w-full sm:w-auto"
      >
        {pending ? 'Updating…' : isReplaced ? 'Restore to active' : 'Mark as replaced'}
      </Button>
      {error ? (
        <p role="alert" className="max-w-xs text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
