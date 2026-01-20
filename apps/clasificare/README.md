# Calculator Fracții Cod Penal RM

Calculator pentru liberarea condiționată înainte de termen și înlocuirea părții neexecutate din pedeapsă cu o pedeapsă mai blândă conform Codului Penal al Republicii Moldova (Art. 91, 92).

## Funcționalități

### 1. Determinarea Categoriei Infracțiunilor
- Adăugare infracțiuni cu selectare din listă
- Determinare automată a celei mai grave categorii (U, MPG, G, DG, EG)
- Suport pentru articole cu alineate (inclusiv superscripute: ¹, ², ³)

### 2. Calculator Termene
- Calcularea datei exacte de eligibilitate pentru liberare condiționată
- Suport pentru Art. 91 (Liberare Condiționată) și Art. 92 (Înlocuire părții neexecutate)
- Scădere arest preventiv din perioada de executat
- Calcul conform regulilor juridice RM:
  - Termenii în ani expiră în ziua precedentă
  - Termenii în luni expiră în ziua precedentă
  - Termenii mixți folosesc calcul calendaristic

### 3. Categorii de Vârstă
- Minor (sub 18 ani) - fracții reduse
- Tânăr (18-21 ani) - fracții reduse
- Adult (21-60 ani) - fracții standard
- Vârstnic (peste 60 ani) - fracții reduse

## Instalare

```bash
npm install
```

## Dezvoltare

```bash
npm run dev
```

Aplicația va fi disponibilă la `http://localhost:3000`

## Build pentru producție

```bash
npm run build
```

## Fracții aplicabile

### Art. 91 - Liberarea condiționată

| Categorie | Minor/18-21/60+ | Adult (21-60) |
|-----------|-----------------|---------------|
| U (Ușoară) | 1/3 | 1/2 |
| MPG (Mai puțin gravă) | 1/3 | 1/2 |
| G (Gravă) | 1/2 | 2/3 |
| DG (Deosebit de gravă) | 2/3 | 2/3 |
| EG (Excepțional de gravă) | 2/3 | 2/3 |

### Art. 92 - Înlocuirea părții neexecutate

Aceleași fracții pentru toate categoriile de vârstă.

## Structura proiectului

```
src/
├── App.jsx                      # Componenta principală
├── main.jsx                     # Entry point
├── index.css                    # Stiluri globale
├── data/
│   └── infractiuni.json         # Baza de date cu infracțiuni
└── utils/
    ├── constants.js             # Fracții și categorii
    └── calculations.js          # Funcții de calcul
```

## Tehnologii

- React 18.3.1
- Vite 6.4.1
- Tailwind CSS
- JavaScript (ES6+)

## Notă legală

Acesta este doar un instrument informativ și nu substituie consultarea actelor normative în vigoare.

## Licență

MIT

---

© Dumitru Prisăcaru, 2026
