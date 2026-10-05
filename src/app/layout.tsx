import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SupabaseProvider } from '@supabase/auth-helpers-nextjs';
import { supabase } from '@/lib/supabase';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'UnitPass',
  description: 'Turn Every HVAC Installation Into Repeat Service Revenue.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SupabaseProvider supabase={supabase}>
          {children}
        </SupabaseProvider>
      </body>
    </html>
  );
}