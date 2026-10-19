import type { Metadata } from 'next';
import Link from 'next/link';
import { Archive, ArrowRight, Building2, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/session';
import type { CustomerListRow } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Dashboard',
};

const RECENT_CUSTOMER_COLUMNS = 'id, first_name, last_name, email, phone, city, state, archived_at, created_at, updated_at';

export default async function DashboardPage() {
  const { company, companyId } = await requireCompany();
  const supabase = getSupabaseServerClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const [activeResult, newResult, archivedResult, recentResult] = await Promise.all([
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .is('archived_at', null),
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .is('archived_at', null)
      .gte('created_at', monthStart),
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .not('archived_at', 'is', null),
    supabase
      .from('customers')
      .select(RECENT_CUSTOMER_COLUMNS)
      .eq('company_id', companyId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const queryErrors = [activeResult.error, newResult.error, archivedResult.error, recentResult.error].filter(Boolean);
  if (queryErrors.length > 0) {
    queryErrors.forEach((error) => console.error('[dashboard] Failed to load customer summary:', error?.message));
  }
  const customerDataFailed = queryErrors.length > 0;
  const recentCustomers = (recentResult.data ?? []) as CustomerListRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{company.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Company overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">A quick view of your company and customer records.</p>
        </div>
        <Button asChild className="min-h-10 w-full sm:w-auto">
          <Link href="/dashboard/customers/new">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Add customer
          </Link>
        </Button>
      </div>

      {customerDataFailed ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Customer summary could not be loaded. Refresh the page to try again.
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Customer summary">
        <SummaryCard
          label="Total active customers"
          value={customerDataFailed ? '—' : String(activeResult.count ?? 0)}
          detail="Available in your customer list"
          icon={Users}
        />
        <SummaryCard
          label="New customers this month"
          value={customerDataFailed ? '—' : String(newResult.count ?? 0)}
          detail="Active customers added this month"
          icon={UserPlus}
        />
        <SummaryCard
          label="Archived customers"
          value={customerDataFailed ? '—' : String(archivedResult.count ?? 0)}
          detail="Records retained for your company"
          icon={Archive}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Company and recent customers">
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
            {customerDataFailed ? (
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

      <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Next: add equipment (available in a later release).
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function ProfileLine({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] gap-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words font-medium">{value || <span className="font-normal text-muted-foreground">Not set</span>}</span>
    </div>
  );
}
