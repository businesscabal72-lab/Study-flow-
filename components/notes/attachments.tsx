"use client";
import { useRef, useState } from "react";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useAttachments } from "@/hooks/use-data";
import { useDbMutation } from "@/hooks/use-mutation";
import { useSession } from "@/hooks/use-session";
import { attachmentUrl, deleteAttachment, uploadAttachment, MAX_PDF_BYTES } from "@/lib/data/notes";
import { qk } from "@/lib/data/core";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/utils/format";
import type { NoteAttachment } from "@/types/database";

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

export function Attachments({ noteId }: { noteId: string }) {
  const { userId } = useSession();
  const files = useAttachments(noteId);
  const input = useRef<HTMLInputElement>(null);
  const [removing, setRemoving] = useState<NoteAttachment | null>(null);
  const upload = useDbMutation((sb, file: File) => uploadAttachment(sb, userId, noteId, file), {
    invalidate: [qk.attachments(noteId)],
    success: "PDF attached",
  });
  const remove = useDbMutation((sb, a: NoteAttachment) => deleteAttachment(sb, a), {
    invalidate: [qk.attachments(noteId)],
    success: "Attachment removed",
    onSuccess: () => setRemoving(null),
  });

  const open = async (a: NoteAttachment) => {
    try {
      window.open(await attachmentUrl(getSupabaseBrowser(), a.storage_path), "_blank", "noopener");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <section className="mt-12 border-t border-border pt-5" aria-label="Attachments">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Attachments</h2>
        <Button variant="ghost" size="sm" loading={upload.isPending} onClick={() => input.current?.click()}>
          <Paperclip /> Attach PDF
        </Button>
        <input
          ref={input}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (f.type !== "application/pdf") return toast.error("Only PDF files can be attached.");
            if (f.size > MAX_PDF_BYTES) return toast.error("PDFs must be 10 MB or smaller.");
            upload.mutate(f);
          }}
        />
      </div>
      {files.error ? (
        <p className="text-[13px] text-destructive">Couldn&apos;t load attachments.</p>
      ) : (files.data ?? []).length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No PDFs attached. Attachments are stored privately and are not read by the AI.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {files.data!.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <FileText className="size-4 shrink-0 text-destructive/80" />
              <button onClick={() => open(a)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm hover:underline">{a.file_name}</p>
                <p className="text-xs text-muted-foreground">{kb(a.size_bytes)}</p>
              </button>
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${a.file_name}`} onClick={() => setRemoving(a)}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(v) => !v && setRemoving(null)}
        title="Remove attachment?"
        description={`“${removing?.file_name}” will be permanently deleted.`}
        confirmLabel="Remove"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </section>
  );
}
