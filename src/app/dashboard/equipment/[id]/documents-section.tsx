import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getEquipmentDocuments } from '@/lib/queries/documents';
import { DocumentList } from '@/app/dashboard/documents/document-list';
import { DocumentFormDialog } from '@/app/dashboard/documents/upload-form';

export async function DocumentsSection({ equipmentId, equipmentName, companyId }: { equipmentId: string; equipmentName: string; companyId: string }) {
  const result = await getEquipmentDocuments(equipmentId, companyId);
  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="text-lg">Documents</CardTitle>
          <CardDescription>Private files stay inside your dashboard. Public files appear on this unit&apos;s UnitPass.</CardDescription>
        </div>
        <DocumentFormDialog equipmentId={equipmentId} equipmentName={equipmentName} />
      </CardHeader>
      <CardContent className="space-y-3 border-t pt-6">
        {result.error ? <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">Documents could not be loaded. Refresh to try again.</p>
          : result.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-8 text-center">
              <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">No documents yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">Attach a warranty, manual, invoice or service report. Visibility defaults to Private.</p>
            </div>
          ) : <DocumentList documents={result.rows} showEquipment={false} />}
        {!result.error && result.count > result.rows.length ? (
          <Link href={`/dashboard/documents?equipment=${equipmentId}`} className="inline-flex min-h-10 items-center text-sm font-medium underline">View all {result.count} documents</Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
