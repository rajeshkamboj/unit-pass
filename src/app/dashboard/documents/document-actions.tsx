'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { deleteDocument, downloadDocument } from './actions';

export function DocumentDownloadButton({ documentId }: { documentId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function download() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await downloadDocument(documentId);
        if (!result.ok || !result.signedUrl) { setError(result.error ?? 'Download unavailable.'); return; }
        // Created only on click. The link is not persisted or prefetched.
        window.location.assign(result.signedUrl);
      } catch { setError('Download unavailable. Check your session and try again.'); }
    });
  }
  return (
    <div>
      <Button type="button" size="sm" variant="outline" className="min-h-10" disabled={pending} onClick={download}>
        {pending ? 'Preparing…' : 'Download'}
      </Button>
      {error ? <p role="alert" className="mt-2 max-w-xs text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
export function DocumentDeleteButton({ documentId, name }: { documentId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function remove(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault(); setError(null);
    startTransition(async () => {
      try {
        const result = await deleteDocument(documentId);
        if (!result.ok) { setError(result.error ?? 'The document could not be deleted.'); return; }
        toast.success('Document deleted.'); setOpen(false); router.refresh();
      } catch { setError('The document could not be deleted. Refresh and retry; any remaining entry will be kept until cleanup succeeds.'); }
    });
  }
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); setError(null); } }}>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="min-h-10 text-destructive">Delete</Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100%-2rem)] rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this document?</AlertDialogTitle>
          <AlertDialogDescription className="break-words">
            “{name}” will be removed from the dashboard, public UnitPass and private storage. This cannot be undone.
            Legacy external files, if any, are not deleted from their original host.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {pending ? 'Deleting…' : 'Delete document'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
