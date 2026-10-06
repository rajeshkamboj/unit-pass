import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2" aria-label="UnitPass home">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-9 w-9 text-primary"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3h-3zM19 19h2v2h-2z" />
        </svg>
        <span className="text-xl font-semibold tracking-tight">UnitPass</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        The Digital Service Passport for HVAC Equipment
      </p>
    </div>
  );
}
