/**
 * Pictograma din fila browserului (`app/icon.svg`), desenată în antet ca să
 * poată lua culoarea temei. Trei rânduri pe pătrat: o listă, adică o evidență.
 *
 * „Acasă" era doar un cuvânt îngroșat care ținea loc de siglă, iar lângă file
 * nu se deosebea de ele (29.10.2026). Stă și în antetul adevărat, și în
 * scheletul lui, ca rândul să nu sară la încărcare.
 */
export function Sigla() {
  return (
    <svg aria-hidden viewBox="0 0 64 64" className="h-6 w-6 shrink-0 text-primary">
      <rect width="64" height="64" rx="14" fill="currentColor" />
      <g stroke="white" strokeWidth="6" strokeLinecap="round">
        <path d="M19 23h26" />
        <path d="M19 33h26" />
        <path d="M19 43h16" />
      </g>
    </svg>
  );
}
