import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatTimestamp } from '@/lib/equipment';
import { formatDocumentSize } from '@/lib/storage/documents';
import type { DocumentListRow } from '@/lib/types';
import { DocumentFormDialog } from './upload-form';
import { DocumentDeleteButton, DocumentDownloadButton } from './document-actions';

export function DocumentList({ documents, showEquipment = true }: { documents: DocumentListRow[]; showEquipment?: boolean }) {
  return (
    <div className="grid min-w-0 gap-3 md:grid-cols-2">
      {documents.map((document) => {
        const equipment = Array.isArray(document.equipment) ? document.equipment[0] : document.equipment;
        const legacy = !document.file_name || !document.mime_type || document.file_size === null;
        return (
          <Card key={document.id} className="min-w-0">
            <CardContent className="flex h-full min-w-0 flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <FileText className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 space-y-1">
                  <h3 className="break-words font-semibold">{document.name}</h3>
                  <p className="text-sm text-muted-foreground">{document.type}</p>
                </div>
              </div>
              <div>
                <Badge variant={document.visibility === 'Public' ? 'default' : 'secondary'} className="max-w-full whitespace-normal text-left">
                  {document.visibility === 'Public' ? 'Public — visible to homeowners' : 'Private — never shown on UnitPass'}
                </Badge>
              </div>
              {showEquipment && equipment ? (
                <Link href={`/dashboard/equipment/${document.equipment_id}`} className="break-words text-sm font-medium underline-offset-4 hover:underline">
                  {equipment.equipment_name}
                </Link>
              ) : null}
              <div className="space-y-1 text-xs text-muted-foreground">
                {document.file_name ? <p className="break-all">{document.file_name}</p> : null}
                <p>{formatDocumentSize(document.file_size)} · Uploaded {formatTimestamp(document.created_at)}</p>
                {legacy ? <p className="font-medium text-amber-800 dark:text-amber-300">Legacy file — re-upload required. Not shared or downloadable.</p> : null}
              </div>
              <div className="mt-auto flex flex-wrap items-start gap-2 border-t pt-3">
                {!legacy ? <><DocumentDownloadButton documentId={document.id} /><DocumentFormDialog record={document} /></> : null}
                <DocumentDeleteButton documentId={document.id} name={document.name} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
