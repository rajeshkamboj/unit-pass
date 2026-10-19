import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/session';
import type { CustomerFormRow } from '@/lib/types';
import { CustomerForm } from '../../customer-form';

export const metadata: Metadata = {
  title: 'Edit customer',
};

const customerIdSchema = z.string().uuid();
const EDIT_CUSTOMER_COLUMNS = 'id, first_name, last_name, email, phone, address, city, state, postal_code, country';

export default async function EditCustomerPage({ params }: { params: { id: string } }) {
  const { companyId } = await requireCompany();
  const parsedId = customerIdSchema.safeParse(params.id);
  if (!parsedId.success) notFound();
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('customers')
    .select(EDIT_CUSTOMER_COLUMNS)
    .eq('id', parsedId.data)
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) {
    console.error('[customers] Failed to load customer for editing:', error.message);
    throw new Error('Unable to load this customer.');
  }
  if (!data) notFound();

  const customer = data as CustomerFormRow;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit customer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update contact details for {customer.first_name} {customer.last_name}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer details</CardTitle>
          <CardDescription>Changes are saved to this company&apos;s customer list.</CardDescription>
        </CardHeader>
        <CardContent>
          <CustomerForm customer={customer} />
        </CardContent>
      </Card>
    </div>
  );
}
