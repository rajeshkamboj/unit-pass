import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Building2, CalendarClock, UserPlus, Users, Wrench } from 'lucide-react';
import { StatCard, statValue } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatDateOnly } from '@/lib/equipment';
import { getServiceSummary, getUpcomingServices } from '@/lib/queries/service-opportunities';
import { requireCompany } from '@/lib/session';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { CustomerListRow } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Dashboard',
};

const RECENT_CUSTOMER_COLUMNS = 'id, first_name, last_name, email, phone, city, state, archived_at, created_at, updated_at';

export default async function DashboardPage() {
  const { company, companyId } = await requireCompany();
  const supabase = getSupabaseServerClient();

  const [summary, upcomingResult, recentResult] = await Promise.all([
    getServiceSummary(companyId),
    getUpcomingServices(companyId, 5),
    supabase
      .from('customers')
      .select(RECENT_CUSTOMER_COLUMNS)
      .eq('company_id', companyId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  if (recentResult.error) {
    console.error('[dashboard] Failed to load recent customers:', recentResult.error.message);
  }

  const recentCustomers = (recentResult.data ?? []) as CustomerListRow[];
  const serviceDataFailed = summary.failed;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{company.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Company overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customers, equipment and the service visits that need attention.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="min-h-10 w-full sm:w-auto">
            <Link href="/dashboard/services">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              View services
            </Link>
          </Button>
          <Button asChild className="min-h-10 w-full sm:w-auto">
            <Link href="/dashboard/customers/new">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Add customer
            </Link>
          </Button>
        </div>
      </div>

      {serviceDataFailed ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Some dashboard numbers could not be loaded. Refresh the page to try again.
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Company summary">
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

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Upcoming services, company and recent customers">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className="text-lg">Upcoming services</CardTitle>
              <CardDescription>The next five scheduled visits</CardDescription>
            </div>
            <Button asChild variant="ghost" className="min-h-10 shrink-0">
              <Link href="/dashboard/services" aria-label="Open the services list">
                Services <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingResult.error ? (
              <p className="text-sm text-muted-foreground">Upcoming services are temporarily unavailable.</p>
            ) : upcomingResult.rows.length > 0 ? (
              <ul className="divide-y">
                {upcomingResult.rows.map((item) => {
                  const customer = Array.isArray(item.customers) ? item.customers[0] : item.customers;
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/dashboard/equipment/${item.id}`}
                        className="flex min-h-14 flex-wrap items-center justify-between gap-2 py-3"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {item.equipment_name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {customer ? `${customer.first_name} ${customer.last_name} · ` : ''}
                            {item.equipment_type}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-medium">
                          {formatDateOnly(item.next_service_date)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="rounded-md border border-dashed px-4 py-6 text-center">
                <CalendarClock className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Nothing scheduled yet. Add a next service date to an equipment record.
                </p>
                <Button asChild variant="link" className="mt-1 min-h-10">
                  <Link href="/dashboard/equipment">View equipment</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className="text-lg">Your company</CardTitle>
              <CardDescription>Company contact and service information</CardDescription>
            </div>
            <Button asChild variant="outline" className="min-h-10 shrink-0">
              <Link href="/dashboard/settings">Settings</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <ProfileLine label="Company name" value={company.name} />
            <ProfileLine label="Contact" value={company.contact_name} />
            <ProfileLine label="Phone" value={company.phone} />
            <ProfileLine label="Email" value={company.email} />
            <ProfileLine label="Website" value={company.website} />
            <ProfileLine label="Address" value={company.address} />
            <ProfileLine label="Service booking" value={company.service_booking_url} />
            <ProfileLine
              label="Default service interval"
              value={`${company.default_service_interval} ${company.default_service_interval === 1 ? 'month' : 'months'}`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className="text-lg">Recent customers</CardTitle>
              <CardDescription>Latest active customer records</CardDescription>
            </div>
            <Button asChild variant="ghost" className="min-h-10 shrink-0">
              <Link href="/dashboard/customers" aria-label="View all customers">
                View all <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentResult.error ? (
              <p className="text-sm text-muted-foreground">Recent customers are temporarily unavailable.</p>
            ) : recentCustomers.length > 0 ? (
              <ul className="divide-y">
                {recentCustomers.map((customer) => {
                  const cityState = [customer.city, customer.state].filter(Boolean).join(', ');
                  return (
                    <li key={customer.id}>
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        className="flex min-h-14 items-center justify-between gap-3 py-3"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {customer.first_name} {customer.last_name}
                          </span>
                          {cityState ? (
                            <span className="block truncate text-xs text-muted-foreground">{cityState}</span>
                          ) : null}
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="rounded-md border border-dashed px-4 py-6 text-center">
                <Building2 className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <p className="mt-2 text-sm text-muted-foreground">Your recent customers will appear here.</p>
                <Button asChild variant="link" className="mt-1 min-h-10">
                  <Link href="/dashboard/customers/new">Add your first customer</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ProfileLine({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] gap-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words font-medium">
        {value || <span className="font-normal text-muted-foreground">Not set</span>}
      </span>
    </div>
  );
}
