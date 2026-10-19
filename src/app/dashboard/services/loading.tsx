import { Card, CardContent } from '@/components/ui/card';

export default function ServicesLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-6">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-8 w-14 animate-pulse rounded bg-muted" />
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="flex flex-wrap gap-2 p-4">
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="h-10 w-28 animate-pulse rounded bg-muted" />
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-4">
              <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-10 w-full animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="sr-only">Loading services…</p>
    </div>
  );
}
