import { cn } from "@/lib/utils";

/**
 * Cadrul unei pagini din aplicație, sub antet.
 *
 * Până acum fiecare pagină își alegea singură lățimea și se centra, deci
 * titlul „sărea" la stânga sau la dreapta când treceai dintr-un tab în altul:
 * Sarcini pornea de la marginea meniului, Informări cu câteva sute de pixeli
 * mai la dreapta. Acum toate pornesc din aceeași margine cu meniul de sus
 * (cadrul are lățimea antetului), iar lățimea se alege dintre două:
 *
 * - „lata": registrele cu multe coloane (Acasă, Sarcini, Petiții,
 *   Administrare), care ocupă cât îi lasă antetul;
 * - „ingusta": paginile cu formulare sau cu tabele de câteva coloane, care pe
 *   un ecran lat s-ar întinde până nu se mai citesc.
 *
 * `className` se aplică conținutului (spațierea, regulile de tipar);
 * `cadru` se aplică lui `<main>` (de pildă `print:p-0`).
 */
export function Pagina({
  latime,
  className,
  cadru,
  children,
}: {
  latime: "lata" | "ingusta";
  className?: string;
  cadru?: string;
  children: React.ReactNode;
}) {
  return (
    <main className={cn("mx-auto max-w-[1536px] p-4 xl:px-10", cadru)}>
      <div className={cn(latime === "ingusta" && "max-w-5xl", className)}>{children}</div>
    </main>
  );
}
