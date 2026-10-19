import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/session';
import type { CustomerOption, EquipmentFormRow } from '@/lib/types';
import { EquipmentForm } from '../../equipment-form';

export const metadata: Metadata = {
  title: 'Edit equipment',
};

const equipmentIdSchema = z.string().uuid();
const EDIT_EQUIPMENT_COLUMNS =
  'id, customer_id, equipment_name, equipment_type, manufacturer, model_number, serial_number, installation_date, warranty_expiration_date, warranty_notes, next_service_date, service_interval, installer_notes, public_notes, status';
const CUSTOMER_OPTION_COLUMNS = 'id, first_name, last_name';

export default async function EditEquipmentPage({ params }: { params: { id: string } }) {
  const { companyId } = await requireCompany();
  const parsedId = equipmentIdSchema.safeParse(params.id);
  if (!parsedId.success) notFound();

  const supabase = getSupabaseServerClient();
  const [equipmentResult, customersResult] = await Promise.all([
    supabase
      .from('equipment')
      .select(EDIT_EQUIPMENT_COLUMNS)
      .eq('id', parsedId.data)
      .eq('company_id', companyId)
      .maybeSingle(),
    supabase
      .from('customers')
      .select(CUSTOMER_OPTION_COLUMNS)
      .eq('company_id', companyId)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })
      .limit(1000),
  ]);

  if (equipmentResult.error) {
    console.error('[equipment] Failed to load equipment for editing:', equipmentResult.error.message);
    throw new Error('Unable to load this equipment.');
  }
  if (!equipmentResult.data) notFound();

  if (customersResult.error) {
    console.error('[equipment] Failed to load customers for the equipment form:', customersResult.error.message);
    throw new Error('Unable to load customers.');
  }

  const equipment = equipmentResult.data as unknown as EquipmentFormRow;
  const customers = (customersResult.data ?? []) as CustomerOption[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" className="-ml-3 min-h-10">
        <Link href={`/dashboard/equipment/${equipment.id}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {equipment.equipment_name}
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit equipment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The public QR code and its link never change, no matter what you edit here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Unit details</CardTitle>
          <CardDescription>Changes are saved to this company&apos;s equipment record.</CardDescription>
        </CardHeader>
        <CardContent>
          <EquipmentForm customers={customers} equipment={equipment} />
        </CardContent>
      </Card>
    </div>
  );
}
