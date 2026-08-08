import { addDays, startOfDay } from "date-fns";
import type { DateRange } from "./periods";

/**
 * Săptămâna pe care o acoperă raportul: marțea trecută → luni, inclusiv.
 *
 * Marțea în care se prezintă raportul intră în săptămâna URMĂTOARE. Altfel
 * aceeași marți ar apărea în două rapoarte consecutive, iar un transfer de
 * marți s-ar număra de două ori. În plus, dimineața raportului n-ar mai
 * depinde de date care abia se întâmplă.
 *
 * Deschis luni, arată tot săptămâna de dinainte: ziua curentă nu s-a încheiat.
 */
export function reportWeek(today: Date = new Date()): DateRange {
  const t = startOfDay(today);
  // Câte zile de la ultima marți (0 dacă azi e marți). getDay(): 0=duminică.
  const deLaMarti = (t.getDay() - 2 + 7) % 7;
  const martiCurenta = addDays(t, -deLaMarti);
  // Marțea curentă aparține săptămânii care abia începe, deci se ia cea dinainte.
  const from = addDays(martiCurenta, -7);
  return { from, to: addDays(from, 6) };
}

/** Săptămâna vecină, pentru navigarea înapoi/înainte. */
export function shiftWeek(week: DateRange, weeks: number): DateRange {
  return { from: addDays(week.from, weeks * 7), to: addDays(week.to, weeks * 7) };
}
