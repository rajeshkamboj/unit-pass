import { Card, CardContent } from '@/components/ui/card';

export default function EquipmentDetailLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-10 w-32 animate-pulse rounded bg-muted" />
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="h-7 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          <div className="grid gap-4 border-t pt-6 sm:grid-cols-2">
            <div className="h-24 animate-pulse rounded bg-muted" />
            <div className="h-24 animate-pulse rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="h-40 animate-pulse rounded bg-muted" />
      </Card>
      <p className="sr-only">Loading equipment…</p>
    </div>
  );
}
