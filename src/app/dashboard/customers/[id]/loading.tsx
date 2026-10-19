export default function CustomerDetailLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <span className="sr-only">Loading customer…</span>
      <div className="h-10 w-32 animate-pulse rounded bg-muted" />
      <div className="h-72 animate-pulse rounded-lg border bg-muted/40" />
      <div className="h-32 animate-pulse rounded-lg border bg-muted/40" />
    </div>
  );
}
