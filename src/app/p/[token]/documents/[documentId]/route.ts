import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isUnitPassToken } from '@/lib/public/get-unitpass';
import { DOCUMENT_BUCKET, DOCUMENT_URL_TTL, isDocumentStoragePath, sanitizeDocumentFileName } from '@/lib/storage/documents';
import { EQUIPMENT_STATUSES } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
};
const notFound = () => new Response('Not found', { status: 404, headers: { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } });

/** No cookies/auth redirect and no distinguishing errors: every denial is a plain 404. */
export async function GET(_request: Request, { params }: { params: { token: string; documentId: string } }) {
  if (!isUnitPassToken(params.token) || !isUnitPassToken(params.documentId)) return notFound();
  const token = params.token.toLowerCase();
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from('documents')
      .select('company_id, equipment_id, visibility, storage_path, file_name, equipment!inner(public_token, status, company_id)')
      .eq('id', params.documentId).eq('visibility', 'Public').eq('equipment.public_token', token).maybeSingle();
    const equipment = Array.isArray(data?.equipment) ? data.equipment[0] : data?.equipment;
    if (error || !data || !equipment || data.visibility !== 'Public'
      || equipment.public_token !== token || equipment.company_id !== data.company_id
      || !EQUIPMENT_STATUSES.includes(equipment.status)
      || !isDocumentStoragePath(data.storage_path, data.company_id, data.equipment_id) || !data.file_name) return notFound();
    // Replaced units are still readable in the existing public passport. Their
    // historical public documents follow that same rule; no special bypass.
    const { data: signed, error: signingError } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(
      data.storage_path, DOCUMENT_URL_TTL, { download: sanitizeDocumentFileName(data.file_name) }
    );
    if (signingError || !signed?.signedUrl) return notFound();
    return new Response(null, { status: 307, headers: { ...HEADERS, Location: signed.signedUrl } });
  } catch {
    console.error('[documents] Public download unavailable.');
    return notFound();
  }
}
