"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  getAttachmentUrl,
} from "@/app/petitii/attachment-actions";
import { openAttachment } from "./open-attachment";
import {
  ACCEPT_ATTR,
  KIND_LABEL,
  formatBytes,
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
  /**
   * Primite încă de la fereastra petiției, dar nefolosite: numele automat al
   * fișierului („M-535-26-Ion-Popescu.pdf") îl compune acum serverul, din
   * petiția salvată, ca să nu depindă de ce trimite browserul.
   */
  petitionNumber?: string;
  petitioner?: string;
  canEdit: boolean;
  /**
   * Se cheamă când s-a atașat sau s-a șters un fișier.
   *
   * Aici NU se mai cheamă `router.refresh()`. Componenta trăiește numai
   * înăuntrul ferestrei de petiție, iar o reîmprospătare cât fereastra e
   * deschisă o închide: `loading.tsx` e o graniță `Suspense` peste tot
   * conținutul paginii, iar reîmprospătarea cade în ea și demontează
   * subarborele, cu tot cu starea ferestrei. Reprodus și măsurat — vezi
   * comentariul din `src/app/loading.tsx`.
   *
   * Lista proprie se împrospătează oricum, prin `reload()`. Registrul din
   * spate poate aștepta: e acoperit de fereastră, iar părintele îl
   * împrospătează la închidere.
   */
  onSchimbare?: () => void;
}

export function PetitionAttachments({
  petitionId,
  canEdit,
  onSchimbare,
}: PetitionAttachmentsProps) {
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
      // Fișierul trece prin server, care verifică dreptul, îl scrie în R2 și
      // abia apoi îi face rândul; dacă rândul nu intră, scoate și obiectul.
      // Numele afișat („M-535-26-Ion-Popescu.pdf") îl compune tot serverul.
      const form = new FormData();
      form.set("petitionId", petitionId);
      form.set("kind", kind);
      form.set("file", file);
      // Cererea poate să nu ajungă la capăt: rețea căzută, fișier respins de
      // server înainte de acțiune, filă rămasă pe o versiune veche. Fără mesaj,
      // butonul revenea la normal și omul credea că fișierul a urcat.
      const res = await uploadAttachment(form).catch(() => ({
        error: "Fișierul n-a putut fi urcat. Verifică legătura și încearcă din nou; dacă nu merge, reîncarcă pagina.",
      }));
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Fișier atașat");
      await reload().catch(() => {});
      onSchimbare?.();
    } finally {
      setBusy(false);
    }
  };

  const openFile = async (a: PetitionAttachment) => {
    setBusy(true);
    try {
      await openAttachment(a.path);
    } finally {
      setBusy(false);
    }
  };

  // Descărcarea folosește numele generat automat, nu calea internă din bucket.
  const downloadFile = async (a: PetitionAttachment) => {
    setBusy(true);
    try {
      const { url, error } = await getAttachmentUrl(a.path, a.name);
      if (error || !url) {
        toast.error(error ?? "Nu s-a putut descărca fișierul.");
        return;
      }
      // Content-Disposition e „attachment", deci navigarea declanșează salvarea
      // fără să părăsim pagina.
      window.location.href = url;
    } catch {
      toast.error("Nu s-a putut descărca fișierul. Încearcă din nou; dacă nu merge, reîncarcă pagina.");
    } finally {
      setBusy(false);
    }
  };

  const removeFile = async (a: PetitionAttachment) => {
    if (!window.confirm("Ștergi acest fișier?")) return;
    setBusy(true);
    try {
      const res = await deleteAttachment(a.id).catch(() => ({
        error: "Fișierul n-a putut fi șters. Încearcă din nou; dacă nu merge, reîncarcă pagina.",
      }));
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Fișier șters");
      await reload().catch(() => {});
      onSchimbare?.();
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-xs"
                        disabled={busy}
                        title={`Descarcă „${a.name}"`}
                        onClick={() => {
                          void downloadFile(a);
                        }}
                      >
                        Descarcă
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
