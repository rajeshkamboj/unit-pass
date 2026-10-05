import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Supabase will have already set the session in the URL
    // We can just redirect to the dashboard or to the company setup
    router.push('/dashboard');
  }, []);

  return null;
}