import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Check your email',
};

export default function CheckEmailPage() {
  return (
    <Card>
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl">Check your email</CardTitle>
        <CardDescription>
          We sent you a confirmation link. Open it to verify your account, then sign in to set up your company.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Nothing arrived after a few minutes? Check your spam folder, or sign in again to trigger a new confirmation
          email.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/auth/sign-in">Go to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
