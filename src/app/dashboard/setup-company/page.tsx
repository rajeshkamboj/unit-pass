import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUserMembership, requireUser } from '@/lib/session';
import { CompanySetupForm } from './company-setup-form';

export const metadata: Metadata = {
  title: 'Set up your company',
};

export default async function SetupCompanyPage() {
  const user = await requireUser();
  const membership = await getUserMembership(user.id);
  if (membership) redirect('/dashboard');

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create your company profile</h1>
        <p className="text-sm text-muted-foreground">
          These details appear on every UnitPass your customers scan, and the default service interval is used to
          schedule the next maintenance visit.
        </p>
      </div>
      <CompanySetupForm />
    </div>
  );
}
