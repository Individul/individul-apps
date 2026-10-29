import type { Config } from 'tailwindcss'
import colors from 'tailwindcss/colors'
import plugin from 'tailwindcss/plugin'

/*
 * Nuanțele Tailwind folosite direct în componente, întoarse pentru modul
 * întunecat (29.10.2026).
 *
 * Aplicația are câteva sute de culori scrise ca `bg-amber-50 text-amber-900`:
 * fond deschis, text închis. Pe un ecran întunecat ar ieși pete albe cu text
 * negru. În loc să primească fiecare un `dark:` scris de mână, nuanțele trec
 * prin variabile CSS care, sub `.dark`, se întorc: fondurile 50–300 devin
 * 950–800, iar textul 600–900 se deschide la 400–100.
 * 400 și 500 (benzile, punctele de stare) rămân cum sunt: se văd pe ambele
 * fonduri. Rezultatul: fond închis colorat, text deschis colorat, aceeași
 * nuanță, fără nicio clasă în plus în componente.
 *
 * Ce nu merge așa trebuie scris pe jetoane (`bg-foreground`, `bg-card`): o
 * nuanță 600–900 folosită ca *fond* sub text alb s-ar deschide sub el.
 */
const NUANTE = [
  'slate', 'gray', 'zinc', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald',
  'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
] as const
const TREPTE = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const
const INTUNECAT: Record<(typeof TREPTE)[number], (typeof TREPTE)[number]> = {
  // Fondurile cu o treaptă mai jos decât oglinda exactă (100→950, nu 900): un
  // banner `bg-red-100` ieșea pe toată lățimea un roșu aprins, mai strident decât
  // în tema luminoasă. Văzut pe probă, la Acasă.
  '50': '950', '100': '950', '200': '900', '300': '800', '400': '400', '500': '500',
  '600': '400', '700': '300', '800': '200', '900': '100', '950': '50',
}
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}
const paleta = Object.fromEntries(
  NUANTE.map((n) => [n, Object.fromEntries(TREPTE.map((t) => [t, `rgb(var(--c-${n}-${t}) / <alpha-value>)`]))]),
)
const variabile = (inversat: boolean) =>
  Object.fromEntries(
    NUANTE.flatMap((n) =>
      TREPTE.map((t) => [`--c-${n}-${t}`, rgb((colors as unknown as Record<string, Record<string, string>>)[n][inversat ? INTUNECAT[t] : t])]),
    ),
  )

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  // Regulile de bază cu `.dark` rămân doar dacă Tailwind găsește clasa în sursă;
  // ea apare însă doar în scriptul de temă, scris ca text. Fără asta, paleta
  // întoarsă dispărea tăcut din CSS.
  safelist: ['dark'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        ...paleta,
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        // Variabila pusă de `next/font` în layout, nu numele „Inter" scris de
        // mână: numele singur cere fontul de la sistem, iar dacă nu e instalat
        // — și pe Windows nu e — se trece tăcut la următorul din listă. Prin
        // variabilă, fontul e cel adus de noi sau niciunul.
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    // Doar pe ecran, ca la jetoanele din globals.css: hârtia rămâne albă.
    plugin(({ addBase }) => {
      addBase({ ':root': variabile(false) })
      addBase({ '.dark': variabile(true) })
      addBase({ '@media print': { '.dark': variabile(false) } })
    }),
  ],
}
export default config
