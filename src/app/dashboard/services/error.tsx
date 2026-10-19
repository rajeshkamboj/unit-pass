'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ServicesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[services] Dashboard services error:', error.message);
  }, [error]);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 px-5 py-10 text-center">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Services could not be loaded</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Something went wrong while loading the service list. Try again, or go back to the dashboard.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={reset} className="min-h-10">
            Try again
          </Button>
          <Button asChild variant="outline" className="min-h-10">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
