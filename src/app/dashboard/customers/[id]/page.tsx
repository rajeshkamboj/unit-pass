import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { ArrowLeft, Mail, MapPin, Phone, Wrench } from 'lucide-react';
import { ArchiveCustomerButton } from '../archive-customer-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateOnly } from '@/lib/equipment';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/session';
import type { CustomerRow } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Customer',
};

const customerIdSchema = z.string().uuid();
const CUSTOMER_COLUMNS =
  'id, first_name, last_name, email, phone, address, city, state, postal_code, country, archived_at, created_at, updated_at';
const CUSTOMER_EQUIPMENT_COLUMNS = 'id, equipment_name, equipment_type, status, next_service_date';

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const { companyId } = await requireCompany();
  const parsedId = customerIdSchema.safeParse(params.id);
  if (!parsedId.success) notFound();

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_COLUMNS)
    .eq('id', parsedId.data)
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) {
    console.error('[customers] Failed to load customer detail:', error.message);
    throw new Error('Unable to load this customer.');
  }
  if (!data) notFound();

  const customer = data as CustomerRow;

  // Phase 3: the units installed at this customer's property.
  const equipmentResult = await supabase
    .from('equipment')
    .select(CUSTOMER_EQUIPMENT_COLUMNS)
    .eq('customer_id', customer.id)
    .eq('company_id', companyId)
    .order('status', { ascending: true })
    .order('next_service_date', { ascending: true, nullsFirst: false })
    .limit(20);

  if (equipmentResult.error) {
    console.error('[customers] Failed to load customer equipment:', equipmentResult.error.message);
  }

  const customerEquipment = (equipmentResult.data ?? []) as Array<{
    id: string;
    equipment_name: string;
    equipment_type: string;
    status: 'Active' | 'Inactive' | 'Replaced';
    next_service_date: string | null;
  }>;
  const fullName = `${customer.first_name} ${customer.last_name}`;
  const cityState = [customer.city, customer.state].filter(Boolean).join(', ');
  const addressLines = [customer.address, cityState, customer.postal_code, customer.country].filter(Boolean);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="min-h-10 -ml-3">
        <Link href="/dashboard/customers">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Customers
        </Link>
      </Button>

      {customer.archived_at ? (
        <div className="rounded-md border border-amber-600/30 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          This customer is archived. Their record is retained and can be restored at any time.
        </div>
      ) : null}

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">{fullName}</CardTitle>
              <Badge variant={customer.archived_at ? 'secondary' : 'outline'}>
                {customer.archived_at ? 'Archived' : 'Active'}
              </Badge>
            </div>
            <CardDescription>Customer details and contact information</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="min-h-10">
              <Link href={`/dashboard/customers/${customer.id}/edit`}>Edit customer</Link>
            </Button>
            <ArchiveCustomerButton customerId={customer.id} archived={Boolean(customer.archived_at)} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 border-t pt-6 sm:grid-cols-2">
          <section className="space-y-3" aria-labelledby="customer-contact-heading">
            <h2 id="customer-contact-heading" className="text-sm font-semibold">Contact</h2>
            {customer.email ? (
              <a
                href={`mailto:${customer.email}`}
                className="flex min-h-10 items-center gap-3 break-all text-sm text-primary underline-offset-4 hover:underline"
              >
                <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                {customer.email}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">No email on file</p>
            )}
            {customer.phone ? (
              <a
                href={`tel:${encodeURIComponent(customer.phone)}`}
                className="flex min-h-10 items-center gap-3 text-sm text-primary underline-offset-4 hover:underline"
              >
                <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                {customer.phone}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">No phone on file</p>
            )}
          </section>

          <section className="space-y-3" aria-labelledby="customer-address-heading">
            <h2 id="customer-address-heading" className="text-sm font-semibold">Address</h2>
            {addressLines.length > 0 ? (
              <div className="flex gap-3 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <address className="not-italic leading-6">
                  {addressLines.map((line, index) => (
                    <span key={`${line}-${index}`} className="block">{line}</span>
                  ))}
                </address>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No address on file</p>
            )}
          </section>

          <div className="text-sm text-muted-foreground sm:col-span-2">
            Customer since {formatDate(customer.created_at)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">Equipment</CardTitle>
            <CardDescription>
              {customerEquipment.length === 0
                ? 'Units installed for this customer will appear here.'
                : `${customerEquipment.length} ${customerEquipment.length === 1 ? 'unit' : 'units'} on record.`}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="min-h-10">
              <Link href={`/dashboard/equipment?customer=${customer.id}`}>View all</Link>
            </Button>
            <Button asChild className="min-h-10">
              <Link href={`/dashboard/equipment/new?customer_id=${customer.id}`}>Add equipment</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="border-t pt-4">
          {equipmentResult.error ? (
            <p role="alert" className="text-sm text-destructive">
              Equipment could not be loaded right now.
            </p>
          ) : customerEquipment.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
              No equipment yet. Add the first unit to generate its permanent QR code.
            </div>
          ) : (
            <ul className="divide-y">
              {customerEquipment.map((unit) => (
                <li key={unit.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/equipment/${unit.id}`}
                      className="flex min-h-10 items-center gap-2 break-words font-medium underline-offset-4 hover:underline"
                    >
                      <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      {unit.equipment_name}
                    </Link>
                    <p className="text-sm text-muted-foreground">{unit.equipment_type}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={unit.status === 'Replaced' ? 'destructive' : unit.status === 'Inactive' ? 'secondary' : 'outline'}>
                      {unit.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {unit.next_service_date
                        ? `Next service ${formatDateOnly(unit.next_service_date)}`
                        : 'No next service date'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'an unknown date';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
}
