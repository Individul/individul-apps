import { cn } from "@/lib/utils";

/**
 * Ce înseamnă banda colorată din stânga rândurilor.
 *
 * La Sarcini banda spune prioritatea, la Petiții urgența termenului: aceleași
 * culori, înțelesuri diferite. Până acum se afla doar ducând mouse-ul pe ea,
 * deci practic nu se afla. Legenda stă sub tabel, mică, ca să nu concureze cu
 * rândurile.
 */
export function LegendaBanda({ titlu, culori }: { titlu: string; culori: { clasa: string; text: string }[] }) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-muted-foreground">
      <span>{titlu}:</span>
      {culori.map((c) => (
        <span key={c.text} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("h-3 w-1 rounded-full", c.clasa)} />
          {c.text}
        </span>
      ))}
    </p>
  );
}
