/** Shared upload rules. No credentials or Supabase clients belong in this module. */
export const DOCUMENT_BUCKET = 'documents';
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
export const DOCUMENT_URL_TTL = 300;
export const DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export type DocumentMimeType = (typeof DOCUMENT_MIME_TYPES)[number];

const EXTENSIONS: Record<DocumentMimeType, readonly string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const OBJECT_NAME = new RegExp(`^${UUID}-[A-Za-z0-9][A-Za-z0-9._-]{0,119}$`, 'i');

/** ASCII-only storage/download name, at most 120 characters, preserving the extension. */
export function sanitizeDocumentFileName(input: string): string {
  const base = input.normalize('NFKD').replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/\\/g, '/').split('/').pop()?.trim() ?? '';
  const dot = base.lastIndexOf('.');
  const extension = dot >= 0 ? base.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 10) : '';
  const stem = (dot >= 0 ? base.slice(0, dot) : base)
    .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[^a-zA-Z0-9]+/, '').replace(/[._-]+$/, '') || 'document';
  const suffix = extension ? `.${extension}` : '';
  return `${stem.slice(0, 120 - suffix.length)}${suffix}`;
}

export function documentFileError(
  file: { name: string; type: string; size: number },
  header?: Uint8Array
): string | null {
  if (!Number.isSafeInteger(file.size) || file.size < 1) return 'Choose a non-empty file.';
  if (file.size > MAX_DOCUMENT_BYTES) return 'The file is too large. Maximum size is 15 MB.';
  if (!DOCUMENT_MIME_TYPES.includes(file.type as DocumentMimeType)) {
    return 'Only PDF, JPEG, PNG and WEBP files are allowed. HTML and SVG are not supported.';
  }
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!EXTENSIONS[file.type as DocumentMimeType].includes(extension)) {
    return 'The file extension must match its type (PDF, JPG/JPEG, PNG or WEBP).';
  }
  if (!header) return null;
  const matches = (bytes: number[], offset = 0) => bytes.every((byte, index) => header[offset + index] === byte);
  const valid = {
    'application/pdf': matches([0x25, 0x50, 0x44, 0x46, 0x2d]), // %PDF-
    'image/png': matches([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    'image/jpeg': matches([0xff, 0xd8, 0xff]),
    'image/webp': matches([0x52, 0x49, 0x46, 0x46]) && matches([0x57, 0x45, 0x42, 0x50], 8),
  }[file.type];
  return valid ? null : 'The file contents do not match its declared type. Choose a genuine PDF, JPEG, PNG or WEBP file.';
}

/** Also checked before admin signing: a forged row must never sign another tenant's path. */
export function isDocumentStoragePath(path: unknown, companyId: string, equipmentId: string): path is string {
  if (typeof path !== 'string') return false;
  const parts = path.split('/');
  return parts.length === 3 && parts[0] === companyId && parts[1] === equipmentId && OBJECT_NAME.test(parts[2]);
}

export function formatDocumentSize(bytes: number | null): string {
  if (bytes === null) return 'Size unavailable';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
