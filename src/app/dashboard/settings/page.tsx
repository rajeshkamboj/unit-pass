import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireCompany } from '@/lib/session';
import { CompanyProfileForm } from './company-form';

export const metadata: Metadata = {
  title: 'Settings',
};

export default async function SettingsPage() {
  const { company, role } = await requireCompany();
  const canEdit = role === 'owner' || role === 'admin';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Company settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep your company contact details and service booking information up to date.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Company profile</CardTitle>
          <CardDescription>
            These details help your team and customers know how to reach your company.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyProfileForm company={company} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}
