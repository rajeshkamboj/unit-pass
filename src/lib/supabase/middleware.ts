import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const DASHBOARD_PATH_PREFIX = '/dashboard';

function buildSignInRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/auth/sign-in';
  url.search = '';
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (next && next !== '/dashboard') {
    url.searchParams.set('next', next);
  }
  return NextResponse.redirect(url);
}

/**
 * Refreshes the Supabase session cookies on every request and blocks
 * unauthenticated access to /dashboard*.
 *
 * This is the first of two server-side gates (the dashboard layout performs its
 * own check with `requireUser()`), so a request can never reach a protected page
 * with a stale or missing session.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const isDashboardRequest = request.nextUrl.pathname.startsWith(DASHBOARD_PATH_PREFIX);

  if (!url || !anonKey) {
    // Misconfiguration must be loud in development but must never take every
    // route down in production. Protected routes stay protected (deny by default).
    console.error(
      '[middleware] Supabase environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
    return isDashboardRequest ? buildSignInRedirect(request) : response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  let isSignedIn = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // Expired/invalid session (or Supabase unreachable) — treat as signed out.
      isSignedIn = false;
    } else {
      isSignedIn = Boolean(data.user);
    }
  } catch (error) {
    console.error('[middleware] Failed to read the Supabase session:', error);
    isSignedIn = false;
  }

  if (!isSignedIn && isDashboardRequest) {
    return buildSignInRedirect(request);
  }

  return response;
}
