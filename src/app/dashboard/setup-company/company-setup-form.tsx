'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createCompany, type CompanySetupState } from './actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const INITIAL_STATE: CompanySetupState = { error: null };

export function CompanySetupForm() {
  const [state, formAction] = useActionState(createCompany, INITIAL_STATE);

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-6">
          {state.error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {state.error}
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

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? 'Creating company…' : 'Create company'}
    </Button>
  );
}
