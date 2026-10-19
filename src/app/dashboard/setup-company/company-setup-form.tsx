'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createCompany } from './actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CompanySetupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Plain submit handler instead of React 19's `useActionState`: Next 14 bundles
  // React 18, so that hook is undefined at runtime and crashed this page.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      try {
        const result = await createCompany(formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        router.push('/dashboard');
        router.refresh();
      } catch {
        setError('We could not create your company. Please try again.');
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} noValidate className="space-y-6" aria-busy={pending}>
          {error ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="name">
              Company name <span className="text-destructive">*</span>
            </Label>
            <Input id="name" name="name" required autoComplete="organization" placeholder="Comfort Air Heating & Cooling" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contactName">Contact name</Label>
              <Input id="contactName" name="contactName" autoComplete="name" placeholder="Jane Smith" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="(555) 123-4567" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" placeholder="office@comfortair.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" name="website" type="url" autoComplete="url" placeholder="https://comfortair.com" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" autoComplete="street-address" placeholder="123 Main St, Springfield, IL" />
          </div>

          <div className="space-y-2 sm:max-w-xs">
            <Label htmlFor="defaultServiceInterval">Default service interval (months)</Label>
            <Input
              id="defaultServiceInterval"
              name="defaultServiceInterval"
              type="number"
              min={1}
              max={60}
              defaultValue={12}
              required
            />
            <p className="text-xs text-muted-foreground">
              Used when equipment does not specify its own interval. Most HVAC maintenance is annual.
            </p>
          </div>

          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? 'Creating company…' : 'Create company'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
