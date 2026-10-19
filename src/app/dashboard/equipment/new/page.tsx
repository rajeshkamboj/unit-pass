import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/session';
import type { CustomerOption } from '@/lib/types';
import { EquipmentForm } from '../equipment-form';

export const metadata: Metadata = {
  title: 'Add equipment',
};

const CUSTOMER_OPTION_COLUMNS = 'id, first_name, last_name';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function NewEquipmentPage({ searchParams }: { searchParams: SearchParams }) {
  const { companyId } = await requireCompany();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_OPTION_COLUMNS)
    .eq('company_id', companyId)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
    .limit(1000);

  if (error) {
    console.error('[equipment] Failed to load customers for the equipment form:', error.message);
    throw new Error('Unable to load customers.');
  }

  const customers = (data ?? []) as CustomerOption[];
  const requestedCustomerId = typeof searchParams.customer_id === 'string' ? searchParams.customer_id : '';
  const defaultCustomerId = customers.some((customer) => customer.id === requestedCustomerId)
    ? requestedCustomerId
    : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" className="-ml-3 min-h-10">
        <Link href="/dashboard/equipment">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Equipment
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add equipment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record the installed unit. A permanent public token and QR code are created automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Unit details</CardTitle>
          <CardDescription>
            Customer, name and type are required. Everything else can be added later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EquipmentForm customers={customers} defaultCustomerId={defaultCustomerId} />
        </CardContent>
      </Card>
    </div>
  );
}
