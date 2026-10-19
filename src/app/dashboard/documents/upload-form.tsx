'use client';

import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DOCUMENT_TYPES, DOCUMENT_VISIBILITIES, type DocumentEquipmentOption, type DocumentListRow, type DocumentVisibility } from '@/lib/types';
import { documentFileError } from '@/lib/storage/documents';
import type { DocumentField } from '@/lib/validation/document';
import { updateDocument, uploadDocument } from './actions';

export const documentSelectClass = 'min-h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

type Props = {
  equipmentId?: string;
  equipmentName?: string;
  equipmentOptions?: DocumentEquipmentOption[];
  record?: DocumentListRow;
};

/** Same small form for upload and metadata editing; never receives a storage key. */
export function DocumentFormDialog({ equipmentId, equipmentName, equipmentOptions = [], record }: Props) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [visibility, setVisibility] = useState<DocumentVisibility>(record?.visibility ?? 'Private');
  const [errors, setErrors] = useState<Partial<Record<DocumentField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const needsConfirmation = record ? visibility !== record.visibility : visibility === 'Public';
  const noEquipment = !record && !equipmentId && equipmentOptions.length === 0;

  function handleOpen(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) { setErrors({}); setError(null); setVisibility(record?.visibility ?? 'Private'); }
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setErrors({}); setError(null);
    if (!record) {
      const file = form.get('file');
      if (!(file instanceof File)) { setErrors({ file: 'Choose a file.' }); return; }
      // Prevent a 20 MB multipart request from hitting Next's transport limit;
      // the server independently repeats these checks and checks the signature.
      const fileError = documentFileError(file);
      if (fileError) { setErrors({ file: fileError }); return; }
    }
    startTransition(async () => {
      try {
        const result = record ? await updateDocument(record.id, form) : await uploadDocument(form);
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          setError(result.error ?? 'Check the highlighted fields.');
          return;
        }
        toast.success(record ? 'Document updated.' : 'Document uploaded.');
        setOpen(false); router.refresh();
      } catch {
        setError('The document could not be saved. Check your connection and session, then try again.');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={record ? 'outline' : 'default'} size={record ? 'sm' : 'default'}
          className="min-h-10" disabled={noEquipment}>
          {record ? 'Edit' : 'Upload document'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{record ? 'Edit document' : 'Upload document'}</DialogTitle>
          <DialogDescription>
            {record ? 'Rename the document or change who can see it. The uploaded file stays the same.'
              : 'Attach a PDF or image to a unit. Documents are Private unless you explicitly share them.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4" aria-busy={pending}>
          {error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
          <fieldset disabled={pending} className="min-w-0 space-y-4">
            {!record ? equipmentId ? (
              <div className="space-y-1">
                <input type="hidden" name="equipment_id" value={equipmentId} />
                <p className="text-sm font-medium">Equipment</p>
                <p className="break-words text-sm text-muted-foreground">{equipmentName ?? 'Selected unit'}</p>
                <FieldError message={errors.equipment_id} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor={`${id}-equipment`}>Equipment *</Label>
                <select id={`${id}-equipment`} name="equipment_id" required defaultValue="" className={documentSelectClass}
                  aria-invalid={Boolean(errors.equipment_id)}>
                  <option value="" disabled>Choose a unit</option>
                  {equipmentOptions.map((item) => <option key={item.id} value={item.id}>{item.equipment_name}</option>)}
                </select>
                <FieldError message={errors.equipment_id} />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={`${id}-name`}>Document name *</Label>
              <Input id={`${id}-name`} name="name" maxLength={200} required defaultValue={record?.name ?? ''}
                placeholder="e.g. Manufacturer warranty" className="min-h-10" aria-invalid={Boolean(errors.name)} />
              <FieldError message={errors.name} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${id}-type`}>Type *</Label>
                <select id={`${id}-type`} name="type" defaultValue={record?.type ?? 'Other'} className={documentSelectClass} aria-invalid={Boolean(errors.type)}>
                  {DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <FieldError message={errors.type} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-visibility`}>Visibility *</Label>
                <select id={`${id}-visibility`} name="visibility" value={visibility} className={documentSelectClass}
                  onChange={(event) => setVisibility(event.target.value as DocumentVisibility)} aria-invalid={Boolean(errors.visibility)}>
                  {DOCUMENT_VISIBILITIES.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <FieldError message={errors.visibility} />
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              {visibility === 'Private' ? 'Private — never shown on UnitPass' : 'Public — visible to homeowners on UnitPass'}
            </p>
            {needsConfirmation ? (
              <div className="space-y-2 rounded-md border border-amber-600/40 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                <p>{visibility === 'Public'
                  ? "This will be visible to anyone who scans the equipment's QR code. Do not share customer information or private invoices."
                  : 'This will remove the document from the public UnitPass. Previously issued download links may still work for up to 5 minutes.'}</p>
                <label className="flex min-h-10 cursor-pointer items-start gap-3 py-2">
                  <input key={visibility} type="checkbox" name="confirm_visibility" value="yes" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>I understand and confirm this visibility choice.</span>
                </label>
                <FieldError message={errors.confirm_visibility} />
              </div>
            ) : null}
            {!record ? (
              <div className="space-y-2">
                <Label htmlFor={`${id}-file`}>File *</Label>
                <Input id={`${id}-file`} name="file" type="file" required
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  className="h-auto min-h-11 py-2" aria-invalid={Boolean(errors.file)} />
                <p className="text-xs text-muted-foreground">PDF, JPEG, PNG or WEBP · Maximum 15 MB. Contents are checked on the server.</p>
                <FieldError message={errors.file} />
              </div>
            ) : <p className="break-all text-xs text-muted-foreground">File: {record.file_name ?? 'Legacy file — re-upload required'}</p>}
          </fieldset>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? 'Saving…' : record ? 'Save changes' : 'Upload document'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function FieldError({ message }: { message?: string }) {
  return message ? <p role="alert" className="text-xs text-destructive">{message}</p> : null;
}
