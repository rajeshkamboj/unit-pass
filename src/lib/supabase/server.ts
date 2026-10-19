import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client bound to the request cookies.
 *
 * Use it in Server Components, Server Actions and Route Handlers. It only ever
 * holds the anonymous key: Row Level Security decides what the signed-in user
 * may read or write. It must never be imported into a client component.
 *
 * Note: when called from a Server Component the cookie store is read-only, so
 * writing refreshed cookies fails silently by design. `middleware.ts` refreshes
 * the session cookies on every request, which is the supported pattern.
 */
export function getSupabaseServerClient(): SupabaseClient {
  const cookieStore = cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL. Copy .env.example to .env.local and fill in your Supabase project values.'
    );
  }
  if (!anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in your Supabase project values.'
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Read-only cookie store (Server Component render). The middleware
          // refreshes the session cookies on the next request instead.
        }
      },
    },
  });
}
