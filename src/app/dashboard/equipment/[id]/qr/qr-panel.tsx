'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { AlertTriangle, Copy, Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type QrPanelProps = {
  publicUrl: string;
  equipmentName: string;
  equipmentType: string;
  manufacturer: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  customerLastName: string | null;
  companyName: string;
  companyPhone: string | null;
  siteOriginConfigured: boolean;
};

const QR_SIZE = 1024;

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'unit'
  );
}

export function QrPanel({
  publicUrl,
  equipmentName,
  equipmentType,
  manufacturer,
  modelNumber,
  serialNumber,
  customerLastName,
  companyName,
  companyPhone,
  siteOriginConfigured,
}: QrPanelProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(publicUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: QR_SIZE,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
          setQrError(null);
        }
      })
      .catch((error: unknown) => {
        console.error('[equipment] Failed to generate the QR code:', error);
        if (!cancelled) setQrError('The QR code could not be generated. Reload the page to try again.');
      });

    return () => {
      cancelled = true;
    };
  }, [publicUrl]);

  const downloadName = `unitpass-${slugify(customerLastName ?? 'customer')}-${slugify(equipmentName)}.png`;
  const modelLine = [manufacturer, modelNumber].filter(Boolean).join(' · ');

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Public link copied');
    } catch {
      toast.error('Could not copy automatically — select the link field and copy it manually.');
    }
  }

  return (
    <div className="space-y-6">
      {!siteOriginConfigured ? (
        <div
          role="alert"
          className="flex gap-3 rounded-md border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium">NEXT_PUBLIC_SITE_URL is not set.</p>
            <p>
              This QR code points at the local fallback origin and will not work on a phone. Set the production
              origin, rebuild, and only then print labels.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2 print:hidden">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">QR code</CardTitle>
            <CardDescription>
              Encodes <span className="break-all font-medium">{publicUrl}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex min-h-64 items-center justify-center rounded-md border bg-white p-4">
              {dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={dataUrl}
                  alt={`QR code linking to the UnitPass for ${equipmentName}`}
                  width={320}
                  height={320}
                  className="h-auto w-full max-w-80"
                />
              ) : qrError ? (
                <p className="text-sm text-destructive">{qrError}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Generating QR code…</p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline" className="min-h-10 flex-1" aria-disabled={!dataUrl}>
                <a href={dataUrl ?? '#'} download={downloadName} onClick={(event) => !dataUrl && event.preventDefault()}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download PNG
                </a>
              </Button>
              <Button type="button" variant="outline" className="min-h-10 flex-1" onClick={handleCopy}>
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copy public link
              </Button>
            </div>

            <div className="space-y-2">
              <label htmlFor="unitpass-public-url" className="text-sm font-medium">
                Public link
              </label>
              <Input
                id="unitpass-public-url"
                readOnly
                value={publicUrl}
                onFocus={(event) => event.currentTarget.select()}
                className="font-mono text-xs"
              />
            </div>

            <p className="text-sm text-muted-foreground">
              This QR code is permanent. It keeps working when you update this equipment record.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Printable label</CardTitle>
            <CardDescription>
              Print this label and attach it to the unit. App navigation is hidden automatically when printing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button type="button" onClick={() => window.print()} className="min-h-10 w-full sm:w-auto">
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print label
            </Button>
            <p className="text-sm text-muted-foreground">
              Store this page&apos;s link in your records too — the dashboard equipment page always shows the same
              public link.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* The only block that prints. */}
      <div
        id="unitpass-print-label"
        className="mx-auto w-full max-w-md rounded-lg border bg-white p-6 text-black print:max-w-none print:rounded-none print:border-0 print:p-0"
      >
        <p className="text-xs font-semibold uppercase tracking-wide">{companyName}</p>
        <h2 className="mt-1 break-words text-xl font-bold">{equipmentName}</h2>
        <p className="mt-0.5 text-sm">{equipmentType}</p>
        {modelLine ? <p className="text-sm">{modelLine}</p> : null}
        {serialNumber ? <p className="text-sm">Serial: {serialNumber}</p> : null}

        <div className="my-4 flex items-center justify-center rounded-md border p-3">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt={`QR code linking to the UnitPass for ${equipmentName}`}
              width={256}
              height={256}
              className="h-auto w-full max-w-60"
            />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center text-center text-xs">
              QR code will appear here
            </div>
          )}
        </div>

        <p className="text-center text-sm font-semibold">
          Scan for warranty, service history and to book service
        </p>
        <p className="mt-2 text-center text-xs break-all">{publicUrl}</p>
        {companyPhone ? <p className="mt-2 text-center text-sm">{companyPhone}</p> : null}
        <p className="mt-3 text-center text-[10px] uppercase tracking-wide text-neutral-500">
          Powered by UnitPass
        </p>
      </div>
    </div>
  );
}
