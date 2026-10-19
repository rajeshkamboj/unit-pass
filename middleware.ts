import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Single root middleware (documented decision: the app uses root `middleware.ts`,
 * not `src/middleware.ts`).
 *
 * Responsibilities:
 *  - refresh Supabase auth cookies on every request;
 *  - redirect unauthenticated visitors away from /dashboard*.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every page request except:
     *  - Next internals and static assets (with a file extension)
     *  - /auth/* (the auth pages and the callback route handler manage their own
     *    session cookies; nothing there needs a refresh or a redirect guard)
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|webmanifest)$).*)',
  ],
};
