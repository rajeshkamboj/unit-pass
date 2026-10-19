import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Auth callback route handler.
 *
 * Handles both Supabase e-mail flows:
 *  - `?code=...`               → PKCE code exchange (default for @supabase/ssr)
 *  - `?token_hash=...&type=...` → OTP verification (custom e-mail templates
 *                                 and recovery links opened on another device)
 *
 * Always redirects; never renders. `?next=` must be a local path.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = sanitizeNext(searchParams.get('next'));
  const errorDescription = searchParams.get('error_description');

  const failureUrl = new URL('/auth/sign-in', origin);
  if (errorDescription) failureUrl.searchParams.set('error', 'link_invalid');

  if (code || (tokenHash && type)) {
    const supabase = getSupabaseServerClient();

    const { error } =
      code != null && code !== ''
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash as string });

    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }

    console.error('[auth/callback] Verification failed:', error.message);
  }

  failureUrl.searchParams.set('error', 'link_invalid');
  return NextResponse.redirect(failureUrl);
}

/** Only allow same-origin, absolute-path redirects (prevents open redirects). */
function sanitizeNext(value: string | null): string {
  if (!value) return '/dashboard';
  if (!value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}
