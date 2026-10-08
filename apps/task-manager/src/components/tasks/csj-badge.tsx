import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Semnul „Atacat la CSJ", lângă numele sarcinii.
 *
 * O singură piesă pentru listă, pagina sarcinii și căutare, ca să arate peste
 * tot la fel — scris de trei ori, ar fi căpătat trei culori la prima corectură.
 * Trandafiriu, o culoare pe care n-o poartă nicio stare și nicio prioritate:
 * semnul trebuie recunoscut dintr-o privire, nu confundat cu „Ridicată".
 * Contur pe lângă fundal, ca să se vadă și tipărit, unde fundalurile nu ies.
 */
export function CsjBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800",
        className,
      )}
    >
      <Scale className="h-3 w-3" aria-hidden />
      Atacat la CSJ
    </span>
  );
}
