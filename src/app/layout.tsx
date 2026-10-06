import type { Metadata, Viewport } from 'next';
import '@/globals.css';
import { Providers } from '@/app/providers';

export const metadata: Metadata = {
  title: {
    default: 'UnitPass — The Digital Service Passport for HVAC Equipment',
    template: '%s | UnitPass',
  },
  description: 'Turn Every HVAC Installation Into Repeat Service Revenue.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* System font stack (no next/font/google: builds must not depend on external font fetches). */}
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
