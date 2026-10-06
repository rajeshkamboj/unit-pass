import type { Metadata } from 'next';
import { Sidebar } from '@/components/Sidebar';
import { getUserMembership, requireUser } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Dashboard',
};

/**
 * Protected dashboard shell.
 *
 * Server Component: the session is read server-side (second gate after
 * middleware), and the shell renders only for signed-in users. Membership is
 * resolved from `company_members`; pages that need a company call
 * `requireCompany()`, so this layout stays valid for /dashboard/setup-company.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const membership = await getUserMembership(user.id);

  return (
    <div className="flex min-h-screen flex-col bg-muted/20 md:flex-row">
      <Sidebar companyName={membership?.company.name ?? null} userEmail={user.email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
