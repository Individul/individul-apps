# SoccerLife Tactic Assistant — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A browser userscript that reads a live soccerlife.ru match page and recommends tactical setting changes derived from the game's official manual, citing the rule behind each one.

**Architecture:** Four pure layers — observe (DOM → numbers), derive (numbers → state), rules (state → recommendations), coherence (strip forbidden combinations) — plus an overlay panel and a 3-second poll loop. Every layer except the panel is a pure function over plain objects, so the whole engine is unit-testable with no browser.

**Tech Stack:** Plain ES modules, Vitest (+ happy-dom for DOM tests), esbuild to bundle into a single `.user.js` for Tampermonkey/Violentmonkey. No runtime dependencies, no network calls, no build-time framework.

**Design doc:** [2026-08-01-soccerlife-tactic-assistant-design.md](2026-08-01-soccerlife-tactic-assistant-design.md)

---

## Domain Reference

Read this before Task 1. Everything below is extracted from the manual and the live page; the
rules encode it verbatim.

### Setting ordinals

The `Настройки на матч` panel renders settings as 1-indexed ordinals, left-to-right in the same
order as the tactics editor buttons.

| Setting | Key | Scale | Levels (1 → N) |
|---|---|---|---|
| высота линии обороны | `defenseLine` | N/3 | низкая, средняя, высокая |
| высота прессинга | `pressHeight` | N/3 | низкий, средний, высокий |
| ширина обороны | `defenseWidth` | N/3 | узкая, средняя, широкая |
| интенсивность прессинга | `pressIntensity` | N/5 | мин, низкая, средняя, высокая, макс |
| выход из обороны | `buildOut` | enum | выносы, смешанный, позиционный |
| темп розыгрыша мяча | `tempo` | N/3 | низкий, средний, высокий |
| диагональные передачи | `diagonals` | N/3 | редко, умеренно, часто |
| пасы в одно касание | `oneTouch` | N/3 | редко, умеренно, часто |
| острота передач | `passSharpness` | N/5 | мин, низкая, средняя, высокая, макс |
| дриблинг | `dribbling` | N/5 | мин, умеренно, чаще, часто, макс |
| навесы в штрафную | `crosses` | N/3 | редко, умеренно, часто |
| подача стандартов | `setPieces` | enum | навес, розыгрыш |
| дальний удар | `longShots` | N/3 | редко, умеренно, часто |
| стиль игры | `style` | N/5 | защ+, защита, обычн, атака, атака+ |
| приоритет направления атак | `attackDirection` | 3 toggles | левый, по центру, правый (read from the `Управление` tab) |

### Numeric constants

```
PRESS_INTENSITY_DUEL_THRESHOLD = [50, 45, 40, 35, 30]   // % chance the player accepts a duel
STYLE_PRESSURE_MODIFIER        = [+4, +2, 0, -2, -4]    // % pressure per episode
FOUL_NORM_PER_MATCH            = 5
FOUL_PACE_LIMIT_MINUTES        = 15                     // faster than 1 foul / 15 min = too many
VECTOR_HIGH                    = +20                    // % — press/defence vector reads "high"
VECTOR_LOW                     = -20
VECTOR_CENTRE_COVERED          = +10                    // opponent press vector above this: avoid centre
VECTOR_ONE_TOUCH_OK            = -10                    // opponent press vector below this: one-touch works
GOOD_PASS_ACCURACY             = 70                     // % — diagonals and one-touch
CROSS_HEAVY_PER_MATCH          = 5                      // opponent crosses above this = flank team
ONE_TOUCH_STEP_XG              = 0.1                    // xG per step of one-touch passing
PHYSICAL_DRAIN_PER_STEP        = 0.175                  // 15-20% between neighbouring steps
MIN_PRESSING_PLAYERS           = 6                      // midfield+attack needed for a high press
POSITIONAL_MIDFIELD_MIN        = 3                      // players needed for позиционный выход
POSITIONAL_MIDFIELD_MAX        = 5
CLEARANCE_TARGETS_MIN          = 3                      // forward targets needed for выносы
LATE_MATCH_MINUTE              = 70                     // score rules start dominating
```

### Forbidden / warned combinations

```
defenseLine=1 (низкая) + pressHeight=3 (высокий)   — huge gap between lines
defenseLine=3 (высокая) + pressHeight=1 (низкий)   — high line left exposed
defenseLine=1 + defenseWidth=3                      — contradictory bravery
defenseLine=3 + defenseWidth=1                      — contradictory bravery
|defenseLine - pressHeight| > 1                     — must stay within one step
diagonals=3 + passSharpness>=4                      — compounding waste
attackDirection.centre + crosses=3                  — mutually opposed
all-right (tempo=3, passSharpness>=4, diagonals=3, buildOut=позиционный) — excessive risk
all-left  (tempo=1, passSharpness<=2, diagonals=1, buildOut=выносы)      — sterile
```

---

## Task 1: Project scaffold

**Files:**
- Create: `apps/soccerlife-assistant/package.json`
- Create: `apps/soccerlife-assistant/vitest.config.js`
- Create: `apps/soccerlife-assistant/.gitignore`
- Create: `apps/soccerlife-assistant/README.md`

**Step 1: Create `package.json`**

```json
{
  "name": "soccerlife-assistant",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "node build.js"
  },
  "devDependencies": {
    "esbuild": "^0.25.0",
    "happy-dom": "^17.0.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.js'],
  },
});
```

**Step 3: Create `.gitignore`**

```
node_modules/
dist/
```

**Step 4: Install and verify**

Run: `cd apps/soccerlife-assistant && npm install && npx vitest run`
Expected: `No test files found` — exits 1, which is fine; it proves vitest resolves.

**Step 5: Create `README.md`**

```markdown
# SoccerLife Tactic Assistant

Userscript for soccerlife.ru live match pages. Reads match statistics and your current
tactical settings, compares them against the game's official manual, and recommends changes.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or Violentmonkey
2. `npm install && npm run build`
3. Open `dist/soccerlife-assistant.user.js` in the browser — the extension offers to install it

## Develop

- `npm test` — run the rule engine tests
- `npm run build` — bundle to `dist/soccerlife-assistant.user.js`

Design: `docs/plans/2026-08-01-soccerlife-tactic-assistant-design.md`
```

**Step 6: Commit**

```bash
git add apps/soccerlife-assistant
git commit -m "chore(soccerlife): schelet de proiect cu vitest si esbuild"
```

---

## Task 2: Label-keyed DOM value lookup

The page renders stats as label/value pairs. Positional lookup breaks when rows move; label
lookup does not. This is the foundation of the observation layer.

**Files:**
- Create: `apps/soccerlife-assistant/src/dom.js`
- Test: `apps/soccerlife-assistant/test/dom.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { findValueByLabel, parseNumber, parsePercent, parseOrdinal } from '../src/dom.js';

function table(html) {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('findValueByLabel', () => {
  it('reads the sibling cell of a matching label', () => {
    const root = table('<table><tr><td>владение мячом, %</td><td>44.0</td></tr></table>');
    expect(findValueByLabel(root, 'владение мячом, %')).toBe('44.0');
  });

  it('ignores surrounding whitespace in the label', () => {
    const root = table('<table><tr><td>  фолов  </td><td>3</td></tr></table>');
    expect(findValueByLabel(root, 'фолов')).toBe('3');
  });

  it('returns null when the label is absent', () => {
    const root = table('<table><tr><td>угловых</td><td>2</td></tr></table>');
    expect(findValueByLabel(root, 'офсайдов')).toBe(null);
  });

  it('falls back to the parent row when the value is not a direct sibling', () => {
    const root = table('<div><div><span>вектор обороны</span></div><div>-3%</div></div>');
    expect(findValueByLabel(root, 'вектор обороны')).toBe('-3%');
  });
});

describe('parsers', () => {
  it('parses plain numbers', () => {
    expect(parseNumber('44.0')).toBe(44);
    expect(parseNumber('1785')).toBe(1785);
    expect(parseNumber('nope')).toBe(null);
  });

  it('parses signed percentages', () => {
    expect(parsePercent('-3%')).toBe(-3);
    expect(parsePercent('+14%')).toBe(14);
    expect(parsePercent('0%')).toBe(0);
  });

  it('parses N/M ordinals', () => {
    expect(parseOrdinal('3/3')).toEqual({ level: 3, scale: 3 });
    expect(parseOrdinal('интенсивность прессинга 3/5')).toEqual({ level: 3, scale: 5 });
    expect(parseOrdinal('смешанный')).toBe(null);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/dom.test.js`
Expected: FAIL — `Failed to resolve import "../src/dom.js"`

**Step 3: Write the implementation**

```js
// src/dom.js — label-keyed lookup, resilient to layout changes

const VALUE_RE = /^[+-]?[\d.,]+%?$/;

/**
 * Find the value paired with a label. Tries, in order:
 *   1. the label element's next sibling
 *   2. the label's parent's next sibling (label wrapped in its own cell)
 * Returns the trimmed text, or null.
 */
export function findValueByLabel(root, label) {
  const target = label.trim();
  const candidates = root.querySelectorAll('td, th, div, span, li, b, strong');

  for (const el of candidates) {
    if (el.textContent.trim() !== target) continue;

    const sibling = el.nextElementSibling;
    if (sibling) return sibling.textContent.trim();

    const parentSibling = el.parentElement?.nextElementSibling;
    if (parentSibling) return parentSibling.textContent.trim();
  }
  return null;
}

/** Parse a plain number, tolerating comma decimals. Returns null if not numeric. */
export function parseNumber(text) {
  if (text == null) return null;
  const cleaned = String(text).trim().replace(',', '.').replace('%', '');
  if (!/^[+-]?[\d.]+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Parse a signed percentage such as "-3%" or "+14%". */
export function parsePercent(text) {
  return parseNumber(text);
}

/** Parse an "N/M" ordinal anywhere in the string. Returns {level, scale} or null. */
export function parseOrdinal(text) {
  if (text == null) return null;
  const m = String(text).match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  return { level: Number(m[1]), scale: Number(m[2]) };
}

export { VALUE_RE };
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/dom.test.js`
Expected: PASS — 7 tests

**Step 5: Commit**

```bash
git add src/dom.js test/dom.test.js
git commit -m "feat(soccerlife): valorile se caută după etichetă, nu după poziție"
```

---

## Task 3: Parse per-team match statistics

**Files:**
- Create: `apps/soccerlife-assistant/src/observe/stats.js`
- Create: `apps/soccerlife-assistant/test/fixtures/stats-block.js`
- Test: `apps/soccerlife-assistant/test/observe-stats.test.js`

**Step 1: Create the fixture**

```js
// test/fixtures/stats-block.js — mirrors the real per-team stats table
export const statsBlockHtml = `
<table>
  <tr><td>Сила состава на поле</td><td>1785</td></tr>
  <tr><td>владение мячом, %</td><td>44.0</td></tr>
  <tr><td>всего ударов</td><td>3</td></tr>
  <tr><td>ударов в створ</td><td>0</td></tr>
  <tr><td>xG ударов</td><td>0.25</td></tr>
  <tr><td>точных передач</td><td>39</td></tr>
  <tr><td>неточных передач</td><td>4</td></tr>
  <tr><td>Кол-во ТТД</td><td>100</td></tr>
  <tr><td>брак ТТД, %</td><td>19</td></tr>
  <tr><td>вектор обороны</td><td>-3%</td></tr>
  <tr><td>вектор прессинга</td><td>+3%</td></tr>
  <tr><td>фолов</td><td>0</td></tr>
  <tr><td>угловых</td><td>0</td></tr>
  <tr><td>офсайдов</td><td>0</td></tr>
  <tr><td>индивид.действия</td><td>7</td></tr>
</table>`;
```

**Step 2: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { readTeamStats } from '../src/observe/stats.js';
import { statsBlockHtml } from './fixtures/stats-block.js';

function root(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('readTeamStats', () => {
  const stats = readTeamStats(root(statsBlockHtml));

  it('reads the vectors with their sign', () => {
    expect(stats.defenseVector).toBe(-3);
    expect(stats.pressVector).toBe(3);
  });

  it('reads squad strength and possession', () => {
    expect(stats.squadStrength).toBe(1785);
    expect(stats.possession).toBe(44);
  });

  it('reads shooting and passing', () => {
    expect(stats.shots).toBe(3);
    expect(stats.shotsOnTarget).toBe(0);
    expect(stats.xG).toBe(0.25);
    expect(stats.passesAccurate).toBe(39);
    expect(stats.passesInaccurate).toBe(4);
  });

  it('reads discipline counters', () => {
    expect(stats.fouls).toBe(0);
    expect(stats.corners).toBe(0);
    expect(stats.offsides).toBe(0);
  });

  it('returns null for fields absent from the page', () => {
    expect(stats.xT).toBe(null);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run test/observe-stats.test.js`
Expected: FAIL — cannot resolve `../src/observe/stats.js`

**Step 4: Write the implementation**

```js
// src/observe/stats.js
import { findValueByLabel, parseNumber, parsePercent } from '../dom.js';

const NUMERIC_FIELDS = {
  squadStrength: 'Сила состава на поле',
  possession: 'владение мячом, %',
  shots: 'всего ударов',
  shotsOnTarget: 'ударов в створ',
  xG: 'xG ударов',
  xT: 'xT',
  passesAccurate: 'точных передач',
  passesInaccurate: 'неточных передач',
  ttdCount: 'Кол-во ТТД',
  ttdErrorPct: 'брак ТТД, %',
  fouls: 'фолов',
  corners: 'угловых',
  offsides: 'офсайдов',
  individualActions: 'индивид.действия',
};

const PERCENT_FIELDS = {
  defenseVector: 'вектор обороны',
  pressVector: 'вектор прессинга',
};

/** Read one team's statistics block. Missing fields come back as null, never undefined. */
export function readTeamStats(root) {
  const stats = {};
  for (const [key, label] of Object.entries(NUMERIC_FIELDS)) {
    stats[key] = parseNumber(findValueByLabel(root, label));
  }
  for (const [key, label] of Object.entries(PERCENT_FIELDS)) {
    stats[key] = parsePercent(findValueByLabel(root, label));
  }
  return stats;
}

export { NUMERIC_FIELDS, PERCENT_FIELDS };
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run test/observe-stats.test.js`
Expected: PASS — 5 tests

**Step 6: Commit**

```bash
git add src/observe/stats.js test/observe-stats.test.js test/fixtures/stats-block.js
git commit -m "feat(soccerlife): statisticile unei echipe se citesc din blocul ei"
```

---

## Task 4: Parse own tactical settings

**Files:**
- Create: `apps/soccerlife-assistant/src/observe/settings.js`
- Create: `apps/soccerlife-assistant/test/fixtures/settings-panel.js`
- Test: `apps/soccerlife-assistant/test/observe-settings.test.js`

**Step 1: Create the fixture**

Mirrors the real `Настройки на матч` panel — each row is one line of text.

```js
// test/fixtures/settings-panel.js
export const settingsPanelHtml = `
<div id="settings">
  <div>Настройки на матч</div>
  <div>Бонус на морали: нет</div>
  <div>высота линии обороны 3/3</div>
  <div>высота прессинга 3/3</div>
  <div>ширина обороны 3/3</div>
  <div>интенсивность прессинга 3/5</div>
  <div>выход из обороны смешанный</div>
  <div>темп розыгрыша мяча 2/3</div>
  <div>диагональные передачи 2/3</div>
  <div>пасы в одно касание 2/3</div>
  <div>острота передач 3/5</div>
  <div>дриблинг 2/5</div>
  <div>навесы в штрафную 2/3</div>
  <div>подача стандартов навес</div>
  <div>дальний удар 2/3</div>
  <div>стиль игры обычн</div>
  <div>КомТрен[штрафн] 0.24</div>
  <div>КомТрен[кросс] 0.24</div>
  <div>КомТрен[диагон] 0.00</div>
</div>`;
```

**Step 2: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { readSettings } from '../src/observe/settings.js';
import { settingsPanelHtml } from './fixtures/settings-panel.js';

function root(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('readSettings', () => {
  const s = readSettings(root(settingsPanelHtml));

  it('reads N/3 ordinals as levels', () => {
    expect(s.defenseLine).toBe(3);
    expect(s.tempo).toBe(2);
    expect(s.diagonals).toBe(2);
  });

  it('reads N/5 ordinals as levels', () => {
    expect(s.pressIntensity).toBe(3);
    expect(s.passSharpness).toBe(3);
    expect(s.dribbling).toBe(2);
  });

  it('reads enum settings by their word', () => {
    expect(s.buildOut).toBe('смешанный');
    expect(s.setPieces).toBe('навес');
    expect(s.style).toBe('обычн');
  });

  it('reads the morale bonus', () => {
    expect(s.moraleBonus).toBe(false);
  });

  it('reads team training coefficients', () => {
    expect(s.training['диагон']).toBe(0);
    expect(s.training['кросс']).toBe(0.24);
  });

  it('returns null for settings not in the panel', () => {
    expect(s.attackDirection).toBe(null);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run test/observe-settings.test.js`
Expected: FAIL — cannot resolve module

**Step 4: Write the implementation**

```js
// src/observe/settings.js
import { parseOrdinal, parseNumber } from '../dom.js';

const ORDINAL_SETTINGS = {
  defenseLine: 'высота линии обороны',
  pressHeight: 'высота прессинга',
  defenseWidth: 'ширина обороны',
  pressIntensity: 'интенсивность прессинга',
  tempo: 'темп розыгрыша мяча',
  diagonals: 'диагональные передачи',
  oneTouch: 'пасы в одно касание',
  passSharpness: 'острота передач',
  dribbling: 'дриблинг',
  crosses: 'навесы в штрафную',
  longShots: 'дальний удар',
};

const ENUM_SETTINGS = {
  buildOut: { label: 'выход из обороны', values: ['выносы', 'смешанный', 'позиционный'] },
  setPieces: { label: 'подача стандартов', values: ['навес', 'розыгрыш'] },
  style: { label: 'стиль игры', values: ['защ+', 'защита', 'обычн', 'атака', 'атака+'] },
};

/** Split the panel into trimmed text lines, one per row element. */
function lines(root) {
  return Array.from(root.querySelectorAll('div, td, li, p'))
    .map((el) => el.textContent.trim())
    .filter((t) => t.length > 0 && !t.includes('\n'));
}

/**
 * Read the manager's own settings from the `Настройки на матч` panel.
 * `attackDirection` is not in this panel — it is read from the Управление tab
 * by readAttackDirection() and merged in by the caller.
 */
export function readSettings(root) {
  const rows = lines(root);
  const settings = { attackDirection: null, training: {} };

  for (const [key, label] of Object.entries(ORDINAL_SETTINGS)) {
    const row = rows.find((t) => t.startsWith(label));
    const ord = row ? parseOrdinal(row) : null;
    settings[key] = ord ? ord.level : null;
  }

  for (const [key, { label, values }] of Object.entries(ENUM_SETTINGS)) {
    const row = rows.find((t) => t.startsWith(label));
    // longest match first, so "защ+" never shadows "защита"
    const sorted = [...values].sort((a, b) => b.length - a.length);
    settings[key] = row ? (sorted.find((v) => row.includes(v)) ?? null) : null;
  }

  const morale = rows.find((t) => t.startsWith('Бонус на морали'));
  settings.moraleBonus = morale ? !morale.includes('нет') : null;

  for (const row of rows) {
    const m = row.match(/КомТрен\[(.+?)\]\s*([\d.,]+)/);
    if (m) settings.training[m[1]] = parseNumber(m[2]);
  }

  return settings;
}

export { ORDINAL_SETTINGS, ENUM_SETTINGS };
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run test/observe-settings.test.js`
Expected: PASS — 6 tests

**Step 6: Commit**

```bash
git add src/observe/settings.js test/observe-settings.test.js test/fixtures/settings-panel.js
git commit -m "feat(soccerlife): setările proprii se citesc din panoul de meci"
```

---

## Task 5: Parse attack direction from the Управление tab

`приоритет направления атак` is absent from the summary panel but is one of the most influential
settings. It lives in the tactics editor as three toggle buttons, the active ones carrying a
highlight class.

**Files:**
- Create: `apps/soccerlife-assistant/src/observe/direction.js`
- Test: `apps/soccerlife-assistant/test/observe-direction.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { readAttackDirection } from '../src/observe/direction.js';

function root(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

const editor = (active) => root(`
  <div>ПРИОРИТЕТ НАПРАВЛЕНИЯ АТАК</div>
  <div>
    <button class="${active.includes('l') ? 'sel' : ''}">ЛЕВЫЙ</button>
    <button class="${active.includes('c') ? 'sel' : ''}">ПО ЦЕНТРУ</button>
    <button class="${active.includes('r') ? 'sel' : ''}">ПРАВЫЙ</button>
  </div>`);

describe('readAttackDirection', () => {
  it('reads a single active flank', () => {
    expect(readAttackDirection(editor('l'), 'sel')).toEqual({ left: true, centre: false, right: false });
  });

  it('reads flank plus centre', () => {
    expect(readAttackDirection(editor('lc'), 'sel')).toEqual({ left: true, centre: true, right: false });
  });

  it('treats none-selected as all directions, per the manual', () => {
    expect(readAttackDirection(editor(''), 'sel')).toEqual({ left: true, centre: true, right: true });
  });

  it('returns null when the editor is not on the page', () => {
    expect(readAttackDirection(root('<div>nothing</div>'), 'sel')).toBe(null);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/observe-direction.test.js`
Expected: FAIL — cannot resolve module

**Step 3: Write the implementation**

```js
// src/observe/direction.js

const BUTTONS = { left: 'ЛЕВЫЙ', centre: 'ПО ЦЕНТРУ', right: 'ПРАВЫЙ' };

/**
 * Read the three attack-direction toggles from the Управление tab.
 * Returns null when the tab is not rendered.
 *
 * Manual: "когда все три варианта выключены — это аналогично тому, как если бы
 * они были все включены" — none selected is equivalent to all selected.
 *
 * @param activeClass - class marking a selected toggle; confirm against the live page (Task 17)
 */
export function readAttackDirection(root, activeClass = 'sel') {
  const buttons = Array.from(root.querySelectorAll('button, a, div, span'));
  const found = {};

  for (const [key, text] of Object.entries(BUTTONS)) {
    const el = buttons.find((b) => b.textContent.trim().toUpperCase() === text);
    if (!el) return null;
    found[key] = el.classList.contains(activeClass);
  }

  const none = !found.left && !found.centre && !found.right;
  return none ? { left: true, centre: true, right: true } : found;
}

export { BUTTONS };
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/observe-direction.test.js`
Expected: PASS — 4 tests

**Step 5: Commit**

```bash
git add src/observe/direction.js test/observe-direction.test.js
git commit -m "feat(soccerlife): direcția atacului se citește din editorul de tactici"
```

---

## Task 6: Parse lineup, minute and score

**Files:**
- Create: `apps/soccerlife-assistant/src/observe/match.js`
- Test: `apps/soccerlife-assistant/test/observe-match.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { readClock, readLineup, countByZone } from '../src/observe/match.js';

function root(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('readClock', () => {
  it('reads minute and half from the header', () => {
    const el = root('<div>1 тайм</div><div>идёт '17 мин.</div>');
    expect(readClock(el)).toEqual({ minute: 17, half: 1 });
  });

  it('reads the second half', () => {
    const el = root('<div>2 тайм</div><div>идёт '63 мин.</div>');
    expect(readClock(el)).toEqual({ minute: 63, half: 2 });
  });

  it('returns null minute before kickoff', () => {
    expect(readClock(root('<div>не начался</div>')).minute).toBe(null);
  });
});

describe('readLineup', () => {
  const el = root(`
    <table>
      <tr><td>GK</td><td>Ф.Хаккшток</td><td>6.0</td></tr>
      <tr><td>LD</td><td>А.Дурмич</td><td>6.1</td></tr>
      <tr><td>DM2</td><td>К.Грубер</td><td>6.2</td></tr>
      <tr><td>LW</td><td>Э.Юлиан</td><td>5.8</td></tr>
      <tr><td>ST2</td><td>М.Пантич</td><td>6.1</td></tr>
    </table>`);

  it('reads slot, name and live rating', () => {
    expect(readLineup(el)).toEqual([
      { slot: 'GK', name: 'Ф.Хаккшток', rating: 6.0 },
      { slot: 'LD', name: 'А.Дурмич', rating: 6.1 },
      { slot: 'DM2', name: 'К.Грубер', rating: 6.2 },
      { slot: 'LW', name: 'Э.Юлиан', rating: 5.8 },
      { slot: 'ST2', name: 'М.Пантич', rating: 6.1 },
    ]);
  });

  it('counts players per zone', () => {
    expect(countByZone(readLineup(el))).toEqual({
      keeper: 1, defence: 1, midfield: 1, attack: 2, wingers: 1, attackingMids: 0,
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/observe-match.test.js`
Expected: FAIL — cannot resolve module

**Step 3: Write the implementation**

```js
// src/observe/match.js
import { parseNumber } from '../dom.js';

const SLOT_RE = /^(GK|LD|RD|CD[123]?|LB|RB|DM[123]?|CM[123]?|LM|RM|LW|RW|AM[123]?|ST[123]?)$/;

const ZONE = {
  keeper: /^GK$/,
  defence: /^(LD|RD|CD[123]?|LB|RB)$/,
  midfield: /^(DM[123]?|CM[123]?|LM|RM)$/,
  attack: /^(LW|RW|AM[123]?|ST[123]?)$/,
  wingers: /^(LW|RW)$/,
  attackingMids: /^AM[123]?$/,
};

/** Read the match clock. Both fields are null before kickoff. */
export function readClock(root) {
  const text = root.textContent;
  const minuteMatch = text.match(/'(\d{1,3})\s*мин/);
  const halfMatch = text.match(/([12])\s*тайм/);
  return {
    minute: minuteMatch ? Number(minuteMatch[1]) : null,
    half: halfMatch ? Number(halfMatch[1]) : null,
  };
}

/** Read a lineup as [{slot, name, rating}]. Rows without a known slot are skipped. */
export function readLineup(root) {
  const players = [];
  for (const row of root.querySelectorAll('tr')) {
    const cells = Array.from(row.querySelectorAll('td')).map((c) => c.textContent.trim());
    const slotIndex = cells.findIndex((c) => SLOT_RE.test(c));
    if (slotIndex === -1) continue;

    const rest = cells.slice(slotIndex + 1);
    const rating = rest.map(parseNumber).find((n) => n !== null && n > 0 && n <= 10);
    const name = rest.find((c) => parseNumber(c) === null);
    players.push({ slot: cells[slotIndex], name: name ?? null, rating: rating ?? null });
  }
  return players;
}

/** Count players per zone. `wingers` and `attackingMids` overlap with `attack` by design. */
export function countByZone(lineup) {
  const counts = { keeper: 0, defence: 0, midfield: 0, attack: 0, wingers: 0, attackingMids: 0 };
  for (const { slot } of lineup) {
    for (const [zone, re] of Object.entries(ZONE)) {
      if (re.test(slot)) counts[zone] += 1;
    }
  }
  return counts;
}

export { SLOT_RE, ZONE };
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/observe-match.test.js`
Expected: PASS — 5 tests

**Step 5: Commit**

```bash
git add src/observe/match.js test/observe-match.test.js
git commit -m "feat(soccerlife): ceasul si formatiile se citesc din pagina"
```

---

## Task 7: Derived state

Turns raw observations into the concepts the manual's rules are phrased in.

**Files:**
- Create: `apps/soccerlife-assistant/src/derive.js`
- Test: `apps/soccerlife-assistant/test/derive.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { derive } from '../src/derive.js';

const base = {
  clock: { minute: 40, half: 1 },
  score: { mine: 0, theirs: 0 },
  mine:   { squadStrength: 1785, fouls: 1, xT: 0.5, defenseVector: 5, pressVector: 5 },
  theirs: { squadStrength: 1713, fouls: 1, xT: 0.4, defenseVector: 0, pressVector: 0 },
  myLineup: [], theirLineup: [],
};

describe('derive', () => {
  it('calls the stronger squad the favourite', () => {
    expect(derive(base).role).toBe('favourite');
    expect(derive({ ...base, mine: { ...base.mine, squadStrength: 1500 } }).role).toBe('underdog');
  });

  it('calls near-equal squads equal', () => {
    const equal = { ...base, theirs: { ...base.theirs, squadStrength: 1780 } };
    expect(derive(equal).role).toBe('equal');
  });

  it('measures dominance by xT when present', () => {
    expect(derive(base).dominance).toBe('dominating');
  });

  it('falls back to vectors when xT is missing', () => {
    const noXt = {
      ...base,
      mine: { ...base.mine, xT: null, defenseVector: 30, pressVector: 30 },
      theirs: { ...base.theirs, xT: null, defenseVector: -30, pressVector: -30 },
    };
    expect(derive(noXt).dominance).toBe('dominating');
  });

  it('flags the late phase past minute 70', () => {
    expect(derive(base).phase).toBe('mid');
    expect(derive({ ...base, clock: { minute: 75, half: 2 } }).phase).toBe('late');
    expect(derive({ ...base, clock: { minute: 5, half: 1 } }).phase).toBe('early');
  });

  it('reports the score situation', () => {
    expect(derive(base).situation).toBe('level');
    expect(derive({ ...base, score: { mine: 0, theirs: 1 } }).situation).toBe('behind');
    expect(derive({ ...base, score: { mine: 2, theirs: 1 } }).situation).toBe('ahead');
  });

  it('computes foul pace against the 1-per-15-minutes limit', () => {
    const many = { ...base, clock: { minute: 30 }, mine: { ...base.mine, fouls: 3 } };
    expect(derive(many).foulPaceExceeded).toBe(true);
    expect(derive(base).foulPaceExceeded).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/derive.test.js`
Expected: FAIL — cannot resolve module

**Step 3: Write the implementation**

```js
// src/derive.js
import { countByZone } from './observe/match.js';

export const LATE_MATCH_MINUTE = 70;
export const EARLY_MATCH_MINUTE = 20;
export const FOUL_PACE_LIMIT_MINUTES = 15;
const STRENGTH_EQUAL_BAND = 0.03; // within 3% counts as equal

function role(mine, theirs) {
  if (mine == null || theirs == null) return 'unknown';
  const ratio = mine / theirs;
  if (ratio > 1 + STRENGTH_EQUAL_BAND) return 'favourite';
  if (ratio < 1 - STRENGTH_EQUAL_BAND) return 'underdog';
  return 'equal';
}

/**
 * Who is running the match. The manual prefers xT ("более надёжным ориентиром
 * является показатель ожидаемой угрозы"); vectors are the fallback.
 */
function dominance(mine, theirs) {
  if (mine.xT != null && theirs.xT != null) {
    if (mine.xT > theirs.xT * 1.15) return 'dominating';
    if (theirs.xT > mine.xT * 1.15) return 'dominated';
    return 'balanced';
  }
  const myVectors = (mine.defenseVector ?? 0) + (mine.pressVector ?? 0);
  const theirVectors = (theirs.defenseVector ?? 0) + (theirs.pressVector ?? 0);
  if (myVectors - theirVectors > 20) return 'dominating';
  if (theirVectors - myVectors > 20) return 'dominated';
  return 'balanced';
}

function phase(minute) {
  if (minute == null) return 'prematch';
  if (minute < EARLY_MATCH_MINUTE) return 'early';
  if (minute >= LATE_MATCH_MINUTE) return 'late';
  return 'mid';
}

function situation(score) {
  if (score.mine > score.theirs) return 'ahead';
  if (score.mine < score.theirs) return 'behind';
  return 'level';
}

export function derive(obs) {
  const minute = obs.clock?.minute ?? null;
  const fouls = obs.mine?.fouls ?? 0;

  return {
    role: role(obs.mine?.squadStrength, obs.theirs?.squadStrength),
    dominance: dominance(obs.mine ?? {}, obs.theirs ?? {}),
    phase: phase(minute),
    situation: situation(obs.score ?? { mine: 0, theirs: 0 }),
    foulPaceExceeded: minute != null && minute > 0 && fouls > minute / FOUL_PACE_LIMIT_MINUTES,
    myZones: countByZone(obs.myLineup ?? []),
    theirZones: countByZone(obs.theirLineup ?? []),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/derive.test.js`
Expected: PASS — 7 tests

**Step 5: Commit**

```bash
git add src/derive.js test/derive.test.js
git commit -m "feat(soccerlife): starea derivată separă rolul de dominație"
```

---

## Task 8: Rule engine core

Rules are data. The engine only evaluates them and sorts the output.

**Files:**
- Create: `apps/soccerlife-assistant/src/engine.js`
- Test: `apps/soccerlife-assistant/test/engine.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { runRules } from '../src/engine.js';

const ctx = { settings: { pressHeight: 3 }, mine: { pressVector: -15 }, derived: { phase: 'mid' } };

const rule = {
  id: 'demo',
  setting: 'pressHeight',
  priority: 80,
  when: (c) => c.settings.pressHeight === 3 && c.mine.pressVector < 20,
  says: () => ({ target: 2, text: 'Coboară presingul.', cite: 'блок оборона' }),
};

describe('runRules', () => {
  it('returns findings for rules whose condition holds', () => {
    const out = runRules([rule], ctx);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'demo', setting: 'pressHeight', target: 2, priority: 80 });
  });

  it('skips rules whose condition does not hold', () => {
    expect(runRules([rule], { ...ctx, mine: { pressVector: 30 } })).toEqual([]);
  });

  it('sorts findings by descending priority', () => {
    const low = { ...rule, id: 'low', priority: 10 };
    const out = runRules([low, rule], ctx);
    expect(out.map((f) => f.id)).toEqual(['demo', 'low']);
  });

  it('survives a rule that throws, and reports it', () => {
    const broken = { id: 'boom', setting: 'x', priority: 5, when: () => { throw new Error('nope'); }, says: () => ({}) };
    const out = runRules([broken, rule], ctx);
    expect(out.map((f) => f.id)).toEqual(['demo']);
  });

  it('drops a recommendation that matches the current setting', () => {
    const noop = { ...rule, id: 'noop', says: () => ({ target: 3, text: 'stay', cite: 'x' }) };
    expect(runRules([noop], ctx)).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/engine.test.js`
Expected: FAIL — cannot resolve module

**Step 3: Write the implementation**

```js
// src/engine.js

/**
 * Evaluate rules against a context and return the findings that apply.
 *
 * A finding is dropped when its target equals what is already set — the manual's
 * advice is only interesting when it differs from the current tactic.
 *
 * A rule that throws is skipped rather than taking the panel down: a stale
 * selector must degrade the assistant, not break the page.
 */
export function runRules(rules, ctx) {
  const findings = [];

  for (const rule of rules) {
    let applies;
    try {
      applies = rule.when(ctx);
    } catch (err) {
      console.warn(`[soccerlife] rule ${rule.id} failed:`, err);
      continue;
    }
    if (!applies) continue;

    let said;
    try {
      said = rule.says(ctx);
    } catch (err) {
      console.warn(`[soccerlife] rule ${rule.id} says() failed:`, err);
      continue;
    }

    const current = ctx.settings?.[rule.setting];
    if (said.target != null && current != null && said.target === current) continue;

    findings.push({
      id: rule.id,
      setting: rule.setting,
      priority: rule.priority,
      current,
      ...said,
    });
  }

  return findings.sort((a, b) => b.priority - a.priority);
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/engine.test.js`
Expected: PASS — 5 tests

**Step 5: Commit**

```bash
git add src/engine.js test/engine.test.js
git commit -m "feat(soccerlife): motorul evaluează reguli si tace când nu-i nimic de schimbat"
```

---

## Task 9: Defence-block rules

**Files:**
- Create: `apps/soccerlife-assistant/src/rules/constants.js`
- Create: `apps/soccerlife-assistant/src/rules/defense.js`
- Test: `apps/soccerlife-assistant/test/rules-defense.test.js`

**Step 1: Create the constants module**

```js
// src/rules/constants.js — every number here comes from the manual
export const VECTOR_HIGH = 20;
export const VECTOR_LOW = -20;
export const VECTOR_CENTRE_COVERED = 10;
export const VECTOR_ONE_TOUCH_OK = -10;
export const FOUL_NORM_PER_MATCH = 5;
export const GOOD_PASS_ACCURACY = 70;
export const CROSS_HEAVY_PER_MATCH = 5;
export const MIN_PRESSING_PLAYERS = 6;
export const POSITIONAL_MIDFIELD_MIN = 3;
export const CLEARANCE_TARGETS_MIN = 3;

export const PRESS_INTENSITY_DUEL_THRESHOLD = [50, 45, 40, 35, 30];
export const STYLE_PRESSURE_MODIFIER = [4, 2, 0, -2, -4];

export const LEVEL_NAME = {
  defenseLine: ['низкая', 'средняя', 'высокая'],
  pressHeight: ['низкий', 'средний', 'высокий'],
  defenseWidth: ['узкая', 'средняя', 'широкая'],
  pressIntensity: ['мин', 'низкая', 'средняя', 'высокая', 'макс'],
  tempo: ['низкий', 'средний', 'высокий'],
  diagonals: ['редко', 'умеренно', 'часто'],
  oneTouch: ['редко', 'умеренно', 'часто'],
  passSharpness: ['мин', 'низкая', 'средняя', 'высокая', 'макс'],
  crosses: ['редко', 'умеренно', 'часто'],
};

export function nameOf(setting, level) {
  return LEVEL_NAME[setting]?.[level - 1] ?? String(level);
}
```

**Step 2: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { defenseRules } from '../src/rules/defense.js';
import { runRules } from '../src/engine.js';

const ctx = (over = {}) => ({
  settings: { defenseLine: 2, pressHeight: 2, defenseWidth: 2, pressIntensity: 3, ...over.settings },
  mine: { defenseVector: 0, pressVector: 0, fouls: 0, ...over.mine },
  theirs: { defenseVector: 0, pressVector: 0, crosses: 0, ...over.theirs },
  derived: { role: 'equal', phase: 'mid', situation: 'level', foulPaceExceeded: false,
             myZones: { midfield: 4, attack: 3, wingers: 2 },
             theirZones: { wingers: 0, attackingMids: 1 }, ...over.derived },
});

const ids = (c) => runRules(defenseRules, c).map((f) => f.id);

describe('defence rules — feedback loops', () => {
  it('drops the press when a high press is not producing a high vector', () => {
    const c = ctx({ settings: { pressHeight: 3 }, mine: { pressVector: -15 } });
    expect(ids(c)).toContain('press-not-working');
    expect(runRules(defenseRules, c).find((f) => f.id === 'press-not-working').target).toBe(2);
  });

  it('leaves a high press alone when the vector confirms it', () => {
    expect(ids(ctx({ settings: { pressHeight: 3 }, mine: { pressVector: 25 } })))
      .not.toContain('press-not-working');
  });

  it('lowers a high line that is being pushed back', () => {
    expect(ids(ctx({ settings: { defenseLine: 3 }, mine: { defenseVector: -5 } })))
      .toContain('line-too-brave');
  });

  it('offers to raise a passive line that is winning anyway', () => {
    expect(ids(ctx({ settings: { defenseLine: 1 }, mine: { defenseVector: 15 } })))
      .toContain('line-can-rise');
  });
});

describe('defence rules — fouls', () => {
  it('lowers intensity when fouls run ahead of pace', () => {
    expect(ids(ctx({ derived: { foulPaceExceeded: true } }))).toContain('fouls-too-many');
  });

  it('stops blaming intensity once it is already low', () => {
    const c = ctx({ settings: { pressIntensity: 2 }, derived: { foulPaceExceeded: true } });
    expect(ids(c)).toContain('fouls-not-intensity');
    expect(ids(c)).not.toContain('fouls-too-many');
  });
});

describe('defence rules — opponent shape', () => {
  it('widens the defence against a crossing team', () => {
    expect(ids(ctx({ theirs: { crosses: 7 } }))).toContain('wide-vs-crosses');
  });

  it('narrows the defence against a centre-heavy shape with no wingers', () => {
    expect(ids(ctx({ derived: { theirZones: { wingers: 0, attackingMids: 2 } } })))
      .toContain('narrow-vs-centre');
  });

  it('stays medium when the opponent has both wingers and attacking mids', () => {
    expect(ids(ctx({ derived: { theirZones: { wingers: 2, attackingMids: 1 } } })))
      .toContain('width-signals-conflict');
  });
});

describe('defence rules — high press needs bodies', () => {
  it('warns when a high press lacks the players to execute it', () => {
    const c = ctx({ settings: { pressHeight: 3 }, derived: { myZones: { midfield: 2, attack: 2 } } });
    expect(ids(c)).toContain('press-understaffed');
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run test/rules-defense.test.js`
Expected: FAIL — cannot resolve `../src/rules/defense.js`

**Step 4: Write the implementation**

```js
// src/rules/defense.js — блок «оборона»
import {
  VECTOR_HIGH, VECTOR_LOW, CROSS_HEAVY_PER_MATCH, MIN_PRESSING_PLAYERS, nameOf,
} from './constants.js';

export const defenseRules = [
  {
    id: 'press-not-working',
    setting: 'pressHeight',
    priority: 90,
    when: (c) => c.settings.pressHeight === 3 && c.mine.pressVector != null
      && c.mine.pressVector < VECTOR_HIGH,
    says: (c) => ({
      target: 2,
      text: `Presing înalt, dar vectorul tău e ${c.mine.pressVector}% (sub +${VECTOR_HIGH}%). `
        + 'Iei dezavantajele — spații în spate și faulturi — fără avantaje. Coboară la средний.',
      cite: 'Оборона → высота прессинга: «при высоком прессинге значение вектора ниже нормы '
        + 'означает неэффективный прессинг… лучше поставить средний прессинг»',
    }),
  },
  {
    id: 'press-understaffed',
    setting: 'pressHeight',
    priority: 85,
    when: (c) => c.settings.pressHeight === 3
      && (c.derived.myZones.midfield + c.derived.myZones.attack) < MIN_PRESSING_PLAYERS,
    says: (c) => ({
      target: 2,
      text: `Presing înalt cu doar ${c.derived.myZones.midfield + c.derived.myZones.attack} `
        + `jucători de mijloc și atac. Manualul cere minimum ${MIN_PRESSING_PLAYERS}: `
        + 'altfel îți dezgolești spatele fără să câștigi nimic.',
      cite: 'Оборона → высота прессинга: «для эффективного высокого прессинга вам нужно '
        + 'минимум 6 игроков полузащиты и атаки»',
    }),
  },
  {
    id: 'line-too-brave',
    setting: 'defenseLine',
    priority: 90,
    when: (c) => c.settings.defenseLine === 3 && c.mine.defenseVector != null
      && c.mine.defenseVector <= 0,
    says: (c) => ({
      target: 2,
      text: `Linie înaltă, dar vectorul de apărare e ${c.mine.defenseVector}%. Adversarul te `
        + 'ține lipit de careu — linia înaltă doar te face vulnerabil. Coboar-o.',
      cite: 'Оборона → высота линии: «вы поставили высокую оборону, а ваш вектор обороны '
        + 'нейтральный или даже отрицательный… лучше её снизить»',
    }),
  },
  {
    id: 'line-can-rise',
    setting: 'defenseLine',
    priority: 60,
    when: (c) => c.settings.defenseLine <= 2 && c.mine.defenseVector != null
      && c.mine.defenseVector > 0,
    says: (c) => ({
      target: c.settings.defenseLine + 1,
      text: `Vectorul tău de apărare e +${c.mine.defenseVector}% pe setări pasive — presezi bine `
        + 'fără să încerci. Poți urca linia ca să exploatezi.',
      cite: 'Оборона → высота линии: «вы поставили среднюю или низкую оборону, а ваш вектор '
        + 'обороны положительный… имеет смысл сыграть смелее»',
    }),
  },
  {
    id: 'fouls-too-many',
    setting: 'pressIntensity',
    priority: 80,
    when: (c) => c.derived.foulPaceExceeded && c.settings.pressIntensity >= 3,
    says: (c) => ({
      target: c.settings.pressIntensity - 1,
      text: `Faulturi peste normă (${c.mine.fouls} la minutul ${c.mine.minute ?? '?'}). `
        + `Coboară intensitatea la ${nameOf('pressIntensity', c.settings.pressIntensity - 1)}.`,
      cite: 'Оборона → интенсивность: «если вы идёте по графику быстрее одного фола за 15 минут, '
        + 'то стоит снизить интенсивность прессинга»',
    }),
  },
  {
    id: 'fouls-not-intensity',
    setting: 'pressIntensity',
    priority: 75,
    when: (c) => c.derived.foulPaceExceeded && c.settings.pressIntensity <= 2,
    says: () => ({
      target: null,
      text: 'Faulturi multe deși intensitatea e deja mică. Cauza e în altă parte: schema, '
        + 'rolurile ПИ, înălțimea apărării/presingului sau superioritatea adversarului. '
        + 'Nu mai coborî intensitatea — nu ajută.',
      cite: 'Оборона → интенсивность: «если игроки часто нарушают правила даже на интенсивности '
        + '2-3, то это практически гарантия того, что дело не в интенсивности прессинга»',
    }),
  },
  {
    id: 'wide-vs-crosses',
    setting: 'defenseWidth',
    priority: 70,
    when: (c) => (c.theirs.crosses ?? 0) > CROSS_HEAVY_PER_MATCH && c.settings.defenseWidth < 3,
    says: (c) => ({
      target: 3,
      text: `Adversarul a centrat de ${c.theirs.crosses} ori — joacă pe flancuri. `
        + 'Apărare lată ca să-i contrezi.',
      cite: 'Оборона → ширина: «высокая частота навесов (больше 5 за игру) указывает на то, '
        + 'что оппонент выстраивает игру через фланги и широкая оборона может «законтрить» его»',
    }),
  },
  {
    id: 'narrow-vs-centre',
    setting: 'defenseWidth',
    priority: 65,
    when: (c) => c.derived.theirZones.wingers === 0
      && c.derived.theirZones.attackingMids >= 2 && c.settings.defenseWidth > 1,
    says: () => ({
      target: 1,
      text: 'Adversarul n-are extreme, dar are mai mulți AM — joacă prin centru. '
        + 'Apărare îngustă ca să închizi zonele centrale.',
      cite: 'Оборона → ширина: «узкая оборона… может быть эффективна против команд, которые '
        + 'играют через центр и избегают навесов, особенно вкупе с отсутствием LW/RW»',
    }),
  },
  {
    id: 'width-signals-conflict',
    setting: 'defenseWidth',
    priority: 30,
    when: (c) => c.derived.theirZones.wingers > 0
      && c.derived.theirZones.attackingMids > 0 && c.settings.defenseWidth !== 2,
    says: () => ({
      target: 2,
      text: 'Adversarul are și extreme (semnal pentru lat) și AM (semnal pentru îngust). '
        + 'Semnale contradictorii — rămâi pe medie.',
      cite: 'Оборона → ширина: «если видите противоречие и не можете определиться, '
        + 'то придерживайтесь средней ширины обороны»',
    }),
  },
];
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run test/rules-defense.test.js`
Expected: PASS — 10 tests

**Step 6: Commit**

```bash
git add src/rules/constants.js src/rules/defense.js test/rules-defense.test.js
git commit -m "feat(soccerlife): regulile de apărare compară intenția cu vectorul măsurat"
```

---

## Task 10: Build-up-block rules

**Files:**
- Create: `apps/soccerlife-assistant/src/rules/buildup.js`
- Test: `apps/soccerlife-assistant/test/rules-buildup.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { buildupRules } from '../src/rules/buildup.js';
import { runRules } from '../src/engine.js';

const ctx = (over = {}) => ({
  settings: { tempo: 2, diagonals: 2, oneTouch: 2, buildOut: 'смешанный', style: 'обычн',
              attackDirection: { left: true, centre: true, right: true }, ...over.settings },
  mine: { ...over.mine },
  theirs: { defenseVector: 0, pressVector: 0, ...over.theirs },
  derived: { role: 'equal', phase: 'mid', situation: 'level',
             myZones: { midfield: 4, attack: 3 }, ...over.derived },
  training: over.training ?? {},
});

const ids = (c) => runRules(buildupRules, c).map((f) => f.id);

describe('tempo from opponent vectors', () => {
  it('raises tempo when they press high and defend low', () => {
    expect(ids(ctx({ theirs: { pressVector: 25, defenseVector: -25 } }))).toContain('tempo-high');
  });

  it('lowers tempo when they press low and defend high', () => {
    expect(ids(ctx({ theirs: { pressVector: -25, defenseVector: 25 } }))).toContain('tempo-low');
  });

  it('stays medium when the vectors agree', () => {
    expect(ids(ctx({ settings: { tempo: 3 }, theirs: { pressVector: 25, defenseVector: 25 } })))
      .toContain('tempo-medium');
  });
});

describe('attack direction from opponent vectors', () => {
  it('steers away from the centre when their press vector is high', () => {
    expect(ids(ctx({ theirs: { pressVector: 15 } }))).toContain('avoid-centre');
  });

  it('adds the centre when their press vector is very low', () => {
    const c = ctx({ settings: { attackDirection: { left: true, centre: false, right: true } },
                    theirs: { pressVector: -25 } });
    expect(ids(c)).toContain('add-centre');
  });
});

describe('build-out from opponent press', () => {
  it('switches to mixed against a heavy press', () => {
    expect(ids(ctx({ settings: { buildOut: 'позиционный' }, theirs: { pressVector: 25 } })))
      .toContain('buildout-mixed');
  });

  it('switches to positional against a passive press', () => {
    expect(ids(ctx({ settings: { buildOut: 'выносы' }, theirs: { pressVector: -25 } })))
      .toContain('buildout-positional');
  });

  it('warns when positional build-out lacks midfield bodies', () => {
    const c = ctx({ settings: { buildOut: 'позиционный' }, derived: { myZones: { midfield: 2, attack: 5 } } });
    expect(ids(c)).toContain('buildout-understaffed');
  });
});

describe('diagonals and one-touch', () => {
  it('raises diagonals against a passive press and a high line', () => {
    const c = ctx({ settings: { diagonals: 1 }, theirs: { pressVector: -25, defenseVector: 25 } });
    expect(ids(c)).toContain('diagonals-favourable');
  });

  it('flags a diagonals recommendation when the training is at zero', () => {
    const c = ctx({ settings: { diagonals: 1 }, theirs: { pressVector: -25, defenseVector: 25 },
                    training: { 'диагон': 0 } });
    const f = runRules(buildupRules, c).find((x) => x.id === 'diagonals-favourable');
    expect(f.caveat).toMatch(/КомТрен/);
  });

  it('raises one-touch when their press vector is below -10', () => {
    expect(ids(ctx({ settings: { oneTouch: 1 }, theirs: { pressVector: -15 } })))
      .toContain('one-touch-favourable');
  });
});

describe('style from dominance and score', () => {
  it('raises the style when dominating', () => {
    expect(ids(ctx({ derived: { dominance: 'dominating' } }))).toContain('style-up');
  });

  it('late and behind overrides everything', () => {
    const c = ctx({ derived: { dominance: 'dominated', phase: 'late', situation: 'behind' } });
    const out = runRules(buildupRules, c);
    expect(out[0].id).toBe('style-late-chase');
  });

  it('does not chase at minute 15', () => {
    expect(ids(ctx({ derived: { phase: 'early', situation: 'behind' } })))
      .not.toContain('style-late-chase');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/rules-buildup.test.js`
Expected: FAIL — cannot resolve module

**Step 3: Write the implementation**

```js
// src/rules/buildup.js — блок «построение атаки»
import {
  VECTOR_HIGH, VECTOR_LOW, VECTOR_CENTRE_COVERED, VECTOR_ONE_TOUCH_OK,
  POSITIONAL_MIDFIELD_MIN,
} from './constants.js';

const STYLE_ORDER = ['защ+', 'защита', 'обычн', 'атака', 'атака+'];
const styleIndex = (s) => STYLE_ORDER.indexOf(s);
const styleStep = (s, delta) =>
  STYLE_ORDER[Math.max(0, Math.min(STYLE_ORDER.length - 1, styleIndex(s) + delta))];

/** Attach a warning when the manual's advice collides with a zeroed team training. */
const trainingCaveat = (ctx, key) =>
  ctx.training?.[key] === 0
    ? `Atenție: КомТрен[${key}] = 0.00 — recomandarea e slăbită de antrenamentul lipsă.`
    : undefined;

export const buildupRules = [
  {
    id: 'tempo-high',
    setting: 'tempo',
    priority: 70,
    when: (c) => c.theirs.pressVector >= VECTOR_HIGH && c.theirs.defenseVector <= VECTOR_LOW,
    says: () => ({
      target: 3,
      text: 'Adversarul presează sus și apără jos — trece presingul repede ca să prinzi '
        + 'superioritate numerică și spațiu.',
      cite: 'Атака → темп: «прессинг +20%, оборона -20%, ставим высокий темп»',
    }),
  },
  {
    id: 'tempo-low',
    setting: 'tempo',
    priority: 70,
    when: (c) => c.theirs.pressVector <= VECTOR_LOW && c.theirs.defenseVector >= VECTOR_HIGH,
    says: () => ({
      target: 1,
      text: 'Adversarul apără sus și nu presează — n-ai unde alerga. Coboară tempoul și '
        + 'construiește răbdător.',
      cite: 'Атака → темп: «прессинг -20%, оборона +20%, ставим низкий темп»',
    }),
  },
  {
    id: 'tempo-medium',
    setting: 'tempo',
    priority: 30,
    when: (c) => Math.sign(c.theirs.pressVector) === Math.sign(c.theirs.defenseVector)
      && Math.abs(c.theirs.pressVector) >= VECTOR_HIGH,
    says: () => ({
      target: 2,
      text: 'Vectorii adversarului merg în aceeași direcție — nicio indicație clară. Tempo mediu.',
      cite: 'Атака → темп: «прессинг и оборона совпадают, ставим средний темп»',
    }),
  },
  {
    id: 'avoid-centre',
    setting: 'attackDirection',
    priority: 75,
    when: (c) => c.theirs.pressVector > VECTOR_CENTRE_COVERED
      && c.settings.attackDirection?.centre === true,
    says: (c) => ({
      target: null,
      text: `Vectorul de presing al adversarului e +${c.theirs.pressVector}% — centrul lui e `
        + 'acoperit. Scoate „по центру" și joacă pe flancuri.',
      cite: 'Атака → направление: «значение выше 10% подскажет вам, что центр оппонента хорошо '
        + 'перекрыт и продвижение через него принесёт больше вреда, чем пользы»',
    }),
  },
  {
    id: 'add-centre',
    setting: 'attackDirection',
    priority: 70,
    when: (c) => c.theirs.pressVector <= VECTOR_LOW
      && c.settings.attackDirection?.centre === false,
    says: (c) => ({
      target: null,
      text: `Vectorul lui de presing e ${c.theirs.pressVector}% — cedează centrul pentru `
        + 'compactitate. Adaugă „по центру".',
      cite: 'Атака → направление: «значение ниже -20% подсказывает, что соперник «сдаёт» центр '
        + 'ради оборонительной компактности и ваши атаки могут стать острее»',
    }),
  },
  {
    id: 'buildout-mixed',
    setting: 'buildOut',
    priority: 80,
    when: (c) => c.theirs.pressVector >= VECTOR_HIGH && c.settings.buildOut === 'позиционный',
    says: () => ({
      target: 'смешанный',
      text: 'Presing intens al adversarului îți rupe construcția de jos. Treci pe смешанный și '
        + 'mizează pe recuperări după duel aerian.',
      cite: 'Атака → выход из обороны: «высокий интенсивный прессинг (20% и выше) оппонента '
        + 'способен «сломать» ваш розыгрыш… рекомендуется использовать смешанный выход»',
    }),
  },
  {
    id: 'buildout-positional',
    setting: 'buildOut',
    priority: 70,
    when: (c) => c.theirs.pressVector <= VECTOR_LOW && c.settings.buildOut === 'выносы',
    says: () => ({
      target: 'позиционный',
      text: 'Adversarul nu-ți presează construcția — pasele scurte au risc mic și toate '
        + 'avantajele. Treci pe позиционный.',
      cite: 'Атака → выход из обороны: «позиционный выход подойдёт, если соперник не оказывает '
        + 'давления на ваш розыгрыш (вектор прессинга -20% и ниже)»',
    }),
  },
  {
    id: 'buildout-understaffed',
    setting: 'buildOut',
    priority: 65,
    when: (c) => c.settings.buildOut === 'позиционный'
      && c.derived.myZones.midfield < POSITIONAL_MIDFIELD_MIN,
    says: (c) => ({
      target: 'смешанный',
      text: `Construcție pozițională cu doar ${c.derived.myZones.midfield} jucători de mijloc. `
        + 'Manualul cere 3–5 — altfel n-ai cui pasa.',
      cite: 'Атака → выход из обороны: «позиционный выход требователен к оптимальному (3-5) '
        + 'количеству игроков средней линии»',
    }),
  },
  {
    id: 'diagonals-favourable',
    setting: 'diagonals',
    priority: 60,
    when: (c) => c.theirs.pressVector <= VECTOR_LOW && c.theirs.defenseVector >= 0
      && c.settings.diagonals < 3,
    says: (c) => ({
      target: c.settings.diagonals + 1,
      text: 'Presing pasiv plus apărare medie/înaltă la adversar — terenul ideal pentru '
        + 'diagonale și pase în adâncime.',
      cite: 'Атака → диагонали: «самая благодатная почва для сквозных передач — это '
        + 'средняя/высокая оборона и низкий прессинг»',
      caveat: trainingCaveat(c, 'диагон'),
    }),
  },
  {
    id: 'one-touch-favourable',
    setting: 'oneTouch',
    priority: 55,
    when: (c) => c.theirs.pressVector <= VECTOR_ONE_TOUCH_OK && c.settings.oneTouch < 2,
    says: (c) => ({
      target: 2,
      text: `Vectorul lui de presing e ${c.theirs.pressVector}% — pasele în atingere trec. `
        + 'Fiecare treaptă adaugă ~0.1 xG.',
      cite: 'Атака → пасы в касание: «смело включайте умеренно при «синем» (-10% и менее) '
        + 'векторе прессинга оппонента»',
      caveat: trainingCaveat(c, 'комбин'),
    }),
  },
  {
    id: 'style-up',
    setting: 'style',
    priority: 50,
    when: (c) => c.derived.dominance === 'dominating' && styleIndex(c.settings.style) < 4,
    says: (c) => ({
      target: styleStep(c.settings.style, 1),
      text: 'Domini după xT — stilul ofensiv îți dă mai mult în atac decât îți ia în apărare.',
      cite: 'Атака → стиль: «если вы доминируете и создаёте больше остроты, чем соперник, '
        + 'то атакующий стиль способен дать вам больше в атаке, чем отнять в защите»',
    }),
  },
  {
    id: 'style-down',
    setting: 'style',
    priority: 50,
    when: (c) => c.derived.dominance === 'dominated' && c.derived.phase !== 'late'
      && styleIndex(c.settings.style) > 0,
    says: (c) => ({
      target: styleStep(c.settings.style, -1),
      text: 'Adversarul domină — stilul defensiv îi crește bracul, iar ție îți ia puțin, '
        + 'fiindcă oricum ataci rar.',
      cite: 'Атака → стиль: «если доминирует соперник, то защитный стиль может «вставить палки '
        + 'в колёса» и снизить его эффективность»',
    }),
  },
  {
    id: 'style-late-chase',
    setting: 'style',
    priority: 100,
    when: (c) => c.derived.phase === 'late' && c.derived.situation === 'behind'
      && styleIndex(c.settings.style) < 4,
    says: (c) => ({
      target: styleStep(c.settings.style, 1),
      text: 'Final de meci și ești în urmă — scorul bate toate celelalte criterii. Urcă stilul.',
      cite: 'Атака → стиль: «чем ближе концовка матча, тем разумнее опираться на текущий счёт '
        + 'игры, а не вышеописанные факторы»',
    }),
  },
  {
    id: 'style-late-hold',
    setting: 'style',
    priority: 100,
    when: (c) => c.derived.phase === 'late' && c.derived.situation === 'ahead'
      && styleIndex(c.settings.style) > 0,
    says: (c) => ({
      target: styleStep(c.settings.style, -1),
      text: 'Final de meci și conduci — coboară stilul ca să închizi jocul.',
      cite: 'Атака → стиль: «каждый менеджер хотя бы раз… опускал стиль, чтобы удержать '
        + 'преимущество. Это абсолютно верная логика»',
    }),
  },
];

export { STYLE_ORDER };
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/rules-buildup.test.js`
Expected: PASS — 12 tests

**Step 5: Commit**

```bash
git add src/rules/buildup.js test/rules-buildup.test.js
git commit -m "feat(soccerlife): regulile de construcție citesc vectorii adversarului"
```

---

## Task 11: Attack-block rules (cross-referenced only)

The `Атака` block has no manual article. These rules come only from references to it inside the
two published articles, and are tagged so the panel can label them honestly.

**Files:**
- Create: `apps/soccerlife-assistant/src/rules/attack.js`
- Test: `apps/soccerlife-assistant/test/rules-attack.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { attackRules, UNCOVERED_SETTINGS } from '../src/rules/attack.js';
import { runRules } from '../src/engine.js';

const ctx = (over = {}) => ({
  settings: { passSharpness: 3, diagonals: 2, oneTouch: 2, tempo: 2, crosses: 2, dribbling: 2,
              attackDirection: { left: true, centre: true, right: true }, ...over.settings },
  mine: {}, theirs: { pressVector: 0, defenseVector: 0, ...over.theirs },
  derived: { role: 'equal', phase: 'mid', ...over.derived },
  training: {},
});

const ids = (c) => runRules(attackRules, c).map((f) => f.id);

describe('attack rules derived from cross-references', () => {
  it('flags one-touch passing paired with high sharpness', () => {
    expect(ids(ctx({ settings: { oneTouch: 3, passSharpness: 5 } })))
      .toContain('one-touch-needs-low-sharpness');
  });

  it('accepts one-touch passing with sharpness in the 1-3 band', () => {
    expect(ids(ctx({ settings: { oneTouch: 3, passSharpness: 2 } })))
      .not.toContain('one-touch-needs-low-sharpness');
  });

  it('flags frequent diagonals stacked on high sharpness', () => {
    expect(ids(ctx({ settings: { diagonals: 3, passSharpness: 5 } })))
      .toContain('diagonals-plus-sharpness');
  });

  it('recommends the bus-breaking recipe against a parked bus', () => {
    const c = ctx({ settings: { passSharpness: 5 },
                    theirs: { pressVector: -25, defenseVector: -25 } });
    expect(ids(c)).toContain('bus-breaking-sharpness');
  });

  it('flags central attacks combined with frequent crosses', () => {
    expect(ids(ctx({ settings: { crosses: 3 } }))).toContain('centre-vs-crosses');
  });

  it('lists the settings the manual does not cover', () => {
    expect(UNCOVERED_SETTINGS).toEqual(['подача стандартов', 'дальний удар']);
  });

  it('marks every rule in this file as cross-referenced', () => {
    expect(attackRules.every((r) => r.source === 'cross-reference')).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/rules-attack.test.js`
Expected: FAIL — cannot resolve module

**Step 3: Write the implementation**

```js
// src/rules/attack.js — блок «атака»
//
// There is no manual article for this block. Every rule here is derived from an explicit
// cross-reference inside the оборона / построение атаки articles, and carries
// source: 'cross-reference' so the panel can say so.
import { VECTOR_LOW } from './constants.js';

/** Settings the manual never mentions. The panel states this rather than staying silent. */
export const UNCOVERED_SETTINGS = ['подача стандартов', 'дальний удар'];

export const attackRules = [
  {
    id: 'one-touch-needs-low-sharpness',
    setting: 'passSharpness',
    priority: 45,
    source: 'cross-reference',
    when: (c) => c.settings.oneTouch === 3 && c.settings.passSharpness > 3,
    says: () => ({
      target: 3,
      text: 'Pase în atingere pe „часто" cu острота передач înaltă. Manualul le perechează cu '
        + 'острота 1–3 — altfel bracul crește degeaba.',
      cite: 'Атака → пасы в касание: «пасы в касание хорошо «дружат» с низким темпом розыгрыша '
        + 'и остротой передач в диапазоне от 1 до 3»',
    }),
  },
  {
    id: 'diagonals-plus-sharpness',
    setting: 'passSharpness',
    priority: 50,
    source: 'cross-reference',
    when: (c) => c.settings.diagonals === 3 && c.settings.passSharpness >= 4,
    says: (c) => ({
      target: 3,
      text: 'Diagonale „часто" plus острота передач înaltă — ambele cresc frecvența diagonalelor '
        + 'în jumătatea adversă. Rezultatul e brac mare și „закидушки" fără rost.',
      cite: 'Атака → диагонали: «будьте аккуратны с сочетанием частых диагоналей и высокой '
        + 'остроты передач: это может привести к огромному браку»',
    }),
  },
  {
    id: 'bus-breaking-sharpness',
    setting: 'passSharpness',
    priority: 55,
    source: 'cross-reference',
    when: (c) => c.theirs.pressVector <= VECTOR_LOW && c.theirs.defenseVector <= VECTOR_LOW
      && c.settings.passSharpness > 2,
    says: () => ({
      target: 2,
      text: 'Adversarul s-a închis (ambii vectori jos). Rețeta manualului pentru autobuz e '
        + 'tempo mic + острота mică + diagonale dese — răbdare, nu viteză.',
      cite: 'Атака → диагонали: «если вы взламываете «автобус», играете в терпеливое '
        + 'позиционное владение (низкий темп, низкая острота)»',
    }),
  },
  {
    id: 'centre-vs-crosses',
    setting: 'crosses',
    priority: 40,
    source: 'cross-reference',
    when: (c) => c.settings.attackDirection?.centre === true && c.settings.crosses === 3,
    says: () => ({
      target: 2,
      text: 'Ataci prin centru dar centrezi des în careu — manualul le numește opuse. '
        + 'Alege una.',
      cite: 'Атака → направление: «атаки по центру противоположны частым навесам на '
        + '«головастика»»',
    }),
  },
];
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/rules-attack.test.js`
Expected: PASS — 7 tests

**Step 5: Commit**

```bash
git add src/rules/attack.js test/rules-attack.test.js
git commit -m "feat(soccerlife): blocul atac primeste doar reguli din referinte incrucisate"
```

---

## Task 12: Coherence check

Runs **after** the rules, over the settings that would result. Catches combinations the manual
forbids outright, which no single rule can see.

**Files:**
- Create: `apps/soccerlife-assistant/src/rules/coherence.js`
- Test: `apps/soccerlife-assistant/test/coherence.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { checkCoherence } from '../src/rules/coherence.js';

const s = (over) => ({
  defenseLine: 2, pressHeight: 2, defenseWidth: 2, tempo: 2, diagonals: 2,
  passSharpness: 3, buildOut: 'смешанный', crosses: 2,
  attackDirection: { left: true, centre: true, right: true }, ...over,
});

const ids = (settings) => checkCoherence(settings).map((w) => w.id);

describe('checkCoherence', () => {
  it('accepts a balanced setup', () => {
    expect(checkCoherence(s())).toEqual([]);
  });

  it('rejects a low line with a high press', () => {
    expect(ids(s({ defenseLine: 1, pressHeight: 3 }))).toContain('line-press-gap');
  });

  it('rejects a high line with a low press', () => {
    expect(ids(s({ defenseLine: 3, pressHeight: 1 }))).toContain('line-press-gap');
  });

  it('allows a one-step difference between line and press', () => {
    expect(ids(s({ defenseLine: 3, pressHeight: 2 }))).not.toContain('line-press-gap');
  });

  it('rejects contradictory line and width', () => {
    expect(ids(s({ defenseLine: 3, defenseWidth: 1 }))).toContain('line-width-conflict');
    expect(ids(s({ defenseLine: 1, defenseWidth: 3 }))).toContain('line-width-conflict');
  });

  it('warns about everything pushed right', () => {
    const risky = s({ tempo: 3, passSharpness: 5, diagonals: 3, buildOut: 'позиционный' });
    expect(ids(risky)).toContain('all-right');
  });

  it('warns about everything pushed left', () => {
    const sterile = s({ tempo: 1, passSharpness: 2, diagonals: 1, buildOut: 'выносы' });
    expect(ids(sterile)).toContain('all-left');
  });

  it('carries a manual citation on every warning', () => {
    for (const w of checkCoherence(s({ defenseLine: 1, pressHeight: 3 }))) {
      expect(w.cite).toBeTruthy();
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/coherence.test.js`
Expected: FAIL — cannot resolve module

**Step 3: Write the implementation**

```js
// src/rules/coherence.js — combinations the manual forbids or warns about

export function checkCoherence(s) {
  const warnings = [];

  if (Math.abs(s.defenseLine - s.pressHeight) > 1) {
    warnings.push({
      id: 'line-press-gap',
      severity: 'error',
      text: `Linie ${s.defenseLine}/3 cu presing ${s.pressHeight}/3 — se deschide un gol între `
        + 'linii pe care adversarul îl exploatează direct.',
      cite: 'Оборона: «сочетания, которые точно не рекомендуются: низкая оборона + высокий '
        + 'прессинг, высокая оборона + низкий прессинг»',
    });
  }

  if (Math.abs(s.defenseLine - s.defenseWidth) > 1) {
    warnings.push({
      id: 'line-width-conflict',
      severity: 'error',
      text: `Linie ${s.defenseLine}/3 cu lățime ${s.defenseWidth}/3 — curaj contradictoriu.`,
      cite: 'Оборона → ширина: «противоположный выбор (низкая + широкая, высокая + узкая) '
        + 'может навредить»',
    });
  }

  const allRight = s.tempo === 3 && s.passSharpness >= 4 && s.diagonals === 3
    && s.buildOut === 'позиционный';
  if (allRight) {
    warnings.push({
      id: 'all-right',
      severity: 'warning',
      text: 'Toate setările de construcție împinse la dreapta — risc extrem de pierderi lângă '
        + 'propriul careu.',
      cite: 'Атака → выход из обороны: «все настройки «вправо» и позиционный выход… могут '
        + 'привести к огромному риску и потерям вблизи своей штрафной»',
    });
  }

  const allLeft = s.tempo === 1 && s.passSharpness <= 2 && s.diagonals === 1
    && s.buildOut === 'выносы';
  if (allLeft) {
    warnings.push({
      id: 'all-left',
      severity: 'warning',
      text: 'Toate setările de construcție împinse la stânga — posesie sterilă, fără nicio '
        + 'periculozitate.',
      cite: 'Атака → выход из обороны: «все параметры «влево» приводят к выбору более безопасных '
        + 'решений, что вкупе со «выносами» может привести к сплошным лонгболлам»',
    });
  }

  return warnings;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/coherence.test.js`
Expected: PASS — 8 tests

**Step 5: Commit**

```bash
git add src/rules/coherence.js test/coherence.test.js
git commit -m "feat(soccerlife): verificarea de coerență prinde combinațiile interzise"
```

---

## Task 13: Pre-match baseline from the cheat sheets

**Files:**
- Create: `apps/soccerlife-assistant/src/rules/baseline.js`
- Test: `apps/soccerlife-assistant/test/baseline.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { baselineFor, DEFENSE_BASELINE, BUILDUP_BASELINE } from '../src/rules/baseline.js';

describe('baseline cheat sheets', () => {
  it('covers all 12 situations in each block', () => {
    expect(Object.keys(DEFENSE_BASELINE)).toHaveLength(12);
    expect(Object.keys(BUILDUP_BASELINE)).toHaveLength(12);
  });

  it('returns the equal-match plan by default', () => {
    const plan = baselineFor({ role: 'equal', situation: 'level', phase: 'early' });
    expect(plan.defenseLine).toBe(2);
    expect(plan.pressHeight).toBe(2);
    expect(plan.buildOut).toBe('смешанный');
    expect(plan.style).toBe('обычн');
  });

  it('returns the favourite plan when stronger', () => {
    const plan = baselineFor({ role: 'favourite', situation: 'level', phase: 'early' });
    expect(plan.defenseLine).toBe(3);
    expect(plan.pressHeight).toBe(3);
    expect(plan.buildOut).toBe('позиционный');
  });

  it('returns the underdog plan when weaker', () => {
    const plan = baselineFor({ role: 'underdog', situation: 'level', phase: 'early' });
    expect(plan.defenseLine).toBe(1);
    expect(plan.defenseWidth).toBe(1);
    expect(plan.diagonals).toBe(1);
  });

  it('lets a late chasing situation override the role plan', () => {
    const plan = baselineFor({ role: 'underdog', situation: 'behind', phase: 'late' });
    expect(plan.defenseLine).toBe(3);
    expect(plan.pressIntensity).toBe(4);
    expect(plan.situationName).toBe('нужно отыграться');
  });

  it('lets a late holding situation override the role plan', () => {
    const plan = baselineFor({ role: 'favourite', situation: 'ahead', phase: 'late' });
    expect(plan.defenseLine).toBe(1);
    expect(plan.situationName).toBe('нужно удержать');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/baseline.test.js`
Expected: FAIL — cannot resolve module

**Step 3: Write the implementation**

Transcribe both 12-row cheat sheets. Level numbers use the ordinal scale from the Domain
Reference; where a sheet gives two options ("Широкая / средняя") take the first.

```js
// src/rules/baseline.js — the two шпаргалки, as lookup tables

export const DEFENSE_BASELINE = {
  'равный матч':              { defenseLine: 2, pressHeight: 2, defenseWidth: 2, pressIntensity: 3 },
  'ты фаворит':               { defenseLine: 3, pressHeight: 3, defenseWidth: 3, pressIntensity: 3 },
  'ты андердог':              { defenseLine: 1, pressHeight: 1, defenseWidth: 1, pressIntensity: 2 },
  'нужно отыграться':         { defenseLine: 3, pressHeight: 3, defenseWidth: 3, pressIntensity: 4 },
  'нужно удержать':           { defenseLine: 1, pressHeight: 1, defenseWidth: 1, pressIntensity: 3 },
  'высокий вектор обороны':   { defenseLine: 3, pressHeight: 2, defenseWidth: 3, pressIntensity: 3 },
  'низкий вектор обороны':    { defenseLine: 1, pressHeight: 2, defenseWidth: 1, pressIntensity: 3 },
  'высокий вектор прессинга': { defenseLine: 2, pressHeight: 3, defenseWidth: 2, pressIntensity: 3 },
  'низкий вектор прессинга':  { defenseLine: 2, pressHeight: 1, defenseWidth: 2, pressIntensity: 3 },
  'соперник через фланги':    { defenseLine: 1, pressHeight: 1, defenseWidth: 3, pressIntensity: 3 },
  'соперник через центр':     { defenseLine: 3, pressHeight: 3, defenseWidth: 1, pressIntensity: 3 },
  'много фолов':              { defenseLine: 2, pressHeight: 2, defenseWidth: 2, pressIntensity: 2 },
};

export const BUILDUP_BASELINE = {
  'равный матч':        { attackDirection: 'all',    buildOut: 'смешанный',   tempo: 2, diagonals: 2, oneTouch: 2, style: 'обычн' },
  'ты фаворит':         { attackDirection: 'all',    buildOut: 'позиционный', tempo: 2, diagonals: 2, oneTouch: 2, style: 'обычн' },
  'ты андердог':        { attackDirection: 'flanks', buildOut: 'смешанный',   tempo: 2, diagonals: 1, oneTouch: 1, style: 'защита' },
  'нужно забить':       { attackDirection: 'flank+centre', buildOut: 'позиционный', tempo: 2, diagonals: 2, oneTouch: 2, style: 'атака' },
  'нужно удержать':     { attackDirection: 'flanks', buildOut: 'смешанный',   tempo: 1, diagonals: 1, oneTouch: 1, style: 'защита' },
  'соперник прессингует': { attackDirection: 'flanks', buildOut: 'смешанный', tempo: 2, diagonals: 1, oneTouch: 1, style: 'обычн' },
  'соперник не прессингует': { attackDirection: 'all', buildOut: 'позиционный', tempo: 1, diagonals: 2, oneTouch: 2, style: 'обычн' },
  'взлом автобуса':     { attackDirection: 'all',    buildOut: 'позиционный', tempo: 1, diagonals: 2, oneTouch: 2, style: 'обычн' },
  'хаотичный матч':     { attackDirection: 'flanks', buildOut: 'смешанный',   tempo: 2, diagonals: 1, oneTouch: 1, style: 'обычн' },
  'игра через столба':  { attackDirection: 'flanks', buildOut: 'выносы',      tempo: 2, diagonals: 1, oneTouch: 1, style: 'обычн' },
  'схема контроля':     { attackDirection: 'all',    buildOut: 'позиционный', tempo: 1, diagonals: 2, oneTouch: 2, style: 'обычн' },
  'самолёт':            { attackDirection: 'flanks', buildOut: 'смешанный',   tempo: 3, diagonals: 1, oneTouch: 1, style: 'обычн' },
};

const ROLE_ROW = { favourite: 'ты фаворит', underdog: 'ты андердог', equal: 'равный матч' };

/**
 * Pick the starting plan. Late-match score situations override the role row, because
 * the manual says score dominates near the end.
 */
export function baselineFor({ role, situation, phase }) {
  let defenseRow = ROLE_ROW[role] ?? 'равный матч';
  let buildupRow = ROLE_ROW[role] ?? 'равный матч';

  if (phase === 'late' && situation === 'behind') {
    defenseRow = 'нужно отыграться';
    buildupRow = 'нужно забить';
  } else if (phase === 'late' && situation === 'ahead') {
    defenseRow = 'нужно удержать';
    buildupRow = 'нужно удержать';
  }

  return {
    ...DEFENSE_BASELINE[defenseRow],
    ...BUILDUP_BASELINE[buildupRow],
    situationName: defenseRow,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/baseline.test.js`
Expected: PASS — 6 tests

**Step 5: Commit**

```bash
git add src/rules/baseline.js test/baseline.test.js
git commit -m "feat(soccerlife): șpargalkele devin planul de start"
```

---

## Task 14: Assemble the analysis pipeline

**Files:**
- Create: `apps/soccerlife-assistant/src/analyse.js`
- Test: `apps/soccerlife-assistant/test/analyse.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { analyse } from '../src/analyse.js';

const obs = (over = {}) => ({
  clock: { minute: 40, half: 1 },
  score: { mine: 0, theirs: 1 },
  settings: { defenseLine: 3, pressHeight: 3, defenseWidth: 3, pressIntensity: 3,
              buildOut: 'смешанный', tempo: 2, diagonals: 2, oneTouch: 2, passSharpness: 3,
              dribbling: 2, crosses: 2, longShots: 2, style: 'обычн',
              attackDirection: { left: true, centre: true, right: true },
              training: { 'диагон': 0 } },
  mine:   { squadStrength: 1785, defenseVector: -3, pressVector: -15, fouls: 1, xT: 0.4 },
  theirs: { squadStrength: 1713, defenseVector: 4, pressVector: 14, fouls: 0, xT: 0.6, crosses: 2 },
  myLineup: [], theirLineup: [],
  ...over,
});

describe('analyse', () => {
  const result = analyse(obs());

  it('returns findings, warnings and derived state', () => {
    expect(result).toHaveProperty('findings');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('derived');
    expect(result).toHaveProperty('baseline');
  });

  it('catches the press mismatch in the sample', () => {
    expect(result.findings.map((f) => f.id)).toContain('press-not-working');
  });

  it('orders findings by priority', () => {
    const priorities = result.findings.map((f) => f.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
  });

  it('returns an empty analysis before kickoff instead of throwing', () => {
    const pre = analyse(obs({ clock: { minute: null, half: null } }));
    expect(pre.findings).toEqual([]);
    expect(pre.derived.phase).toBe('prematch');
  });

  it('never throws on missing statistics', () => {
    expect(() => analyse(obs({ mine: {}, theirs: {} }))).not.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/analyse.test.js`
Expected: FAIL — cannot resolve module

**Step 3: Write the implementation**

```js
// src/analyse.js — the whole pipeline, as one pure function
import { derive } from './derive.js';
import { runRules } from './engine.js';
import { defenseRules } from './rules/defense.js';
import { buildupRules } from './rules/buildup.js';
import { attackRules } from './rules/attack.js';
import { checkCoherence } from './rules/coherence.js';
import { baselineFor } from './rules/baseline.js';

const ALL_RULES = [...defenseRules, ...buildupRules, ...attackRules];

/**
 * Observations in, recommendations out. Pure — no DOM, no clock, no I/O.
 * Before kickoff there is nothing to measure, so only the baseline is returned.
 */
export function analyse(obs) {
  const derived = derive(obs);
  const baseline = baselineFor(derived);

  if (derived.phase === 'prematch') {
    return { findings: [], warnings: checkCoherence(obs.settings), derived, baseline };
  }

  const ctx = {
    settings: obs.settings,
    mine: { ...obs.mine, minute: obs.clock?.minute },
    theirs: obs.theirs,
    derived,
    training: obs.settings?.training ?? {},
  };

  return {
    findings: runRules(ALL_RULES, ctx),
    warnings: checkCoherence(obs.settings),
    derived,
    baseline,
  };
}

export { ALL_RULES };
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/analyse.test.js`
Expected: PASS — 5 tests

**Step 5: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — all tests green

**Step 6: Commit**

```bash
git add src/analyse.js test/analyse.test.js
git commit -m "feat(soccerlife): pipeline-ul complet, o funcție pură de la observații la sfaturi"
```

---

## Task 15: Overlay panel

**Files:**
- Create: `apps/soccerlife-assistant/src/panel.js`
- Create: `apps/soccerlife-assistant/src/panel.css.js`
- Test: `apps/soccerlife-assistant/test/panel.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { createPanel } from '../src/panel.js';

beforeEach(() => { document.body.innerHTML = ''; });

const analysis = (over = {}) => ({
  findings: [], warnings: [],
  derived: { role: 'favourite', dominance: 'balanced', phase: 'mid', situation: 'level' },
  baseline: { situationName: 'ты фаворит' },
  ...over,
});

describe('createPanel', () => {
  it('mounts a single root element', () => {
    createPanel(document.body);
    expect(document.querySelectorAll('#sl-assistant')).toHaveLength(1);
  });

  it('is idempotent — mounting twice does not duplicate', () => {
    createPanel(document.body);
    createPanel(document.body);
    expect(document.querySelectorAll('#sl-assistant')).toHaveLength(1);
  });

  it('says nothing needs attention when there are no findings', () => {
    const panel = createPanel(document.body);
    panel.render(analysis());
    expect(document.querySelector('#sl-assistant').textContent).toMatch(/nimic de schimbat/i);
  });

  it('renders a finding with its recommendation and citation', () => {
    const panel = createPanel(document.body);
    panel.render(analysis({
      findings: [{ id: 'x', setting: 'pressHeight', current: 3, target: 2,
                   text: 'Coboară presingul.', cite: 'Оборона → высота прессинга', priority: 90 }],
    }));
    const text = document.querySelector('#sl-assistant').textContent;
    expect(text).toContain('Coboară presingul.');
    expect(text).toContain('Оборона → высота прессинга');
  });

  it('shows a caveat when one is attached', () => {
    const panel = createPanel(document.body);
    panel.render(analysis({
      findings: [{ id: 'x', setting: 'diagonals', current: 1, target: 2, text: 'Urcă diagonalele.',
                   cite: 'c', caveat: 'КомТрен[диагон] = 0.00', priority: 60 }],
    }));
    expect(document.querySelector('#sl-assistant').textContent).toContain('КомТрен[диагон]');
  });

  it('renders coherence warnings separately from findings', () => {
    const panel = createPanel(document.body);
    panel.render(analysis({
      warnings: [{ id: 'line-press-gap', severity: 'error', text: 'Gol între linii.', cite: 'c' }],
    }));
    expect(document.querySelector('.sl-warnings').textContent).toContain('Gol între linii.');
  });

  it('toggles collapsed state', () => {
    const panel = createPanel(document.body);
    const root = document.querySelector('#sl-assistant');
    expect(root.classList.contains('sl-collapsed')).toBe(false);
    panel.toggle();
    expect(root.classList.contains('sl-collapsed')).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/panel.test.js`
Expected: FAIL — cannot resolve module

**Step 3: Write `src/panel.css.js`**

Exported as a string so esbuild inlines it — a userscript cannot load an external stylesheet.

```js
export const panelCss = `
#sl-assistant {
  position: fixed; top: 80px; right: 16px; width: 320px; max-height: 70vh; overflow-y: auto;
  z-index: 99999; background: #fff; border: 1px solid #ccc; border-radius: 6px;
  font: 12px/1.45 system-ui, sans-serif; color: #222; box-shadow: 0 2px 12px rgba(0,0,0,.15);
}
#sl-assistant.sl-collapsed .sl-body { display: none; }
#sl-assistant .sl-head {
  padding: 6px 10px; background: #2b3a4a; color: #fff; cursor: move;
  display: flex; justify-content: space-between; align-items: center; border-radius: 5px 5px 0 0;
}
#sl-assistant .sl-head button { background: none; border: 0; color: #fff; cursor: pointer; font-size: 14px; }
#sl-assistant .sl-body { padding: 8px 10px; }
#sl-assistant .sl-quiet { color: #777; font-style: italic; }
#sl-assistant .sl-finding { border-left: 3px solid #4a90d9; padding: 6px 8px; margin: 0 0 8px; background: #f6f9fc; }
#sl-assistant .sl-finding.sl-urgent { border-left-color: #d9534f; background: #fdf4f4; }
#sl-assistant .sl-change { font-weight: 600; display: block; margin-bottom: 2px; }
#sl-assistant .sl-cite { color: #666; font-size: 11px; display: block; margin-top: 4px; }
#sl-assistant .sl-caveat { color: #a06000; font-size: 11px; display: block; margin-top: 3px; }
#sl-assistant .sl-warnings { border-top: 1px solid #eee; margin-top: 8px; padding-top: 8px; }
#sl-assistant .sl-warn { border-left: 3px solid #e0a800; padding: 6px 8px; margin-bottom: 6px; background: #fffbf0; }
#sl-assistant .sl-warn.sl-error { border-left-color: #d9534f; background: #fdf4f4; }
`;
```

**Step 4: Write `src/panel.js`**

```js
// src/panel.js — overlay UI. The only module that touches the DOM for output.
import { panelCss } from './panel.css.js';

const URGENT_PRIORITY = 80;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderFinding(f) {
  const box = el('div', `sl-finding${f.priority >= URGENT_PRIORITY ? ' sl-urgent' : ''}`);
  const head = f.target == null
    ? f.setting
    : `${f.setting}: ${f.current ?? '?'} → ${f.target}`;
  box.append(el('span', 'sl-change', head));
  box.append(el('span', null, f.text));
  if (f.caveat) box.append(el('span', 'sl-caveat', f.caveat));
  box.append(el('span', 'sl-cite', f.cite));
  return box;
}

function renderWarning(w) {
  const box = el('div', `sl-warn${w.severity === 'error' ? ' sl-error' : ''}`);
  box.append(el('span', null, w.text));
  box.append(el('span', 'sl-cite', w.cite));
  return box;
}

/** Mount the panel once. Returns { render, toggle, destroy }. */
export function createPanel(parent = document.body) {
  const existing = document.querySelector('#sl-assistant');
  if (existing) return existing.__slApi;

  const style = el('style');
  style.textContent = panelCss;
  document.head.append(style);

  const root = el('div');
  root.id = 'sl-assistant';

  const head = el('div', 'sl-head');
  head.append(el('span', null, 'Asistent tactic'));
  const toggleBtn = el('button', null, '−');
  head.append(toggleBtn);

  const body = el('div', 'sl-body');
  root.append(head, body);
  parent.append(root);

  const api = {
    render(analysis) {
      body.innerHTML = '';

      const state = el('div', 'sl-cite',
        `${analysis.derived.role} · ${analysis.derived.dominance} · ${analysis.derived.phase}`);
      body.append(state);

      if (analysis.findings.length === 0) {
        body.append(el('p', 'sl-quiet', 'Nimic de schimbat acum.'));
      } else {
        for (const f of analysis.findings) body.append(renderFinding(f));
      }

      if (analysis.warnings.length > 0) {
        const box = el('div', 'sl-warnings');
        box.append(el('div', 'sl-change', 'Coerență'));
        for (const w of analysis.warnings) box.append(renderWarning(w));
        body.append(box);
      }
    },
    toggle() {
      root.classList.toggle('sl-collapsed');
      toggleBtn.textContent = root.classList.contains('sl-collapsed') ? '+' : '−';
    },
    destroy() {
      root.remove();
      style.remove();
    },
  };

  toggleBtn.addEventListener('click', api.toggle);
  root.__slApi = api;
  return api;
}
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run test/panel.test.js`
Expected: PASS — 7 tests

**Step 6: Commit**

```bash
git add src/panel.js src/panel.css.js test/panel.test.js
git commit -m "feat(soccerlife): panoul se aprinde doar când e ceva de spus"
```

---

## Task 16: Bootstrap and poll loop

**Files:**
- Create: `apps/soccerlife-assistant/src/observe/index.js`
- Create: `apps/soccerlife-assistant/src/main.js`
- Test: `apps/soccerlife-assistant/test/observe-index.test.js`

**Step 1: Write the failing test for the observation assembler**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { observe } from '../src/observe/index.js';
import { statsBlockHtml } from './fixtures/stats-block.js';
import { settingsPanelHtml } from './fixtures/settings-panel.js';

beforeEach(() => {
  document.body.innerHTML = `
    <div>1 тайм</div><div>идёт '17 мин.</div>
    <div id="team-a">${statsBlockHtml}</div>
    <div id="team-b">${statsBlockHtml}</div>
    ${settingsPanelHtml}`;
});

describe('observe', () => {
  it('returns a complete observation object', () => {
    const obs = observe(document, { mySide: 'home' });
    expect(obs.clock.minute).toBe(17);
    expect(obs.mine.defenseVector).toBe(-3);
    expect(obs.settings.defenseLine).toBe(3);
  });

  it('swaps sides when the manager is the away team', () => {
    document.querySelector('#team-b').innerHTML =
      statsBlockHtml.replace('<td>-3%</td>', '<td>+11%</td>');
    const obs = observe(document, { mySide: 'away' });
    expect(obs.mine.defenseVector).toBe(11);
  });

  it('does not throw when the settings panel is absent', () => {
    document.querySelector('#settings').remove();
    expect(() => observe(document, { mySide: 'home' })).not.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run test/observe-index.test.js`
Expected: FAIL — cannot resolve module

**Step 3: Write `src/observe/index.js`**

```js
// src/observe/index.js — assembles one full observation from the live page
import { readTeamStats } from './stats.js';
import { readSettings } from './settings.js';
import { readAttackDirection } from './direction.js';
import { readClock, readLineup } from './match.js';

/**
 * Selectors are the one thing that can drift with a site redesign. Keep them here,
 * documented, so a break is a one-line fix rather than an archaeology exercise.
 * Confirm each against a saved page in Task 17.
 */
export const SELECTORS = {
  homeBlock: '#team-a',
  awayBlock: '#team-b',
  settingsPanel: '#settings',
  scoreHome: '.score-home',
  scoreAway: '.score-away',
};

function readScore(root) {
  const home = root.querySelector(SELECTORS.scoreHome);
  const away = root.querySelector(SELECTORS.scoreAway);
  return {
    home: home ? Number(home.textContent.trim()) : 0,
    away: away ? Number(away.textContent.trim()) : 0,
  };
}

/** Build the observation object the analysis pipeline consumes. */
export function observe(doc, { mySide = 'home' } = {}) {
  const homeBlock = doc.querySelector(SELECTORS.homeBlock);
  const awayBlock = doc.querySelector(SELECTORS.awayBlock);
  const settingsPanel = doc.querySelector(SELECTORS.settingsPanel);

  const home = homeBlock ? readTeamStats(homeBlock) : {};
  const away = awayBlock ? readTeamStats(awayBlock) : {};
  const score = readScore(doc);
  const isHome = mySide === 'home';

  const settings = settingsPanel ? readSettings(settingsPanel) : {};
  const direction = readAttackDirection(doc);
  if (direction) settings.attackDirection = direction;

  return {
    clock: readClock(doc.body ?? doc),
    score: isHome
      ? { mine: score.home, theirs: score.away }
      : { mine: score.away, theirs: score.home },
    mine: isHome ? home : away,
    theirs: isHome ? away : home,
    myLineup: readLineup(isHome ? homeBlock ?? doc : awayBlock ?? doc),
    theirLineup: readLineup(isHome ? awayBlock ?? doc : homeBlock ?? doc),
    settings,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run test/observe-index.test.js`
Expected: PASS — 3 tests

**Step 5: Write `src/main.js`** (no test — pure wiring, verified live in Task 17)

```js
// src/main.js — userscript entry point
import { observe } from './observe/index.js';
import { analyse } from './analyse.js';
import { createPanel } from './panel.js';

const POLL_MS = 3000;
const SIDE_KEY = 'sl-assistant-side';

/**
 * Which team is the manager's. Detected from the head-coach name; falls back to a
 * stored choice, then to a prompt the user answers once.
 */
function detectSide(doc) {
  const stored = localStorage.getItem(SIDE_KEY);
  if (stored) return stored;

  const me = doc.querySelector('.user-login, #user-name')?.textContent?.trim();
  if (me) {
    const coaches = Array.from(doc.querySelectorAll('a')).filter((a) =>
      a.textContent.trim() === me);
    if (coaches.length === 1) {
      const side = coaches[0].closest('#team-b') ? 'away' : 'home';
      localStorage.setItem(SIDE_KEY, side);
      return side;
    }
  }
  return null;
}

function start() {
  const panel = createPanel(document.body);
  let side = detectSide(document);

  if (!side) {
    // Offer the choice once, then remember it.
    const choice = confirm('Asistent tactic: ești echipa gazdă? (Anulează = oaspete)');
    side = choice ? 'home' : 'away';
    localStorage.setItem(SIDE_KEY, side);
  }

  const tick = () => {
    try {
      panel.render(analyse(observe(document, { mySide: side })));
    } catch (err) {
      console.warn('[soccerlife] tick failed:', err);
    }
  };

  tick();
  setInterval(tick, POLL_MS);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
```

**Step 6: Commit**

```bash
git add src/observe/index.js src/main.js test/observe-index.test.js
git commit -m "feat(soccerlife): bucla de poll leagă observația de panou"
```

---

## Task 17: Build to a userscript

**Files:**
- Create: `apps/soccerlife-assistant/build.js`

**Step 1: Write `build.js`**

```js
// build.js — bundle src/main.js into a single installable userscript
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

const banner = `// ==UserScript==
// @name         SoccerLife Tactic Assistant
// @namespace    https://github.com/individul-apps
// @version      ${version}
// @description  Recomandă schimbări tactice pe baza manualului jocului, în timpul meciului
// @match        https://soccerlife.ru/game.php?id=*
// @match        https://www.soccerlife.ru/game.php?id=*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
`;

await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: 'dist/soccerlife-assistant.user.js',
  banner: { js: banner },
  legalComments: 'none',
});

console.log('built dist/soccerlife-assistant.user.js');
```

**Step 2: Build**

Run: `npm run build`
Expected: `built dist/soccerlife-assistant.user.js`

**Step 3: Verify the metadata block survived**

Run: `head -12 dist/soccerlife-assistant.user.js`
Expected: the `==UserScript==` block, with `@match` on `game.php?id=*`

**Step 4: Verify the bundle has no imports left**

Run: `grep -c "^import" dist/soccerlife-assistant.user.js || true`
Expected: `0` — everything inlined

**Step 5: Commit**

```bash
git add build.js
git commit -m "build(soccerlife): esbuild scoate un singur fișier .user.js"
```

---

## Task 18: Validate selectors against a real page

Every selector in `SELECTORS`, plus `readAttackDirection`'s `activeClass`, is currently a guess
based on the page text. This task replaces the guesses with facts. **The manager must do the
capture — the settings panel and the Управление tab are only rendered for a logged-in manager on
their own match.**

**Files:**
- Create: `apps/soccerlife-assistant/test/fixtures/real-match.html` (captured, not written)
- Create: `apps/soccerlife-assistant/test/real-page.test.js`
- Modify: `apps/soccerlife-assistant/src/observe/index.js` — `SELECTORS`
- Modify: `apps/soccerlife-assistant/src/observe/direction.js` — default `activeClass`

**Step 1: Capture the page**

Ask the manager, during one of their own live matches, to:
1. Open the `Управление` tab so the direction toggles are in the DOM
2. Right-click → *Save page as* → **Webpage, Complete** (or Ctrl+S)
3. Save the `.html` to `apps/soccerlife-assistant/test/fixtures/real-match.html`

**Step 2: Inspect the real structure**

```bash
grep -o 'вектор обороны.\{0,200\}' test/fixtures/real-match.html | head -3
grep -o 'высота линии обороны.\{0,120\}' test/fixtures/real-match.html | head -3
grep -o 'ЛЕВЫЙ.\{0,200\}' test/fixtures/real-match.html | head -3
```

Read the surrounding markup and note the actual container ids/classes and the class marking a
selected direction toggle.

**Step 3: Write the integration test**

```js
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { observe } from '../src/observe/index.js';
import { analyse } from '../src/analyse.js';

const FIXTURE = new URL('./fixtures/real-match.html', import.meta.url);
const describeIfCaptured = existsSync(FIXTURE) ? describe : describe.skip;

describeIfCaptured('real captured match page', () => {
  const load = () => {
    document.documentElement.innerHTML = readFileSync(FIXTURE, 'utf8');
    return observe(document, { mySide: 'home' });
  };

  it('reads both vectors', () => {
    const obs = load();
    expect(obs.mine.defenseVector).not.toBe(null);
    expect(obs.mine.pressVector).not.toBe(null);
    expect(obs.theirs.pressVector).not.toBe(null);
  });

  it('reads every ordinal setting', () => {
    const s = load().settings;
    for (const key of ['defenseLine', 'pressHeight', 'defenseWidth', 'pressIntensity',
                       'tempo', 'diagonals', 'oneTouch', 'passSharpness']) {
      expect(s[key], `${key} not read`).toBeGreaterThanOrEqual(1);
    }
  });

  it('reads the enum settings and the attack direction', () => {
    const s = load().settings;
    expect(s.buildOut).toBeTruthy();
    expect(s.style).toBeTruthy();
    expect(s.attackDirection).not.toBe(null);
  });

  it('reads the clock and both lineups', () => {
    const obs = load();
    expect(obs.clock.minute).toBeGreaterThan(0);
    expect(obs.myLineup.length).toBeGreaterThanOrEqual(11);
    expect(obs.theirLineup.length).toBeGreaterThanOrEqual(11);
  });

  it('produces an analysis without throwing', () => {
    expect(() => analyse(load())).not.toThrow();
  });
});
```

**Step 4: Run it and fix the selectors**

Run: `npx vitest run test/real-page.test.js`
Expected: FAIL on the first run. For each failure, correct `SELECTORS` in
`src/observe/index.js` (or `activeClass` in `direction.js`) to match the real markup, then re-run
until green. Do **not** loosen the assertions to make them pass — the point of this task is that
the selectors are right.

**Step 5: Confirm nothing else regressed**

Run: `npx vitest run`
Expected: PASS — the whole suite

**Step 6: Commit**

```bash
git add test/fixtures/real-match.html test/real-page.test.js src/observe/
git commit -m "test(soccerlife): selectorii se verifică pe o pagină reală, nu pe presupuneri"
```

---

## Task 19: Live run

**Step 1: Install the built script**

Run: `npm run build`, then open `dist/soccerlife-assistant.user.js` in the browser and accept the
Tampermonkey install prompt.

**Step 2: Open a live match and watch for one half**

Confirm, and record in the README under a "Known behaviour" heading:
- The panel mounts and stays out of the way
- Own team is detected correctly (or the one-time prompt appears and is remembered)
- Findings appear and change as the vectors move
- No console errors over a full half
- The panel updates within ~3s of a stat changing on the page

**Step 3: Fix whatever the run exposes, with a test first**

Each defect gets a failing test in the relevant `test/*.test.js` before the fix, per the pattern
in Tasks 2–16.

**Step 4: Commit**

```bash
git add -A
git commit -m "fix(soccerlife): corecții după prima rulare pe un meci real"
```

---

## Verification

Whole suite green:

```bash
cd apps/soccerlife-assistant && npm test
```

Build produces an installable script:

```bash
npm run build && head -12 dist/soccerlife-assistant.user.js
```

## Deferred

- `Атака` block full rules — blocked on a manual article that does not exist. `src/rules/attack.js`
  takes them without restructuring when it does.
- Post-match report (which recommendations were followed, what the result was) — needs a match
  history store; out of scope for v1.
- LLM escalation for ambiguous states — the design keeps the door open, but the rules must be
  shown to be too rigid before it is worth the cost.
