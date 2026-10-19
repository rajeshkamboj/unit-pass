import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, Users, Wrench } from 'lucide-react';
import { StatCard, statValue } from '@/components/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateOnly, todayIsoDate } from '@/lib/equipment';
import {
  getNextUpcomingServiceDate,
  getServiceOpportunities,
  getServiceSummary,
} from '@/lib/queries/service-opportunities';
import {
  DEFAULT_SERVICE_WINDOW,
  SERVICE_WINDOWS,
  SERVICE_WINDOW_META,
  resolveServiceWindow,
  type ServiceWindow,
} from '@/lib/services/service-windows';
import { requireCompany } from '@/lib/session';
import { addDaysIso, describeServiceDue } from '@/lib/services/next-service-date';
import type { ServiceOpportunityRow } from '@/lib/types';
import { MarkServicedButton } from './mark-serviced-button';

export const metadata: Metadata = {
  title: 'Services',
};

type SearchParams = Record<string, string | string[] | undefined>;

type OpportunityContext = {
  today: string;
  latestServiceDate: string;
  companyDefaultInterval: number;
};

export default async function ServicesPage({ searchParams }: { searchParams: SearchParams }) {
  const { companyId, company } = await requireCompany();
  const window = resolveServiceWindow(searchParams.window);
  const includeReplaced = singleParam(searchParams.replaced) === '1';
  const today = todayIsoDate();
  const context: OpportunityContext = {
    today,
    latestServiceDate: addDaysIso(today, 1),
    companyDefaultInterval: company.default_service_interval,
  };

  const [summary, opportunities] = await Promise.all([
    getServiceSummary(companyId),
    getServiceOpportunities(companyId, window, { includeReplaced }),
  ]);

  const nextUpcoming =
    opportunities.rows.length === 0 ? await getNextUpcomingServiceDate(companyId) : null;

  const windowPhrase =
    window === 'overdue'
      ? 'the overdue list'
      : window === 'all'
        ? 'the schedule'
        : `the next ${SERVICE_WINDOW_META[window].days} days`;
  const hiddenByLimit = opportunities.total > opportunities.rows.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every unit that is due, in one working list. Logging a visit schedules the next one.
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-10 w-full sm:w-auto">
          <Link href="/dashboard/equipment">
            <Wrench className="h-4 w-4" aria-hidden="true" />
            Equipment
          </Link>
        </Button>
      </div>

      {summary.failed ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Some service numbers could not be loaded. Refresh the page to try again.
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Service summary">
        <StatCard
          label="Total customers"
          value={statValue(summary.totalCustomers)}
          detail="Active customer records"
          icon={Users}
        />
        <StatCard
          label="Active equipment"
          value={statValue(summary.totalEquipment)}
          detail="Units currently in service"
          icon={Wrench}
        />
        <StatCard
          label="Due soon"
          value={statValue(summary.dueSoon)}
          detail="Next service within 30 days"
          icon={CalendarClock}
        />
        <StatCard
          label="Overdue"
          value={statValue(summary.overdue)}
          detail="Past their next service date"
          icon={AlertTriangle}
        />
      </section>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Service window">
            {SERVICE_WINDOWS.map((option) => (
              <Button
                key={option}
                asChild
                size="sm"
                variant={option === window ? 'default' : 'outline'}
                className="min-h-10"
              >
                <Link
                  href={windowHref(option, includeReplaced)}
                  aria-current={option === window ? 'page' : undefined}
                >
                  {SERVICE_WINDOW_META[option].label}
                </Link>
              </Button>
            ))}
          </div>

          <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>
              {opportunities.error
                ? 'The service list is temporarily unavailable.'
                : opportunities.total === 0
                  ? `No units in ${windowPhrase}.`
                  : `${opportunities.total} unit${opportunities.total === 1 ? '' : 's'} in ${windowPhrase}.`}
              {hiddenByLimit ? ' Showing the first 200.' : ''}
            </p>
            <Link
              href={windowHref(window, !includeReplaced)}
              className="inline-flex min-h-10 items-center font-medium text-primary underline-offset-4 hover:underline"
            >
              {includeReplaced ? 'Hide replaced units' : 'Include replaced units'}
            </Link>
          </div>
        </CardContent>
      </Card>

      {opportunities.error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          The service list could not be loaded.{' '}
          <Link href="/dashboard/services" className="font-medium underline">
            Try again
          </Link>
        </div>
      ) : null}

      {!opportunities.error && opportunities.rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CalendarClock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="font-semibold">No equipment due in this window</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                {nextUpcoming
                  ? `The next scheduled service is ${formatDateOnly(nextUpcoming)}.`
                  : 'Nothing is scheduled yet. Add a next service date to an equipment record to start tracking it here.'}
              </p>
              {!includeReplaced ? (
                <p className="text-xs text-muted-foreground">Replaced units are hidden from this list.</p>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline" className="min-h-10">
                <Link href="/dashboard/equipment">View equipment</Link>
              </Button>
              {window !== DEFAULT_SERVICE_WINDOW ? (
                <Button asChild variant="ghost" className="min-h-10">
                  <Link href={windowHref(DEFAULT_SERVICE_WINDOW, includeReplaced)}>Back to next 30 days</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!opportunities.error && opportunities.rows.length > 0 ? (
        <>
          {/* Mobile: a card list, never a horizontally scrolling table. */}
          <div className="grid gap-3 lg:hidden">
            {opportunities.rows.map((row) => (
              <OpportunityCard
                key={row.id}
                row={row}
                context={context}
              />
            ))}
          </div>

          <Card className="hidden lg:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Equipment</TableHead>
                    <TableHead className="hidden lg:table-cell">Contact</TableHead>
                    <TableHead>Next service</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.rows.map((row) => (
                    <OpportunityTableRow key={row.id} row={row} context={context} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function OpportunityTableRow({ row, context }: { row: ServiceOpportunityRow; context: OpportunityContext }) {
  const customer = customerName(row);
  const due = describeServiceDue(row.next_service_date ?? '', context.today);

  return (
    <TableRow>
      <TableCell className="min-w-32 align-top">
        <Link
          href={`/dashboard/customers/${row.customer_id}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {customer}
        </Link>
        <span className="mt-1 block text-xs lg:hidden">{contactLinks(row)}</span>
      </TableCell>
      <TableCell className="min-w-32 align-top">
        <Link
          href={`/dashboard/equipment/${row.id}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {row.equipment_name}
        </Link>
        <span className="mt-0.5 block text-xs text-muted-foreground">{row.equipment_type}</span>
      </TableCell>
      <TableCell className="hidden align-top text-xs lg:table-cell">
        {contactLinks(row)}
      </TableCell>
      <TableCell className="align-top whitespace-nowrap">
        <span className="font-medium">{formatDateOnly(row.next_service_date)}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{relativeDays(due.days)}</span>
      </TableCell>
      <TableCell className="align-top">
        <DueBadge due={due} />
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col items-end gap-2">
          <Button asChild variant="outline" size="sm" className="min-h-9">
            <Link href={`/dashboard/equipment/${row.id}`}>View</Link>
          </Button>
          <MarkServicedButton
            equipmentId={row.id}
            equipmentName={row.equipment_name}
            customerName={customer}
            serviceInterval={row.service_interval}
            companyDefaultInterval={context.companyDefaultInterval}
            defaultServiceDate={context.today}
            latestServiceDate={context.latestServiceDate}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

function OpportunityCard({ row, context }: { row: ServiceOpportunityRow; context: OpportunityContext }) {
  const customer = customerName(row);
  const due = describeServiceDue(row.next_service_date ?? '', context.today);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <Link
              href={`/dashboard/equipment/${row.id}`}
              className="block break-words text-base font-semibold underline-offset-4 hover:underline"
            >
              {row.equipment_name}
            </Link>
            <p className="break-words text-sm text-muted-foreground">
              {row.equipment_type} ·{' '}
              <Link
                href={`/dashboard/customers/${row.customer_id}`}
                className="underline-offset-4 hover:underline"
              >
                {customer}
              </Link>
            </p>
          </div>
          <DueBadge due={due} />
        </div>

        <dl className="space-y-1 text-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Next service:</dt>
            <dd className="font-medium">
              {formatDateOnly(row.next_service_date)}{' '}
              <span className="font-normal text-muted-foreground">({relativeDays(due.days)})</span>
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Contact:</dt>
            <dd className="min-w-0 break-words">{contactLinks(row)}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button asChild variant="outline" className="min-h-10">
            <Link href={`/dashboard/equipment/${row.id}`}>View equipment</Link>
          </Button>
          <MarkServicedButton
            equipmentId={row.id}
            equipmentName={row.equipment_name}
            customerName={customer}
            serviceInterval={row.service_interval}
            companyDefaultInterval={context.companyDefaultInterval}
            defaultServiceDate={context.today}
            latestServiceDate={context.latestServiceDate}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function DueBadge({ due }: { due: ReturnType<typeof describeServiceDue> }) {
  return (
    <Badge
      variant={due.tone === 'overdue' ? 'destructive' : due.tone === 'due' ? 'default' : 'secondary'}
      className="shrink-0"
    >
      {due.label}
    </Badge>
  );
}

function contactLinks(row: ServiceOpportunityRow) {
  const customer = firstCustomer(row);
  if (!customer?.phone && !customer?.email) {
    return <span className="text-muted-foreground">No contact details</span>;
  }

  return (
    <span className="flex flex-col gap-1">
      {customer.phone ? (
        <a
          href={`tel:${encodeURIComponent(customer.phone)}`}
          className="inline-flex min-h-8 items-center break-all text-primary underline-offset-4 hover:underline"
        >
          {customer.phone}
        </a>
      ) : null}
      {customer.email ? (
        <a
          href={`mailto:${customer.email}`}
          className="inline-flex min-h-8 items-center break-all text-primary underline-offset-4 hover:underline"
        >
          {customer.email}
        </a>
      ) : null}
    </span>
  );
}

function relativeDays(days: number | null): string {
  if (days === null) return 'Date unavailable';
  if (days === 0) return 'Today';
  if (days > 0) return `In ${days} ${days === 1 ? 'day' : 'days'}`;
  const overdue = Math.abs(days);
  return `${overdue} ${overdue === 1 ? 'day' : 'days'} overdue`;
}

function firstCustomer(row: ServiceOpportunityRow) {
  return Array.isArray(row.customers) ? row.customers[0] : row.customers;
}

function customerName(row: ServiceOpportunityRow): string {
  const customer = firstCustomer(row);
  return customer ? `${customer.first_name} ${customer.last_name}` : 'Customer unavailable';
}

function singleParam(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

function windowHref(window: ServiceWindow, includeReplaced: boolean): string {
  const params = new URLSearchParams();
  params.set('window', window);
  if (includeReplaced) params.set('replaced', '1');
  return `/dashboard/services?${params.toString()}`;
}
