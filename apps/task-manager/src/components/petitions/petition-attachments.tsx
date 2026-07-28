"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  listAttachments,
  recordAttachment,
  deleteAttachment,
  getAttachmentUrl,
} from "@/app/petitii/attachment-actions";
import { createClient } from "@/lib/supabase/client";
import {
  ACCEPT_ATTR,
  KIND_LABEL,
  formatBytes,
  storageKey,
  validateAttachment,
  type AttachmentKind,
} from "@/lib/attachments";
import type { PetitionAttachment } from "@/lib/types";

// Ordinea grupelor în interfață.
const KINDS: readonly AttachmentKind[] = ["petitie", "raspuns"] as const;

const EMPTY_LABEL: Record<AttachmentKind, string> = {
  petitie: "Niciun fișier.",
  raspuns: "Niciun fișier (opțional).",
};

interface PetitionAttachmentsProps {
  petitionId: string;
  canEdit: boolean;
}

export function PetitionAttachments({ petitionId, canEdit }: PetitionAttachmentsProps) {
  const router = useRouter();
  const [items, setItems] = useState<PetitionAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  // O singură operațiune odată: blochează încărcarea și ștergerea cât timp rulează.
  const [busy, setBusy] = useState(false);
  // Câte un input ascuns per grupă, ca `kind`-ul să fie neambiguu.
  const inputs = useRef<Partial<Record<AttachmentKind, HTMLInputElement | null>>>({});

  const reload = useCallback(async () => {
    setItems(await listAttachments(petitionId));
  }, [petitionId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const rows = await listAttachments(petitionId);
        if (active) setItems(rows);
      } catch {
        // Acțiunea degradează grațios; aici rămâne doar cazul de rețea.
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [petitionId]);

  const grouped = useMemo(
    () => ({
      petitie: items.filter((a) => a.kind === "petitie"),
      raspuns: items.filter((a) => a.kind === "raspuns"),
    }),
    [items],
  );

  const handlePick = async (kind: AttachmentKind, input: HTMLInputElement) => {
    const file = input.files?.[0];
    // Resetăm imediat, ca același fișier să poată fi ales din nou.
    input.value = "";
    if (!file) return;

    const err = validateAttachment(file);
    if (err) {
      toast.error(err);
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const path = storageKey(petitionId, file.name);
      // Fără `upsert`: bucketul nu are politică de `update`, iar calea e oricum unică.
      const up = await supabase.storage
        .from("petitions")
        .upload(path, file, { contentType: file.type });
      if (up.error) {
        toast.error(up.error.message);
        return;
      }
      const res = await recordAttachment({
        petitionId,
        kind,
        path,
        name: file.name,
        mime: file.type,
        size: file.size,
      });
      if (res.error) {
        // Rândul n-a intrat → scoatem obiectul, fără orfani.
        await supabase.storage.from("petitions").remove([path]);
        toast.error(res.error);
        return;
      }
      toast.success("Fișier atașat");
      await reload();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const openFile = async (a: PetitionAttachment) => {
    // Tab-ul se deschide sincron, în gestul utilizatorului: linkul semnat vine
    // abia după un await, iar un `window.open` de acolo ar fi blocat ca pop-up.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null; // fără acces înapoi la fereastra noastră
    setBusy(true);
    try {
      const { url, error } = await getAttachmentUrl(a.path);
      if (error || !url) {
        tab?.close();
        toast.error(error ?? "Nu s-a putut deschide fișierul.");
        return;
      }
      if (tab) tab.location.replace(url);
      else window.open(url, "_blank", "noopener,noreferrer"); // fallback
    } finally {
      setBusy(false);
    }
  };

  const removeFile = async (a: PetitionAttachment) => {
    if (!window.confirm("Ștergi acest fișier?")) return;
    setBusy(true);
    try {
      const res = await deleteAttachment(a.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Fișier șters");
      await reload();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-[13px] text-muted-foreground">Se încarcă…</p>;
  }

  return (
    <div className="space-y-3">
      {KINDS.map((kind) => {
        const files = grouped[kind];
        return (
          <div key={kind} className="space-y-2 rounded-lg border p-3">
            <h4 className="text-sm font-medium">{KIND_LABEL[kind]}</h4>

            {files.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">{EMPTY_LABEL[kind]}</p>
            ) : (
              <ul className="space-y-1.5">
                {files.map((a) => {
                  const Icon = a.mime === "application/pdf" ? FileText : ImageIcon;
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[13px]" title={a.name}>
                        {a.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatBytes(a.size ?? 0)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-xs"
                        disabled={busy}
                        onClick={() => {
                          void openFile(a);
                        }}
                      >
                        Deschide
                      </Button>
                      {canEdit && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                          disabled={busy}
                          aria-label={`Șterge fișierul ${a.name}`}
                          title="Șterge fișierul"
                          onClick={() => {
                            void removeFile(a);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {canEdit && (
              <>
                <input
                  ref={(el) => {
                    inputs.current[kind] = el;
                  }}
                  type="file"
                  accept={ACCEPT_ATTR}
                  className="hidden"
                  aria-label={`Adaugă fișier — ${KIND_LABEL[kind]}`}
                  onChange={(e) => {
                    void handlePick(kind, e.currentTarget);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={busy}
                  onClick={() => inputs.current[kind]?.click()}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Adaugă fișier
                </Button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
