export default function DocumentsLoading() {
  return <div className="space-y-5" aria-busy="true" aria-live="polite">
    <div className="h-8 w-48 animate-pulse rounded bg-muted" />
    <div className="h-36 animate-pulse rounded-lg bg-muted" />
    <div className="grid gap-3 md:grid-cols-2">{[0, 1, 2, 3].map((key) => <div key={key} className="h-52 animate-pulse rounded-lg bg-muted" />)}</div>
    <p className="sr-only">Loading documents…</p>
  </div>;
}
