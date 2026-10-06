'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser-side Supabase client (anonymous key only — RLS protects the data).
 *
 * Deliberately created lazily: Next.js also renders client components on the
 * server during `next build`, and a module-level env check would make the build
 * depend on credentials. The check still fails fast at runtime.
 *
 * Env values must be referenced statically (process.env.NEXT_PUBLIC_*) so Next
 * can inline them into the client bundle.
 */
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

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

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
