/**
 * Single source of truth for public UnitPass links and QR payloads.
 *
 * `NEXT_PUBLIC_SITE_URL` is inlined at build time, so it must be the real
 * production origin BEFORE any label is printed. A QR code that encodes
 * `http://localhost:3000` is useless in the field.
 */
const FALLBACK_ORIGIN = 'http://localhost:3000';

export function getSiteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const origin = configured && configured !== '' ? configured : FALLBACK_ORIGIN;
  return origin.replace(/\/+$/, '');
}

/** True when NEXT_PUBLIC_SITE_URL is set (the QR page warns when it is not). */
export function isSiteOriginConfigured(): boolean {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return Boolean(configured && configured !== '');
}

export function getUnitPassPath(token: string): string {
  return `/p/${encodeURIComponent(token)}`;
}

/** Absolute URL encoded into the QR code. */
export function getUnitPassUrl(token: string): string {
  return `${getSiteOrigin()}${getUnitPassPath(token)}`;
}
