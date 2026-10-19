import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { ArchiveCustomerButton } from './archive-customer-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/session';
import { buildCustomerSearchFilter, MAX_CUSTOMER_SEARCH_LENGTH } from '@/lib/customer-search';
import type { CustomerListRow } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Customers',
};

const PAGE_SIZE = 25;
const MAX_PAGE = 1_000_000;
const CUSTOMER_COLUMNS =
  'id, first_name, last_name, email, phone, city, state, archived_at, created_at, updated_at';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const { companyId } = await requireCompany();
  const rawSearch = singleParam(searchParams.q);
  const searchTerm = rawSearch.trim();
  const searchIsValid = Array.from(searchTerm).length <= MAX_CUSTOMER_SEARCH_LENGTH;
  const includeArchived = singleParam(searchParams.includeArchived) === 'true';
  const page = parsePage(singleParam(searchParams.page));

  let customers: CustomerListRow[] = [];
  let totalCount = 0;
  let loadError: string | null = null;

  if (searchIsValid) {
    const supabase = getSupabaseServerClient();
    let query = supabase
      .from('customers')
      .select(CUSTOMER_COLUMNS, { count: 'exact' })
      .eq('company_id', companyId);

    if (!includeArchived) query = query.is('archived_at', null);
    if (searchTerm) query = query.or(buildCustomerSearchFilter(searchTerm));

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await query
      .order('last_name', { ascending: true, nullsFirst: false })
      .order('first_name', { ascending: true })
      .range(from, to);

    if (error) {
      console.error('[customers] Failed to load customer list:', error.message);
      loadError = 'Customers could not be loaded. Please try again.';
    } else {
      customers = (data ?? []) as CustomerListRow[];
      totalCount = count ?? 0;
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const firstRow = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the homeowners and contacts your company serves.
          </p>
        </div>
        <Button asChild className="min-h-10 w-full sm:w-auto">
          <Link href="/dashboard/customers/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add customer
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <form method="get" action="/dashboard/customers" className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="customer-search">Search customers</Label>
                <Input
                  id="customer-search"
                  type="search"
                  name="q"
                  maxLength={MAX_CUSTOMER_SEARCH_LENGTH}
                  defaultValue={searchTerm}
                  placeholder="Name, email, or phone"
                  className="min-h-10"
                />
              </div>
              <div className="flex flex-col justify-end gap-2 sm:items-end">
                <Label className="flex min-h-10 items-center gap-2 text-sm font-normal">
                  <input
                    type="checkbox"
                    name="includeArchived"
                    value="true"
                    defaultChecked={includeArchived}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  Include archived
                </Label>
                <Button type="submit" variant="outline" className="min-h-10 w-full sm:w-auto">
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Search
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {!searchIsValid ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Search terms must be {MAX_CUSTOMER_SEARCH_LENGTH} characters or fewer. Shorten the search and try again.
        </div>
      ) : null}

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {loadError} <Link href="/dashboard/customers" className="font-medium underline">Refresh the list</Link>
        </div>
      ) : null}

      {!loadError && searchIsValid && customers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Search className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="font-semibold">{totalCount === 0 ? 'No customers yet' : 'No customers on this page'}</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                {totalCount === 0
                  ? searchTerm || includeArchived
                    ? 'No customers match these filters. Try a different search or add a customer.'
                    : 'Add your first customer to start building your company records.'
                  : 'Try another page or adjust the search filters.'}
              </p>
            </div>
            {totalCount === 0 ? (
              <div className="flex flex-wrap justify-center gap-2">
                {(searchTerm || includeArchived) ? (
                  <Button asChild variant="outline" className="min-h-10">
                    <Link href="/dashboard/customers">Clear filters</Link>
                  </Button>
                ) : null}
                <Button asChild className="min-h-10">
                  <Link href="/dashboard/customers/new">Add customer</Link>
                </Button>
              </div>
            ) : page > 1 ? (
              <Button asChild variant="outline" className="min-h-10">
                <Link href={pageHref(page - 1, searchTerm, includeArchived)}>Previous page</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {customers.length > 0 ? (
        <>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {firstRow}–{lastRow} of {totalCount} {totalCount === 1 ? 'customer' : 'customers'}
            </p>
            {includeArchived ? <p>Active and archived records</p> : <p>Active records only</p>}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {customers.map((customer) => (
              <CustomerCard key={customer.id} customer={customer} />
            ))}
          </div>

          <nav className="flex items-center justify-between gap-3 border-t pt-4" aria-label="Customer pages">
            {page > 1 ? (
              <Button asChild variant="outline" className="min-h-10">
                <Link href={pageHref(page - 1, searchTerm, includeArchived)}>Previous</Link>
              </Button>
            ) : (
              <span />
            )}
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            {page < totalPages ? (
              <Button asChild variant="outline" className="min-h-10">
                <Link href={pageHref(page + 1, searchTerm, includeArchived)}>Next</Link>
              </Button>
            ) : (
              <span />
            )}
          </nav>
        </>
      ) : null}
    </div>
  );
}

function CustomerCard({ customer }: { customer: CustomerListRow }) {
  const name = `${customer.first_name} ${customer.last_name}`;
  const cityState = [customer.city, customer.state].filter(Boolean).join(', ');

  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <Link
              href={`/dashboard/customers/${customer.id}`}
              className="block min-h-10 break-words py-2 text-base font-semibold underline-offset-4 hover:underline"
            >
              {name}
            </Link>
            {cityState ? <p className="text-sm text-muted-foreground">{cityState}</p> : null}
          </div>
          <Badge variant={customer.archived_at ? 'secondary' : 'outline'} className="shrink-0">
            {customer.archived_at ? 'Archived' : 'Active'}
          </Badge>
        </div>

        <div className="min-h-[3rem] space-y-1 text-sm">
          {customer.email ? (
            <a
              href={`mailto:${customer.email}`}
              className="block min-h-10 break-all py-2 text-primary underline-offset-4 hover:underline"
            >
              {customer.email}
            </a>
          ) : null}
          {customer.phone ? (
            <a
              href={`tel:${encodeURIComponent(customer.phone)}`}
              className="block min-h-10 py-2 text-primary underline-offset-4 hover:underline"
            >
              {customer.phone}
            </a>
          ) : null}
          {!customer.email && !customer.phone ? (
            <span className="text-muted-foreground">No contact details</span>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
          <Button asChild variant="outline" className="min-h-10">
            <Link href={`/dashboard/customers/${customer.id}`}>View</Link>
          </Button>
          <ArchiveCustomerButton customerId={customer.id} archived={Boolean(customer.archived_at)} compact />
        </div>
      </CardContent>
    </Card>
  );
}

function singleParam(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

function parsePage(value: string): number {
  if (!/^\d+$/.test(value)) return 1;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_PAGE) return 1;
  return parsed;
}

function pageHref(page: number, searchTerm: string, includeArchived: boolean): string {
  const params = new URLSearchParams();
  if (searchTerm) params.set('q', searchTerm);
  if (includeArchived) params.set('includeArchived', 'true');
  params.set('page', String(page));
  return `/dashboard/customers?${params.toString()}`;
}
