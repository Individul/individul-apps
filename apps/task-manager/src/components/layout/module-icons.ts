import {
  ArrowLeftRight,
  CalendarClock,
  FileClock,
  Gavel,
  Inbox,
  ListChecks,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * O iconiță pe modul, aceeași în meniul de sus și pe cardurile de pe Acasă,
 * ca ochiul să lege tabul de card fără să citească (29.10.2026).
 *
 * Alese după ce face registrul, nu după nume: petițiile sosesc ca scrisori
 * (tava), ședințele țin de instanță (ciocanul), contravenienții au hotărâri cu
 * termen de executare (documentul cu ceas), informările se repetă la dată fixă
 * (calendarul cu ceas). `Scale` rămâne pentru „Atacat la CSJ", unde e deja.
 */
export const MODULE_ICON: Record<string, LucideIcon> = {
  "/sarcini": ListChecks,
  "/petitii": Inbox,
  "/sedinte": Gavel,
  "/transferuri": ArrowLeftRight,
  "/inculpati": Users,
  "/contravenienti": FileClock,
  "/obligatii": CalendarClock,
};
