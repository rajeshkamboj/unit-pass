'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
export default function DocumentsError({ reset }: { reset: () => void }) {
  return <Card><CardContent className="space-y-3 p-6 text-center">
    <h1 className="text-lg font-semibold">Documents could not be loaded</h1>
    <p className="text-sm text-muted-foreground">Please try again. If the problem continues, ask your administrator to check the Phase 5 migration.</p>
    <Button type="button" onClick={reset}>Try again</Button>
  </CardContent></Card>;
}
