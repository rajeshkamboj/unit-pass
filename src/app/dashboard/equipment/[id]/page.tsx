import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { ArrowLeft, ExternalLink, QrCode } from 'lucide-react';
import { EquipmentStatusButton } from './status-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/session';
import { describeServiceDate, describeWarranty, formatDateOnly, formatTimestamp } from '@/lib/equipment';
import { getUnitPassUrl } from '@/lib/public/unitpass-url';
import type { EquipmentDetailRow, EquipmentStatus } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Equipment',
};

const equipmentIdSchema = z.string().uuid();
const EQUIPMENT_DETAIL_COLUMNS =
  'id, customer_id, equipment_name, equipment_type, manufacturer, model_number, serial_number, installation_date, warranty_expiration_date, warranty_notes, next_service_date, service_interval, installer_notes, public_notes, status, public_token, created_at, updated_at, customers (first_name, last_name)';

export default async function EquipmentDetailPage({ params }: { params: { id: string } }) {
  const { companyId, company } = await requireCompany();
  const parsedId = equipmentIdSchema.safeParse(params.id);
  if (!parsedId.success) notFound();

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('equipment')
    .select(EQUIPMENT_DETAIL_COLUMNS)
    .eq('id', parsedId.data)
    .eq('company_id', companyId)
    .maybeSingle();

  if (error) {
    console.error('[equipment] Failed to load equipment detail:', error.message);
    throw new Error('Unable to load this equipment.');
  }
  if (!data) notFound();

  const item = data as unknown as EquipmentDetailRow;
  const customerRow = Array.isArray(item.customers) ? item.customers[0] : item.customers;
  const customerName = customerRow ? `${customerRow.first_name} ${customerRow.last_name}` : null;
  const warranty = describeWarranty(item.warranty_expiration_date);
  const publicUrl = getUnitPassUrl(item.public_token);
  const interval = item.service_interval ?? company.default_service_interval;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="-ml-3 min-h-10">
        <Link href="/dashboard/equipment">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Equipment
        </Link>
      </Button>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="break-words text-xl">{item.equipment_name}</CardTitle>
              <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
            </div>
            <CardDescription className="break-words">
              {item.equipment_type}
              {customerName ? (
                <>
                  {' · '}
                  <Link
                    href={`/dashboard/customers/${item.customer_id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {customerName}
                  </Link>
                </>
              ) : null}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="min-h-10">
              <Link href={`/dashboard/equipment/${item.id}/edit`}>Edit</Link>
            </Button>
            <Button asChild className="min-h-10">
              <Link href={`/dashboard/equipment/${item.id}/qr`}>
                <QrCode className="h-4 w-4" aria-hidden="true" />
                View QR
              </Link>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="grid gap-6 border-t pt-6 sm:grid-cols-2">
          <section className="space-y-2" aria-labelledby="equipment-identity-heading">
            <h2 id="equipment-identity-heading" className="text-sm font-semibold">
              Unit identity
            </h2>
            <DefinitionList
              rows={[
                ['Manufacturer', item.manufacturer],
                ['Model number', item.model_number],
                ['Serial number', item.serial_number],
                ['Installed', formatDateOnly(item.installation_date)],
                ['Record created', formatTimestamp(item.created_at)],
              ]}
            />
          </section>

          <section className="space-y-2" aria-labelledby="equipment-warranty-heading">
            <h2 id="equipment-warranty-heading" className="text-sm font-semibold">
              Warranty
            </h2>
            <p className="text-sm">
              <span
                className={
                  warranty.tone === 'expired'
                    ? 'font-medium text-destructive'
                    : warranty.tone === 'active'
                      ? 'font-medium text-emerald-700 dark:text-emerald-400'
                      : 'text-muted-foreground'
                }
              >
                {warranty.label}
              </span>
            </p>
            {item.warranty_notes ? (
              <p className="whitespace-pre-line break-words text-sm text-muted-foreground">
                {item.warranty_notes}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No warranty notes</p>
            )}
            <p className="text-xs text-muted-foreground">Warranty details are shown on the public UnitPass.</p>
          </section>

          <section className="space-y-2" aria-labelledby="equipment-service-heading">
            <h2 id="equipment-service-heading" className="text-sm font-semibold">
              Service schedule
            </h2>
            <DefinitionList
              rows={[
                ['Next service', describeServiceDate(item.next_service_date)],
                ['Service interval', `${interval} ${interval === 1 ? 'month' : 'months'}`],
              ]}
            />
            {item.service_interval === null ? (
              <p className="text-xs text-muted-foreground">Using the company default interval.</p>
            ) : null}
          </section>

          <section className="space-y-2" aria-labelledby="equipment-link-heading">
            <h2 id="equipment-link-heading" className="text-sm font-semibold">
              Public UnitPass
            </h2>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-2 break-all text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
              Open public page
            </a>
            <code className="block break-all rounded-md bg-muted px-3 py-2 text-xs">{publicUrl}</code>
            <p className="text-xs text-muted-foreground">
              The public token is permanent. Editing this record never changes it.
            </p>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notes</CardTitle>
          <CardDescription>Public notes appear on the UnitPass. Private notes never leave the dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 border-t pt-6 sm:grid-cols-2">
          <section className="space-y-2" aria-labelledby="equipment-public-notes-heading">
            <h2 id="equipment-public-notes-heading" className="text-sm font-semibold">
              Public notes
            </h2>
            {item.public_notes ? (
              <p className="whitespace-pre-line break-words text-sm">{item.public_notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No public notes</p>
            )}
          </section>
          <section className="space-y-2" aria-labelledby="equipment-private-notes-heading">
            <h2 id="equipment-private-notes-heading" className="text-sm font-semibold">
              Private notes
            </h2>
            <p className="text-xs font-medium text-muted-foreground">Private — never shown on UnitPass</p>
            {item.installer_notes ? (
              <p className="whitespace-pre-line break-words text-sm">{item.installer_notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No private notes</p>
            )}
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Retire this unit</CardTitle>
          <CardDescription>
            There is no delete. Retiring keeps the record and the printed QR code working.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 border-t pt-6">
          <div className="rounded-md border border-amber-600/30 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <strong>QR is permanent.</strong> Marking this unit as replaced never invalidates the QR code or the
            public page — homeowners can still reach your company.
          </div>
          <EquipmentStatusButton equipmentId={item.id} status={item.status} />
        </CardContent>
      </Card>
    </div>
  );
}

function DefinitionList({ rows }: { rows: Array<[string, string | null]> }) {
  const visible = rows.filter(([, value]) => Boolean(value));
  if (visible.length === 0) return <p className="text-sm text-muted-foreground">Not recorded</p>;

  return (
    <dl className="space-y-1 text-sm">
      {visible.map(([label, value]) => (
        <div key={label} className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">{label}:</dt>
          <dd className="break-words font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function statusBadgeVariant(status: EquipmentStatus): 'outline' | 'secondary' | 'destructive' {
  if (status === 'Active') return 'outline';
  if (status === 'Replaced') return 'destructive';
  return 'secondary';
}
