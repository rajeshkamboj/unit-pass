import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/session';
import { getUnitPassUrl, isSiteOriginConfigured } from '@/lib/public/unitpass-url';
import { QrPanel } from './qr-panel';

export const metadata: Metadata = {
  title: 'Equipment QR code',
};

const equipmentIdSchema = z.string().uuid();
const QR_EQUIPMENT_COLUMNS =
  'id, equipment_name, equipment_type, manufacturer, model_number, serial_number, status, public_token, customers (last_name)';

export default async function EquipmentQrPage({ params }: { params: { id: string } }) {
  const { companyId, company } = await requireCompany();
  const parsedId = equipmentIdSchema.safeParse(params.id);
  if (!parsedId.success) notFound();

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('equipment')
    .select(QR_EQUIPMENT_COLUMNS)
    .eq('id', parsedId.data)
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) {
    console.error('[equipment] Failed to load equipment for the QR page:', error.message);
    throw new Error('Unable to load this equipment.');
  }
  if (!data) notFound();

  const item = data as unknown as {
    id: string;
    equipment_name: string;
    equipment_type: string;
    manufacturer: string | null;
    model_number: string | null;
    serial_number: string | null;
    status: string;
    public_token: string;
    customers: { last_name: string } | { last_name: string }[] | null;
  };
  const customerRow = Array.isArray(item.customers) ? item.customers[0] : item.customers;
  const publicUrl = getUnitPassUrl(item.public_token);

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Button asChild variant="ghost" className="-ml-3 min-h-10">
          <Link href={`/dashboard/equipment/${item.id}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {item.equipment_name}
          </Link>
        </Button>
      </div>

      <div className="print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight">QR code</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Download the PNG or print the label for {item.equipment_name}.
        </p>
      </div>

      <QrPanel
        publicUrl={publicUrl}
        equipmentName={item.equipment_name}
        equipmentType={item.equipment_type}
        manufacturer={item.manufacturer}
        modelNumber={item.model_number}
        serialNumber={item.serial_number}
        customerLastName={customerRow?.last_name ?? null}
        companyName={company.name}
        companyPhone={company.phone}
        siteOriginConfigured={isSiteOriginConfigured()}
      />
    </div>
  );
}
