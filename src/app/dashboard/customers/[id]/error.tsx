'use client';

import { Button } from '@/components/ui/button';

export default function CustomerError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
      <h1 className="text-lg font-semibold">Customer details are unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We could not load this customer. The record may have changed; please try again.
      </p>
      <Button type="button" onClick={reset} className="mt-4 min-h-10">
        Try again
      </Button>
    </div>
  );
}
