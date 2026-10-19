import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { requireCompany } from '@/lib/session';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { DOCUMENT_LIST_COLUMNS } from '@/lib/queries/documents';
import { DOCUMENT_TYPES, DOCUMENT_VISIBILITIES, type DocumentEquipmentOption, type DocumentListRow } from '@/lib/types';
import { DocumentFormDialog } from './upload-form';
import { DocumentList } from './document-list';

export const metadata: Metadata = { title: 'Documents' };
const PAGE_SIZE = 25;
const selectClass = 'min-h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm';
const single = (value: string | string[] | undefined) => typeof value === 'string' ? value : '';

export default async function DocumentsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const { companyId } = await requireCompany();
  const supabase = getSupabaseServerClient();
  const equipment = z.string().uuid().safeParse(single(searchParams.equipment));
  const type = z.enum(DOCUMENT_TYPES).safeParse(single(searchParams.type));
  const visibility = z.enum(DOCUMENT_VISIBILITIES).safeParse(single(searchParams.visibility));
  const parsedPage = Number(single(searchParams.page));
  const page = Number.isSafeInteger(parsedPage) && parsedPage >= 1 && parsedPage <= 1_000_000 ? parsedPage : 1;
  const filters = {
    equipment: equipment.success ? equipment.data : '', type: type.success ? type.data : '', visibility: visibility.success ? visibility.data : '',
  };
  const hasFilters = Object.values(filters).some(Boolean);
  let query = supabase.from('documents').select(DOCUMENT_LIST_COLUMNS, { count: 'exact' }).eq('company_id', companyId);
  if (filters.equipment) query = query.eq('equipment_id', filters.equipment);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.visibility) query = query.eq('visibility', filters.visibility);
  const [result, optionsResult] = await Promise.all([
    query.order('created_at', { ascending: false }).order('id').range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('equipment').select('id, equipment_name').eq('company_id', companyId).order('equipment_name').limit(1000),
  ]);
  if (result.error || optionsResult.error) throw new Error('Unable to load documents. Please try again.');
  const documents = (result.data ?? []) as unknown as DocumentListRow[];
  const options = (optionsResult.data ?? []) as DocumentEquipmentOption[];
  const total = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  function pageHref(next: number) {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)));
    params.set('page', String(next));
    return `/dashboard/documents?${params.toString()}`;
  }
  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">Manuals, warranties and reports for every unit. Private by default, shared only by choice.</p>
        </div>
        <DocumentFormDialog equipmentOptions={options} />
      </div>
      {options.length === 0 ? <p className="text-sm text-muted-foreground">Add <Link href="/dashboard/equipment/new" className="font-medium underline">equipment</Link> before uploading a document.</p> : null}
      <Card><CardContent className="p-4">
        <form method="get" action="/dashboard/documents" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="min-w-0 space-y-2"><Label htmlFor="filter-equipment">Equipment</Label>
              <select id="filter-equipment" name="equipment" defaultValue={filters.equipment} className={selectClass}>
                <option value="">All equipment</option>
                {options.map((item) => <option key={item.id} value={item.id}>{item.equipment_name}</option>)}
              </select>
            </div>
            <div className="space-y-2"><Label htmlFor="filter-type">Type</Label>
              <select id="filter-type" name="type" defaultValue={filters.type} className={selectClass}>
                <option value="">All types</option>{DOCUMENT_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <div className="space-y-2"><Label htmlFor="filter-visibility">Visibility</Label>
              <select id="filter-visibility" name="visibility" defaultValue={filters.visibility} className={selectClass}>
                <option value="">Public and Private</option>{DOCUMENT_VISIBILITIES.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2"><Button type="submit" variant="outline">Apply filters</Button>
            {hasFilters ? <Button asChild variant="ghost"><Link href="/dashboard/documents">Clear filters</Link></Button> : null}
          </div>
        </form>
      </CardContent></Card>
      {documents.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <FileText className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-semibold">{total > 0 ? 'No documents on this page' : hasFilters ? 'No documents match these filters' : 'No documents yet'}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">{hasFilters ? 'Try another equipment, type or visibility filter.' : 'Upload a warranty, manual or service report from here or the equipment detail page.'}</p>
          {page > 1 ? <Button asChild variant="outline"><Link href={pageHref(1)}>First page</Link></Button> : null}
        </CardContent></Card>
      ) : <><p className="text-sm text-muted-foreground">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} documents</p><DocumentList documents={documents} /></>}
      {totalPages > 1 ? (
        <nav aria-label="Document pages" className="flex items-center justify-between gap-3 border-t pt-4">
          {page > 1 ? <Button asChild variant="outline"><Link href={pageHref(page - 1)}>Previous</Link></Button> : <span />}
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          {page < totalPages ? <Button asChild variant="outline"><Link href={pageHref(page + 1)}>Next</Link></Button> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
