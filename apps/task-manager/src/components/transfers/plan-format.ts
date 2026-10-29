import { format } from "date-fns";
import { ro } from "date-fns/locale";

import { planDate, type TransferPlan } from "@/lib/transfer-plans";
import { parseISODate } from "@/lib/periods";

/**
 * Data de care atârnă planificarea, spusă cu numele ei.
 *
 * „Ședința" și „decizia" cer transferul în direcții opuse — una înainte, alta
 * după — deci un rând care arată doar o dată, fără să spună care, s-ar citi
 * greșit exact când contează. Folosită și pe ecran, și pe lista tipărită.
 */
export function dataPlanului(p: TransferPlan): string {
  const iso = planDate(p);
  if (!iso) return "—";
  const zi = format(parseISODate(iso), "d MMM yyyy", { locale: ro });
  if (p.basis === "decizie") return `decizie, ${zi}`;
  if (p.basis === "termen30") return `încheiere, ${zi}`;
  return `ședință, ${zi}`;
}

/** „Transfer pe luni, 2 noiembrie 2026", pentru capul unui grup. */
export function ziuaTransferului(day: string): string {
  return format(parseISODate(day), "EEEE, d MMMM yyyy", { locale: ro });
}
