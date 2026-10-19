'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function EquipmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[equipment] Dashboard equipment error:', error.message);
  }, [error]);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 px-5 py-10 text-center">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Equipment could not be loaded</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Something went wrong while loading these records. Try again, or return to the equipment list.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={reset} className="min-h-10">
            Try again
          </Button>
          <Button asChild variant="outline" className="min-h-10">
            <Link href="/dashboard/equipment">Equipment list</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
