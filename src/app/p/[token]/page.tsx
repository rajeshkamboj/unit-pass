import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { describeWarranty, formatDateOnly } from '@/lib/equipment';
import { getPublicUnitPass } from '@/lib/public/get-unitpass';

export const dynamic = 'force-dynamic';

type Props = { params: { token: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  let pass: Awaited<ReturnType<typeof getPublicUnitPass>> = null;
  try {
    pass = await getPublicUnitPass(params.token);
  } catch {
    pass = null;
  }

  const robots = { index: false, follow: false };

  if (!pass) {
    return { title: 'UnitPass not found', robots };
  }

  return {
    title: `${pass.equipment.name} · ${pass.company.name}`,
    description: `Digital service passport for ${pass.equipment.name}, maintained by ${pass.company.name}.`,
    // A passport is reachable only by scanning its physical QR code.
    robots,
  };
}

export default async function PublicUnitPassPage({ params }: Props) {
  const pass = await getPublicUnitPass(params.token);
  if (!pass) notFound();

  const { company, equipment } = pass;
  const warranty = describeWarranty(equipment.warranty_expiration_date);
  const bookingUrl = safeHttpUrl(company.service_booking_url);
  const websiteUrl = safeHttpUrl(company.website);
  const hasContact = Boolean(company.phone || company.email);

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-6 text-base sm:py-10">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <header className="rounded-lg border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <p className="break-words text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {company.name}
              </p>
              <p className="text-sm font-medium text-muted-foreground">Digital Service Passport</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Powered by UnitPass</p>
            </div>
            {company.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logo_url}
                alt={`${company.name} logo`}
                className="h-12 w-auto max-w-40 shrink-0 object-contain"
              />
            ) : null}
          </div>

          <h1 className="mt-3 break-words text-2xl font-bold tracking-tight">{equipment.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">{equipment.type}</span>
            <StatusBadge status={equipment.status} />
          </div>
        </header>

        {equipment.status === 'Replaced' ? (
          <div
            role="status"
            className="rounded-lg border border-amber-600/40 bg-amber-50 p-5 text-amber-950 dark:bg-amber-950/40 dark:text-amber-50"
          >
            <h2 className="text-base font-semibold">This equipment has been replaced</h2>
            <p className="mt-1">
              This unit is no longer in service. Contact {company.name} for details about its replacement,
              warranty or service history.
            </p>
            <ContactLinks company={company} className="mt-3" />
          </div>
        ) : null}

        {equipment.status === 'Inactive' ? (
          <div
            role="status"
            className="rounded-lg border border-slate-400/50 bg-slate-50 p-5 text-slate-900 dark:bg-slate-900/40 dark:text-slate-100"
          >
            <h2 className="text-base font-semibold">Not currently in service</h2>
            <p className="mt-1">
              This unit is marked as not currently in service. Contact {company.name} if you have questions.
            </p>
          </div>
        ) : null}

        <section aria-labelledby="equipment-heading" className="rounded-lg border bg-card p-5 shadow-sm sm:p-6">
          <h2 id="equipment-heading" className="text-lg font-semibold">
            Equipment
          </h2>
          <dl className="mt-3 divide-y text-base">
            <DetailRow label="Type" value={equipment.type} />
            <DetailRow label="Manufacturer" value={equipment.manufacturer} />
            <DetailRow label="Model number" value={equipment.model_number} />
            <DetailRow label="Serial number" value={equipment.serial_number} />
            <DetailRow label="Installed" value={formatDateOnly(equipment.installation_date)} />
          </dl>
        </section>

        <section aria-labelledby="warranty-heading" className="rounded-lg border bg-card p-5 shadow-sm sm:p-6">
          <h2 id="warranty-heading" className="text-lg font-semibold">
            Warranty
          </h2>
          <p
            className={
              warranty.tone === 'expired'
                ? 'mt-2 text-base font-semibold text-destructive'
                : warranty.tone === 'active'
                  ? 'mt-2 text-base font-semibold text-emerald-700 dark:text-emerald-400'
                  : 'mt-2 text-base font-semibold text-muted-foreground'
            }
          >
            {warranty.label}
          </p>
          {equipment.warranty_expiration_date ? (
            <p className="mt-1 text-base text-muted-foreground">
              Expiration date: {formatDateOnly(equipment.warranty_expiration_date)}
            </p>
          ) : null}
          {equipment.warranty_notes ? (
            <p className="mt-3 max-w-prose whitespace-pre-line break-words text-base">
              {equipment.warranty_notes}
            </p>
          ) : null}
        </section>

        {equipment.public_notes ? (
          <section aria-labelledby="notes-heading" className="rounded-lg border bg-card p-5 shadow-sm sm:p-6">
            <h2 id="notes-heading" className="text-lg font-semibold">
              Notes
            </h2>
            <p className="mt-2 max-w-prose whitespace-pre-line break-words text-base">
              {equipment.public_notes}
            </p>
          </section>
        ) : null}

        <section aria-labelledby="booking-heading" className="rounded-lg border bg-card p-5 shadow-sm sm:p-6">
          <h2 id="booking-heading" className="text-lg font-semibold">
            Book service
          </h2>

          {bookingUrl ? (
            <div className="mt-3 space-y-2">
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-primary px-5 py-3 text-base font-semibold text-primary-foreground underline-offset-4 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto"
              >
                Book Service
              </a>
              <p className="text-base text-muted-foreground">
                Opens {company.name}&apos;s booking page in a new tab.
              </p>
            </div>
          ) : hasContact ? (
            <div className="mt-3 space-y-2">
              <p className="text-base">Call or email {company.name} to schedule service.</p>
              <ContactLinks company={company} />
            </div>
          ) : (
            <p className="mt-2 text-base">
              Contact {company.name} to schedule service. No booking details are listed yet.
            </p>
          )}
        </section>

        <section aria-labelledby="contact-heading" className="rounded-lg border bg-card p-5 shadow-sm sm:p-6">
          <h2 id="contact-heading" className="text-lg font-semibold">
            Company contact
          </h2>
          {hasContact || websiteUrl ? (
            <div className="mt-3 space-y-2">
              {company.phone ? (
                <p>
                  <a
                    href={`tel:${encodeURIComponent(company.phone)}`}
                    className="inline-flex min-h-10 items-center text-base text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {company.phone}
                  </a>
                </p>
              ) : null}
              {company.email ? (
                <p className="break-all">
                  <a
                    href={`mailto:${company.email}`}
                    className="inline-flex min-h-10 items-center text-base text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {company.email}
                  </a>
                </p>
              ) : null}
              {websiteUrl ? (
                <p className="break-all">
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center text-base text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {company.website}
                  </a>
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-base text-muted-foreground">
              {company.name} has not added contact details yet.
            </p>
          )}
        </section>

        <footer className="pb-4 pt-2 text-center">
          <p className="text-sm text-muted-foreground">
            {equipment.name} maintained by {company.name}
          </p>
        </footer>
      </div>
    </main>
  );
}

function ContactLinks({
  company,
  className = '',
}: {
  company: { phone: string | null; email: string | null };
  className?: string;
}) {
  if (!company.phone && !company.email) return null;

  return (
    <div className={`flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 ${className}`}>
      {company.phone ? (
        <a
          href={`tel:${encodeURIComponent(company.phone)}`}
          className="inline-flex min-h-10 items-center text-base font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Call {company.phone}
        </a>
      ) : null}
      {company.email ? (
        <a
          href={`mailto:${company.email}`}
          className="inline-flex min-h-10 items-center break-all text-base font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Email {company.email}
        </a>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-wrap gap-x-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value ?? 'Not recorded'}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: 'Active' | 'Inactive' | 'Replaced' }) {
  if (status === 'Active') return <Badge variant="outline">Active</Badge>;
  if (status === 'Replaced') return <Badge variant="destructive">Replaced</Badge>;
  return <Badge variant="secondary">Inactive</Badge>;
}

/** Only absolute http(s) URLs are rendered as links (defence against stored `javascript:` URLs). */
function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}
