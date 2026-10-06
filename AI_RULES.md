# AI_RULES.md

**The authoritative instructions for any AI agent working in this repository live in
[`prompts/README.md`](prompts/README.md). Read that first, then the phase file for the task
(`prompts/prompt-phaseN.md`).** This file only summarises the non-negotiable rules; if anything here conflicts with
`prompts/`, `prompts/` wins.

> The previous contents of this file described a Vite + React-Router app (`src/App.tsx` routing, `src/pages/Index.tsx`
> as the main page, "never edit the shadcn files"). That was wrong for this repository and has been removed.
> **This project is a Next.js 14 App Router application.**

## Stack (do not migrate frameworks)

Next.js 14 App Router (`src/app`) · React 19 · TypeScript · Tailwind CSS 3 · shadcn/ui (`src/components/ui`) ·
Supabase (Postgres + RLS + Auth + Storage) · pnpm 9 · Node 20+ · deployed on Vercel.

## Hard rules

1. Inspect before modifying; preserve working functionality.
2. Put application code under `src/`. Pages and route handlers live in `src/app/**` (there is **no** root `app/`
   directory and **no** `src/pages` Pages Router directory).
3. Prefer Server Components; add `'use client'` only to files that need interactivity, hooks or browser APIs.
4. Mutations are **Server Actions**. Never trust a `company_id` (or any tenant id) supplied by the browser — derive it
   server-side from `company_members`.
5. Every tenant table has RLS enabled and policies that use the `SECURITY DEFINER` helpers
   (`public.is_company_member`, `public.is_company_admin`). Never write a policy that queries its own table.
6. Use the Supabase clients in `src/lib/supabase/` (`client.ts` for browser, `server.ts` for server code). Never
   import `server.ts` into a client component. Service-role keys are server-only and are introduced only by the phase
   that needs them.
7. Schema changes are **new, idempotent migrations** in `supabase/migrations/` — never destructive edits to an applied
   migration, never dropped tables or columns, never deleted customer data.
8. Never commit secrets. Only variable names go into `.env.example`; values live in `.env.local` or the host's env
   settings.
9. Public pages may only return explicitly whitelisted fields (never private notes, customer PII, internal ids).
10. Mobile responsiveness is mandatory; use Tailwind + the existing shadcn components rather than new UI libraries.
11. Do not add dependencies without a specific need. Do not remove working code for style reasons.
12. Implement only the current phase. Write anything else into `FUTURE PHASE NOTES` in the completion report instead.

## Verification before finishing

```bash
pnpm typecheck && pnpm lint && pnpm build
# plus the SQL security tests when the change touches the database:
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql
```

Finish every task with the PHASE COMPLETION REPORT defined in `prompts/README.md` §6, and never report
`SAFE TO MERGE: YES` if the build fails, tests fail, or tenant isolation / public-private separation is unverified.
