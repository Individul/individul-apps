import { cn } from "@/lib/utils";

/**
 * Ce înseamnă banda colorată din stânga rândurilor.
 *
 * La Sarcini și la Petiții banda spune unde stă rândul față de termen, în
 * culorile din `CULORI_TERMEN`. Până acum se afla doar ducând mouse-ul pe ea,
 * deci practic nu se afla. Legenda stă sub tabel, mică, ca să nu concureze cu
 * rândurile.
 */
export function LegendaBanda({
  titlu,
  culori,
  children,
}: {
  titlu: string;
  culori: { clasa: string; text: string }[];
  /** Ce mai e de explicat pe același rând, după culori (de pildă săgețile priorității). */
  children?: React.ReactNode;
}) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-muted-foreground">
      <span>{titlu}:</span>
      {culori.map((c) => (
        <span key={c.text} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("h-3 w-1 rounded-full", c.clasa)} />
          {c.text}
        </span>
      ))}
      {children}
    </p>
  );
}
