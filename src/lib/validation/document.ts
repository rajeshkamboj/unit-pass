import { z } from 'zod';
import { DOCUMENT_TYPES, DOCUMENT_VISIBILITIES } from '@/lib/types';

export const documentSchema = z.object({
  name: z.string({ required_error: 'Enter a document name.' }).trim().min(1, 'Enter a document name.')
    .max(200, 'Name must be 200 characters or fewer.').regex(/^[^\u0000-\u001f\u007f]+$/, 'Remove control characters from the name.'),
  type: z.enum(DOCUMENT_TYPES, { errorMap: () => ({ message: 'Choose a document type.' }) }),
  visibility: z.enum(DOCUMENT_VISIBILITIES, { errorMap: () => ({ message: 'Choose Public or Private.' }) }),
});

/** The document id is the ONLY internal id permitted in the public payload. */
export const publicDocumentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  type: z.enum(DOCUMENT_TYPES),
}).strict();
export const publicDocumentsSchema = z.array(publicDocumentSchema);
export type DocumentField = keyof z.infer<typeof documentSchema> | 'equipment_id' | 'file' | 'confirm_visibility';
