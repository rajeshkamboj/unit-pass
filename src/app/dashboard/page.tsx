import Link from 'next/link';
import { CalendarClock, Mail, MapPin, Phone, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { requireCompany } from '@/lib/session';

export default async function DashboardPage() {
  const { company, role } = await requireCompany();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to UnitPass</h1>
          <p className="text-sm text-muted-foreground">
            You are signed in as the <span className="font-medium">{role}</span> of {company.name}.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Company profile</CardTitle>
            <CardDescription>The details your customers will see on their UnitPass.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">{company.name}</span>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{company.contact_name || 'No contact name yet'}</span>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{company.phone || 'No phone yet'}</span>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{company.email || 'No email yet'}</span>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{company.address || 'No address yet'}</span>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                Default service interval: {company.default_service_interval}{' '}
                {company.default_service_interval === 1 ? 'month' : 'months'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What comes next</CardTitle>
            <CardDescription>Your account is ready. These features are being built in order.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  1
                </span>
                <span>
                  <span className="font-medium">Customers</span> — keep the homeowners you install for in one place.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  2
                </span>
                <span>
                  <span className="font-medium">Equipment + QR labels</span> — give every installed unit its digital
                  passport.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  3
                </span>
                <span>
                  <span className="font-medium">Service reminders</span> — know when each unit is due for maintenance.
                </span>
              </li>
            </ol>
            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              Company profile editing arrives with the customers phase. Until then, contact support if any of the details
              above are wrong.
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/">View the public site</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
