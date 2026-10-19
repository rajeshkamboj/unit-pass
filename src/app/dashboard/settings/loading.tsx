export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" role="status" aria-live="polite">
      <span className="sr-only">Loading settings…</span>
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="space-y-5 rounded-lg border p-6">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="h-10 animate-pulse rounded bg-muted/60" />
        ))}
      </div>
    </div>
  );
}
