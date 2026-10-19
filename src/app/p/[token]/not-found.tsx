import Link from 'next/link';

/**
 * Generic 404 for the public passport. It never reveals whether a token exists
 * in another company, or that a token ever existed at all.
 */
export default function UnitPassNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 px-4 py-10">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">UnitPass not found</h1>
        <p className="mt-2 text-base text-muted-foreground">
          This link or QR code does not match an equipment passport. Check the code and try again, or contact the
          company that services the unit.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md border px-4 py-2 text-base font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Learn about UnitPass
        </Link>
      </div>
    </main>
  );
}
