import { supabase } from '@/lib/supabase';

export async function signOut() {
  await supabase.auth.signOut();
  // Redirect to home page after sign out
  window.location.href = '/';
}