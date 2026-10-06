import type { Metadata } from 'next';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = {
  title: 'Sign in',
};

export default function SignInPage({
  searchParams,
}: {
  searchParams?: { next?: string; error?: string };
}) {
  const nextPath = searchParams?.next;
  const linkInvalid = searchParams?.error === 'link_invalid';

  return (
    <div className="space-y-4">
      {linkInvalid ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          That link is invalid or has expired. Enter your details to sign in, or request a new password reset link.
        </div>
      ) : null}
      <SignInForm nextPath={nextPath} />
    </div>
  );
}
