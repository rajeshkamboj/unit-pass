import 'server-only';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { DocumentListRow } from '@/lib/types';

// Storage keys and legacy URLs are deliberately not sent to list/client components.
export const DOCUMENT_LIST_COLUMNS = 'id, equipment_id, name, type, visibility, file_name, mime_type, file_size, created_at, updated_at, equipment (equipment_name)';
export async function getEquipmentDocuments(equipmentId: string, companyId: string) {
  const { data, error, count } = await getSupabaseServerClient().from('documents')
    .select(DOCUMENT_LIST_COLUMNS, { count: 'exact' }).eq('equipment_id', equipmentId).eq('company_id', companyId)
    .order('created_at', { ascending: false }).order('id').limit(100);
  if (error) console.error('[documents] Equipment document list failed:', error.message);
  return { rows: (data ?? []) as unknown as DocumentListRow[], error: Boolean(error), count: count ?? 0 };
}
