'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { signOut } from '@/app/auth/actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Navigation for the dashboard shell.
 *
 * Only functionality that actually exists is listed (Phase 1: Dashboard).
 * Later phases add their entries together with the feature.
 */
const NAV_ITEMS = [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] as const;

export function Sidebar({ companyName, userEmail }: { companyName: string | null; userEmail: string | null }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b bg-background px-4 py-3 md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-base font-semibold tracking-tight">UnitPass</span>
          {companyName ? (
            <span className="truncate text-sm text-muted-foreground">· {companyName}</span>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {mobileOpen ? (
        <div id="mobile-nav" className="border-b bg-background px-4 py-3 md:hidden">
          {/* Close control keeps the overlay usable with one thumb */}
          <div className="mb-2 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setMobileOpen(false)}>
              <X className="mr-1 h-4 w-4" aria-hidden="true" /> Close
            </Button>
          </div>
          {nav}
          <AccountBlock userEmail={userEmail} className="mt-3 border-t pt-3" />
        </div>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-background p-4 md:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2" aria-label="UnitPass dashboard">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7 text-primary"
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
          <span className="text-lg font-semibold tracking-tight">UnitPass</span>
        </Link>

        {companyName ? (
          <p className="mb-4 truncate px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {companyName}
          </p>
        ) : null}

        {nav}
        <AccountBlock userEmail={userEmail} className="mt-4 border-t pt-4" />
      </aside>
    </>
  );
}

function AccountBlock({ userEmail, className }: { userEmail: string | null; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      <p className="truncate px-3 text-xs text-muted-foreground" title={userEmail ?? undefined}>
        {userEmail ?? 'Signed in'}
      </p>
      <form action={signOut}>
        <Button type="submit" variant="ghost" className="w-full justify-start gap-3 px-3">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </Button>
      </form>
    </div>
  );
}
