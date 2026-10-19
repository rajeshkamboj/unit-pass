'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser, getUserMembership } from '@/lib/session';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { documentSchema, type DocumentField } from '@/lib/validation/document';
import {
  DOCUMENT_BUCKET, DOCUMENT_URL_TTL, documentFileError, isDocumentStoragePath, sanitizeDocumentFileName,
} from '@/lib/storage/documents';
import type { DocumentVisibility } from '@/lib/types';

export type DocumentActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<Record<DocumentField, string>>;
  signedUrl?: string;
};
const uuidSchema = z.string().uuid();

async function context() {
  const user = await requireUser();
  const membership = await getUserMembership(user.id);
  if (!membership) redirect('/dashboard/setup-company');
  return { user, membership, supabase: getSupabaseServerClient() };
}

function parseMetadata(form: FormData) {
  return documentSchema.safeParse({ name: form.get('name'), type: form.get('type'), visibility: form.get('visibility') });
}
function fieldErrors(error: z.ZodError): DocumentActionResult {
  return { ok: false, fieldErrors: Object.fromEntries(Object.entries(error.flatten().fieldErrors)
    .flatMap(([key, messages]) => messages?.[0] ? [[key, messages[0]]] : [])) };
}
function visibilityError(form: FormData, next: DocumentVisibility, previous?: DocumentVisibility): DocumentActionResult | null {
  if ((previous ? next !== previous : next === 'Public') && form.get('confirm_visibility') !== 'yes') {
    return { ok: false, error: 'Confirm the visibility choice. If this document changed in another session, refresh the list first.', fieldErrors: { confirm_visibility: 'Confirm who will be able to see this document.' } };
  }
  return null;
}
function revalidateDocuments(equipmentId: string) {
  revalidatePath('/dashboard/documents');
  revalidatePath(`/dashboard/equipment/${equipmentId}`);
  revalidatePath('/p/[token]', 'page');
}

/** Member client only: uploads and dashboard mutations are subject to storage AND table RLS. */
export async function uploadDocument(form: FormData): Promise<DocumentActionResult> {
  const { user, membership, supabase } = await context();
  const equipmentId = uuidSchema.safeParse(form.get('equipment_id'));
  if (!equipmentId.success) return { ok: false, fieldErrors: { equipment_id: 'Choose equipment in your company.' } };
  const metadata = parseMetadata(form);
  if (!metadata.success) return fieldErrors(metadata.error);
  const confirmationError = visibilityError(form, metadata.data.visibility);
  if (confirmationError) return confirmationError;

  const { data: equipment, error: equipmentError } = await supabase.from('equipment').select('id')
    .eq('id', equipmentId.data).eq('company_id', membership.companyId).maybeSingle();
  if (equipmentError || !equipment) return { ok: false, error: 'Equipment not found or you do not have access to it.' };
  const file = form.get('file');
  if (!(file instanceof File)) return { ok: false, fieldErrors: { file: 'Choose a file to upload.' } };
  const metadataError = documentFileError(file);
  if (metadataError) return { ok: false, fieldErrors: { file: metadataError } };

  let header: Uint8Array;
  try { header = new Uint8Array(await file.slice(0, 12).arrayBuffer()); }
  catch { return { ok: false, fieldErrors: { file: 'This file could not be read. Please choose it again.' } }; }
  const signatureError = documentFileError(file, header);
  if (signatureError) return { ok: false, fieldErrors: { file: signatureError } };

  const fileName = sanitizeDocumentFileName(file.name);
  const path = `${membership.companyId}/${equipment.id}/${randomUUID()}-${fileName}`;
  const bucket = supabase.storage.from(DOCUMENT_BUCKET);
  try {
    const { error: uploadError } = await bucket.upload(path, file, { contentType: file.type, upsert: false, cacheControl: '0' });
    if (uploadError) {
      console.error('[documents] Upload failed:', uploadError.message);
      return { ok: false, error: 'The file could not be uploaded. Check the private documents bucket configuration and try again.' };
    }
    const { data, error } = await supabase.from('documents').insert({
      equipment_id: equipment.id,
      ...metadata.data,
      storage_path: path, file_name: fileName, mime_type: file.type, file_size: file.size, uploaded_by: user.id,
      // No company_id or legacy file_url from the form. The trigger resolves tenancy.
    }).select('id').single();
    if (error || !data) throw new Error('Document row insert failed.');
  } catch {
    // Compensation also runs after a network exception; the unique key is ours.
    let cleanupFailed = false;
    try { const { error } = await bucket.remove([path]); cleanupFailed = Boolean(error); }
    catch { cleanupFailed = true; }
    if (cleanupFailed) console.error('[documents] Orphan upload needs administrator cleanup:', path);
    return { ok: false, error: cleanupFailed
      ? 'The record could not be saved, and temporary file cleanup failed. Ask an administrator to remove the orphaned upload (recorded in the server logs) before retrying.'
      : 'The document could not be saved. The temporary upload was removed. Please try again.' };
  }
  revalidateDocuments(equipment.id);
  return { ok: true };
}

async function findDocument(id: string, companyId: string, supabase: ReturnType<typeof getSupabaseServerClient>) {
  const { data, error } = await supabase.from('documents')
    .select('id, equipment_id, company_id, visibility, storage_path, file_name')
    .eq('id', id).eq('company_id', companyId).maybeSingle();
  if (error) console.error('[documents] Document lookup failed:', error.message);
  return error ? null : data;
}

export async function updateDocument(id: string, form: FormData): Promise<DocumentActionResult> {
  const { membership, supabase } = await context();
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: 'Document not found.' };
  const metadata = parseMetadata(form);
  if (!metadata.success) return fieldErrors(metadata.error);
  const existing = await findDocument(id, membership.companyId, supabase);
  if (!existing) return { ok: false, error: 'Document not found or you do not have access to it.' };
  if (!isDocumentStoragePath(existing.storage_path, membership.companyId, existing.equipment_id)) {
    return { ok: false, error: 'This legacy document must be re-uploaded into private storage before it can be edited or shared.' };
  }
  const confirmationError = visibilityError(form, metadata.data.visibility, existing.visibility as DocumentVisibility);
  if (confirmationError) return confirmationError;
  const { data, error } = await supabase.from('documents').update(metadata.data)
    .eq('id', id).eq('company_id', membership.companyId)
    // Do not silently overwrite a concurrent visibility change without confirmation.
    .eq('visibility', existing.visibility).select('id').maybeSingle();
  if (error || !data) return { ok: false, error: 'The document could not be updated. Refresh the list and try again.' };
  revalidateDocuments(existing.equipment_id);
  return { ok: true };
}

export async function downloadDocument(id: string): Promise<DocumentActionResult> {
  const { membership, supabase } = await context();
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: 'Document not found.' };
  const existing = await findDocument(id, membership.companyId, supabase);
  if (!existing) return { ok: false, error: 'Document not found or you do not have access to it.' };
  if (!isDocumentStoragePath(existing.storage_path, membership.companyId, existing.equipment_id) || !existing.file_name) {
    return { ok: false, error: 'This legacy file must be re-uploaded into private storage before it can be downloaded.' };
  }
  const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(
    existing.storage_path, DOCUMENT_URL_TTL, { download: sanitizeDocumentFileName(existing.file_name) }
  );
  if (error || !data?.signedUrl) return { ok: false, error: 'A download link could not be created. The file may have been removed. Refresh and try again.' };
  return { ok: true, signedUrl: data.signedUrl };
}

/** Storage first, then row. If row cleanup fails, retrying is safe (remove is idempotent). */
export async function deleteDocument(id: string): Promise<DocumentActionResult> {
  const { membership, supabase } = await context();
  if (!uuidSchema.safeParse(id).success) return { ok: false, error: 'Document not found.' };
  const existing = await findDocument(id, membership.companyId, supabase);
  if (!existing) return { ok: false, error: 'Document not found or you do not have access to it.' };
  if (existing.storage_path !== null) {
    if (!isDocumentStoragePath(existing.storage_path, membership.companyId, existing.equipment_id)) {
      return { ok: false, error: 'This file has an invalid storage path. Ask an administrator to repair it; no data was deleted.' };
    }
    const { error } = await supabase.storage.from(DOCUMENT_BUCKET).remove([existing.storage_path]);
    if (error) return { ok: false, error: 'The file could not be deleted. The document record has been kept. Please try again.' };
  }
  const { error } = await supabase.from('documents').delete().eq('id', id).eq('company_id', membership.companyId);
  revalidateDocuments(existing.equipment_id);
  if (error) return { ok: false, error: 'The stored file was removed, but its record could not be deleted. Retry Delete to remove the remaining entry. Downloads are no longer available.' };
  // Legacy external file_url is intentionally never followed/deleted by this action.
  return { ok: true };
}
