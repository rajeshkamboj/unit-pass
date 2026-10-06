'use server';

import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Sign-out is a Server Action so the session cookies are cleared with the
 * request-bound server client (never with client-only auth state).
 */
export async function signOut() {
  const supabase = getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/');
}
