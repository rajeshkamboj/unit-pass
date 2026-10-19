import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireCompany } from '@/lib/session';
import { CustomerForm } from '../customer-form';

export const metadata: Metadata = {
  title: 'Add customer',
};

export default async function NewCustomerPage() {
  await requireCompany();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add customer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Save the homeowner&apos;s contact details for your company records.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer details</CardTitle>
          <CardDescription>First and last name are required. All other details are optional.</CardDescription>
        </CardHeader>
        <CardContent>
          <CustomerForm />
        </CardContent>
      </Card>
    </div>
  );
}
