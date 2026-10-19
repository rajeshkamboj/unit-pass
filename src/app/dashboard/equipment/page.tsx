import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, QrCode, Search, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/session';
import { buildEquipmentSearchFilter, MAX_EQUIPMENT_SEARCH_LENGTH } from '@/lib/equipment-search';
import {
  EQUIPMENT_STATUSES,
  EQUIPMENT_TYPES,
  type CustomerOption,
  type EquipmentListRow,
  type EquipmentStatus,
  type EquipmentType,
} from '@/lib/types';

export const metadata: Metadata = {
  title: 'Equipment',
};

const PAGE_SIZE = 25;
const MAX_PAGE = 1_000_000;
const EQUIPMENT_LIST_COLUMNS =
  'id, customer_id, equipment_name, equipment_type, manufacturer, model_number, serial_number, next_service_date, status, public_token, created_at, updated_at, customers (first_name, last_name)';
const CUSTOMER_OPTION_COLUMNS = 'id, first_name, last_name';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function EquipmentPage({ searchParams }: { searchParams: SearchParams }) {
  const { companyId } = await requireCompany();
  const supabase = getSupabaseServerClient();

  const rawSearch = singleParam(searchParams.q);
  const searchTerm = rawSearch.trim();
  const searchIsValid = Array.from(searchTerm).length <= MAX_EQUIPMENT_SEARCH_LENGTH;
  const customerFilter = parseUuid(singleParam(searchParams.customer));
  const typeFilter = parseType(singleParam(searchParams.type));
  const statusFilter = parseStatus(singleParam(searchParams.status));
  const page = parsePage(singleParam(searchParams.page));

  const customerOptionsResult = await supabase
    .from('customers')
    .select(CUSTOMER_OPTION_COLUMNS)
    .eq('company_id', companyId)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
    .limit(1000);
  const customerOptions = (customerOptionsResult.data ?? []) as CustomerOption[];

  let equipment: EquipmentListRow[] = [];
  let totalCount = 0;
  let loadError: string | null = null;

  if (searchIsValid) {
    let query = supabase
      .from('equipment')
      .select(EQUIPMENT_LIST_COLUMNS, { count: 'exact' })
      .eq('company_id', companyId);

    if (customerFilter) query = query.eq('customer_id', customerFilter);
    if (typeFilter) query = query.eq('equipment_type', typeFilter);
    if (statusFilter) query = query.eq('status', statusFilter);
    if (searchTerm) query = query.or(buildEquipmentSearchFilter(searchTerm));

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await query
      // Enum order is Active → Inactive → Replaced, so active units come first.
      .order('status', { ascending: true })
      .order('next_service_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[equipment] Failed to load equipment list:', error.message);
      loadError = 'Equipment could not be loaded. Please try again.';
    } else {
      equipment = (data ?? []) as unknown as EquipmentListRow[];
      totalCount = count ?? 0;
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const firstRow = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, totalCount);
  const filters = {
    q: searchTerm,
    customer: customerFilter,
    type: typeFilter,
    status: statusFilter,
  };
  const hasFilters = Boolean(searchTerm || customerFilter || typeFilter || statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipment</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every unit gets a permanent QR code that opens its public UnitPass.
          </p>
        </div>
        <Button asChild className="min-h-10 w-full sm:w-auto">
          <Link href="/dashboard/equipment/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add equipment
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <form method="get" action="/dashboard/equipment" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="equipment-search">Search equipment</Label>
              <Input
                id="equipment-search"
                type="search"
                name="q"
                maxLength={MAX_EQUIPMENT_SEARCH_LENGTH}
                defaultValue={searchTerm}
                placeholder="Name, manufacturer, model, or serial number"
                className="min-h-10"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="equipment-filter-customer">Customer</Label>
                <select
                  id="equipment-filter-customer"
                  name="customer"
                  defaultValue={customerFilter ?? ''}
                  className="flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All customers</option>
                  {customerOptions.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.last_name}, {customer.first_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="equipment-filter-type">Type</Label>
                <select
                  id="equipment-filter-type"
                  name="type"
                  defaultValue={typeFilter ?? ''}
                  className="flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All types</option>
                  {EQUIPMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="equipment-filter-status">Status</Label>
                <select
                  id="equipment-filter-status"
                  name="status"
                  defaultValue={statusFilter ?? ''}
                  className="flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All statuses</option>
                  {EQUIPMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {hasFilters ? (
                <Button asChild variant="ghost" className="min-h-10 w-full sm:w-auto">
                  <Link href="/dashboard/equipment">Clear filters</Link>
                </Button>
              ) : null}
              <Button type="submit" variant="outline" className="min-h-10 w-full sm:w-auto">
                <Search className="h-4 w-4" aria-hidden="true" />
                Apply filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {!searchIsValid ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Search terms must be {MAX_EQUIPMENT_SEARCH_LENGTH} characters or fewer. Shorten the search and try again.
        </div>
      ) : null}

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {loadError}{' '}
          <Link href="/dashboard/equipment" className="font-medium underline">
            Refresh the list
          </Link>
        </div>
      ) : null}

      {!loadError && searchIsValid && equipment.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Wrench className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="font-semibold">
                {totalCount === 0 ? (hasFilters ? 'No equipment matches these filters' : 'No equipment yet') : 'No equipment on this page'}
              </h2>
              <p className="max-w-md text-sm text-muted-foreground">
                {totalCount === 0
                  ? hasFilters
                    ? 'Try a different search or clear the filters.'
                    : 'Add your first unit to generate its permanent QR code and public UnitPass.'
                  : 'Try another page or adjust the filters.'}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {hasFilters ? (
                <Button asChild variant="outline" className="min-h-10">
                  <Link href="/dashboard/equipment">Clear filters</Link>
                </Button>
              ) : null}
              {totalCount === 0 && !hasFilters ? (
                <Button asChild className="min-h-10">
                  <Link href="/dashboard/equipment/new">Add equipment</Link>
                </Button>
              ) : page > 1 ? (
                <Button asChild variant="outline" className="min-h-10">
                  <Link href={pageHref(page - 1, filters)}>Previous page</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {equipment.length > 0 ? (
        <>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {firstRow}–{lastRow} of {totalCount} {totalCount === 1 ? 'unit' : 'units'}
            </p>
            <p>Ordered by status, then next service date</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {equipment.map((item) => (
              <EquipmentCard key={item.id} item={item} />
            ))}
          </div>

          <nav className="flex items-center justify-between gap-3 border-t pt-4" aria-label="Equipment pages">
            {page > 1 ? (
              <Button asChild variant="outline" className="min-h-10">
                <Link href={pageHref(page - 1, filters)}>Previous</Link>
              </Button>
            ) : (
              <span />
            )}
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Button asChild variant="outline" className="min-h-10">
                <Link href={pageHref(page + 1, filters)}>Next</Link>
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

function EquipmentCard({ item }: { item: EquipmentListRow }) {
  const customer = joinCustomer(item.customers);
  const model = [item.manufacturer, item.model_number].filter(Boolean).join(' · ');

  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <Link
              href={`/dashboard/equipment/${item.id}`}
              className="block min-h-10 break-words py-2 text-base font-semibold underline-offset-4 hover:underline"
            >
              {item.equipment_name}
            </Link>
            {customer ? (
              <p className="break-words text-sm text-muted-foreground">
                <Link
                  href={`/dashboard/customers/${item.customer_id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {customer}
                </Link>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Customer unavailable</p>
            )}
          </div>
          <Badge variant={statusVariant(item.status)} className="shrink-0">
            {item.status}
          </Badge>
        </div>

        <div className="space-y-1 text-sm">
          <p className="font-medium">{item.equipment_type}</p>
          {model ? <p className="text-muted-foreground">{model}</p> : null}
          {item.serial_number ? (
            <p className="text-muted-foreground">Serial {item.serial_number}</p>
          ) : null}
          <p className="text-muted-foreground">
            {item.next_service_date
              ? `Next service ${formatDate(item.next_service_date)}`
              : 'No next service date'}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
          <Button asChild variant="outline" className="min-h-10">
            <Link href={`/dashboard/equipment/${item.id}`}>View</Link>
          </Button>
          <Button asChild variant="ghost" className="min-h-10">
            <Link href={`/dashboard/equipment/${item.id}/qr`}>
              <QrCode className="h-4 w-4" aria-hidden="true" />
              QR code
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function statusVariant(status: EquipmentStatus): 'outline' | 'secondary' | 'destructive' {
  if (status === 'Active') return 'outline';
  if (status === 'Replaced') return 'destructive';
  return 'secondary';
}

function joinCustomer(
  customers: EquipmentListRow['customers'] | null
): string | null {
  const row = Array.isArray(customers) ? customers[0] : customers;
  if (!row) return null;
  return `${row.first_name} ${row.last_name}`;
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
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

function parseUuid(value: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

function parseType(value: string): EquipmentType | null {
  return EQUIPMENT_TYPES.includes(value as EquipmentType) ? (value as EquipmentType) : null;
}

function parseStatus(value: string): EquipmentStatus | null {
  return EQUIPMENT_STATUSES.includes(value as EquipmentStatus) ? (value as EquipmentStatus) : null;
}

type Filters = {
  q: string;
  customer: string | null;
  type: EquipmentType | null;
  status: EquipmentStatus | null;
};

function pageHref(page: number, filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.customer) params.set('customer', filters.customer);
  if (filters.type) params.set('type', filters.type);
  if (filters.status) params.set('status', filters.status);
  params.set('page', String(page));
  return `/dashboard/equipment?${params.toString()}`;
}
