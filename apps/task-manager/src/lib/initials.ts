/**
 * Inițialele unui nume, pentru cercul colorat al omului: primele două cuvinte,
 * câte o literă mare. „?" când numele lipsește — cercul rămâne, ca rândul să
 * nu-și schimbe forma.
 *
 * Stă în `lib`, nu într-o componentă: căutarea de pe pagina de start are nevoie
 * de ea, iar importată din `columns.tsx` ar fi tras după ea tot tabelul
 * sarcinilor, cu meniurile lui, într-o pagină care nu le folosește.
 */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
