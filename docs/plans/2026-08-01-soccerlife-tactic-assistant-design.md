# SoccerLife Tactic Assistant — Design Document

## Overview

A browser userscript that runs on live match pages of [soccerlife.ru](https://soccerlife.ru)
("Живи Футболом", a Hattrick-style online football manager) and recommends in-match
tactical setting changes, derived from the game's official tactics manual.

The game runs matches live over ~25–30 real minutes, and the manager can change tactical
settings mid-match. The manual defines when each setting works — with numeric thresholds —
but a manager cannot evaluate ~70 conditions against live statistics under time pressure.
The script does that continuously and surfaces only what needs action.

## Requirements

- Read live match state from the match page without a server or API key
- Compare the manager's *current* settings against their *measured effect* and flag mismatches
- Cite the manual rule behind each recommendation
- Never act on the manager's behalf — advise only
- Zero running cost, zero infrastructure

## Key Decisions

| Decision | Rationale |
|---|---|
| Userscript, not a web app or extension | Runs inside the manager's own browser session on a page they already have open. No scraping from a server (`robots.txt` allows `/game.php?id=*` for generic agents but disallows `/ajax/`), no CORS, no hosting, no cost. |
| Rules engine, not an LLM | The manual is quantitative — nearly every rule has a numeric threshold readable from the page. Rules are instant, free, deterministic, and explainable. An LLM layer can be added later if rules prove too rigid. |
| Read the DOM by Russian label text, not by position | Labels (`владение мячом, %`, `вектор обороны`) are user-facing strings and change rarely; AJAX payload shapes and row order do not. Most robust option available. |
| Advise, never apply | Auto-applying settings would risk the account. The manager reads the panel and applies changes in the `Управление` tab. |

## Architecture

```
soccerlife.ru/game.php?id=*
        │
        │  DOM poll every ~3s (label-keyed lookup)
        ▼
  ┌─────────────────┐
  │  Observation    │  raw numbers: vectors, fouls, minute, score,
  │  layer          │  possession, xG, xT, TTD, lineups, settings,
  └────────┬────────┘  КомТрен coefficients, commentary feed
           ▼
  ┌─────────────────┐
  │  Derived state  │  favorite/underdog, dominance, match phase,
  │                 │  opponent playing pattern (flank vs centre,
  └────────┬────────┘  cross frequency, formation shape)
           ▼
  ┌─────────────────┐
  │  Rule engine    │  ~70 rules: condition → recommendation
  │                 │  + manual citation + priority
  └────────┬────────┘
           ▼
  ┌─────────────────┐
  │  Coherence      │  strips combinations the manual forbids
  │  check          │  (runs AFTER recommendations)
  └────────┬────────┘
           ▼
     Overlay panel (diagnosis / recommendation / history)
```

### Data sources on the page

All confirmed present and readable:

| Source | Provides |
|---|---|
| Match header | minute, half, score |
| Per-team stats block | possession %, shots, shots on target, xG, xT, accurate/inaccurate passes, ТТД count and error %, **вектор обороны**, **вектор прессинга**, fouls, corners, offsides, individual actions, `Сила состава на поле` |
| Lineup block | each player's position slot (LD, CD1, DM2, LW, AM2, ST2…) and live rating — reveals which zone is conceding |
| `Настройки на матч` panel | own current settings as ordinals (`высота линии обороны 3/3`, `интенсивность прессинга 3/5`, `стиль игры обычн`, …), `Бонус на морали`, and КомТрен coefficients |
| `изменения по ходу матча` table | the game's own log of in-match changes with minute — reused directly as the panel's history |
| `Управление` tab (when open) | `приоритет направления атак` (the three ЛЕВЫЙ / ПО ЦЕНТРУ / ПРАВЫЙ toggles), which the summary panel omits |
| Commentary feed | repeated patterns: which duel is being lost, which flank the danger comes from, crosses vs combinations |
| Shot table | distance, pressure, angle per shot |

**Opponent settings are not visible** — only their live statistics. All inferences about the
opponent's approach are derived from their vectors, formation, and commentary patterns, exactly
as the manual instructs ("а их мы не видим").

### Own-team detection

Detected from the head-coach name shown on the page, matched against the logged-in user.
Fallback: a one-click "this is my team" button, persisted.

## Rule Catalogue

Extracted from the two manual articles: **блок оборона** (4 settings) and
**блок построение атаки** (6 settings). Representative rules — full set in the implementation plan.

### Feedback loops (the core value)

These compare stated intent against measured effect. They are the rules a manager cannot run
in their head mid-match.

| Condition | Recommendation |
|---|---|
| `высокий прессинг` set, own вектор прессинга < +20% | Press is not working — you take the downsides (space, fouls) without the upside. Drop to `средний`. |
| `высокая оборона` set, own вектор обороны ≤ 0 | Opponent is pinning you back despite the brave line. Lower it. |
| `средняя`/`низкая оборона` set, own вектор обороны positive | You dominate even on passive settings. Consider raising to exploit. |
| Fouls exceeding 1 per 15 min (norm ≈ 5/match) | Lower `интенсивность прессинга`. |
| Fouls still high at интенсивность 2–3 | Manual: the cause is elsewhere (formation, ПИ roles, defensive/pressing height, opponent strength). Do **not** keep lowering. |
| Almost no fouls while defending well | Raise intensity — more interception attempts, better attacking numbers. |
| Same intensity held for a long stretch | Manual recommends `аритмия` — vary it rather than holding one value for 90 minutes. |

### Opponent-vector rules

| Opponent signal | Setting affected |
|---|---|
| вектор прессинга > +10% | Centre is covered — attack flanks |
| вектор прессинга < −20% | Centre is open — add central attacks |
| вектор обороны > +20% | High line — flank vulnerability |
| вектор обороны < −20% | Low block — centre vulnerable, but establish control first |
| прессинг +20% **and** оборона −20% | `темп высокий` |
| прессинг −20% **and** оборона +20% | `темп низкий` |
| vectors agree / signals conflict | `темп средний` |
| вектор прессинга ≥ +20% | `выход из обороны: смешанный` (throw over the press, play second balls) |
| вектор прессинга ≤ −20% | `выход из обороны: позиционный` |
| прессинг low **and** оборона mid/high | Best conditions for diagonals and one-touch passing |
| вектор прессинга ≤ −10% | One-touch passes to `умеренно` |
| crosses > 5 per match (excl. set pieces) | `широкая оборона` to counter flank play |

### Numeric constants from the manual

- `интенсивность прессинга` duel thresholds: мин 50%, низкая 45%, средняя 40%, высокая 35%, макс 30% — one step = 5%, foul count can move ~1.5×
- Foul norm ≈ 5 per match in generator 5.6
- On a red card the game auto-lowers intensity by one step
- `стиль игры` pressure modifier: защита+ +4%, защита +2%, обычный 0, атака −2%, атака+ −4% per episode; opponent's style cancels yours
- Diagonal and one-touch pass accuracy ≥ 70% is considered good
- One step of one-touch passing ≈ +0.1 xG
- High line / high press each cost ~15–20% more physical drain than the neighbouring step
- Effective high press needs ≥ 6 midfield+attack players; rule of thumb: *pressing players = opponent's build-up players − 1*
- `позиционный выход` requires 3–5 midfield-line players; `выносы` requires ≥ 3 forward targets for second balls

### Coherence check

Runs after recommendations and strips combinations the manual forbids or warns against:

- `низкая оборона` + `высокий прессинг` — huge gap between lines
- `высокая оборона` + `низкий прессинг` — high line left exposed
- `низкая оборона` + `широкая ширина`, `высокая оборона` + `узкая ширина` — contradictory bravery
- Defensive height and pressing height must be within one step of each other
- Everything shifted right (high tempo + high острота + frequent diagonals + centre) — excessive risk
- Everything shifted left — sterile possession with no threat
- Frequent diagonals + high `острота передач` — compounding waste
- Central attacks + frequent crosses to a target man — mutually opposed

### Conflict resolution and priority

The manual states its own tie-breakers, which the engine implements rather than inventing:

1. **Contradictory signals → recommend the middle option.** The manual repeats this for every
   setting. The engine is allowed to output "signals conflict, stay on medium."
2. **Late-match score overrides everything else** — "Прочие критерии могут померкнуть, если
   исход игры вас не устраивает". Score-based rules gain priority progressively with the minute
   rather than switching on abruptly, because the manual also warns against going all-in at
   minute 15.
3. **КомТрен cross-check.** Not in the manual, but directly actionable: if a rule recommends
   raising diagonals while `КомТрен[диагон]` is 0.00, the recommendation is surfaced with the
   contradiction attached rather than silently issued.

### Pre-match baseline

The two cheat sheets (шпаргалки) in the manual give 12-situation lookup tables for each block
(equal match, favourite, underdog, need to score, need to hold, high/low vectors, opponent
through flanks/centre, many fouls, …). These load as the starting plan before kickoff; the
fine-grained rules then apply on top during the match.

## Handling the missing "Атака" block

The third settings block — `острота передач`, `дриблинг`, `навесы в штрафную`,
`подача стандартов`, `дальний удар` — has no manual article, and none is planned. Rules are not
invented. Three tiers, each labelled in the panel:

1. **Real rules, from cross-references in the two published articles.** One-touch passes pair
   with low tempo and острота 1–3; frequent diagonals plus high острота produce heavy waste;
   tempo and острота both increase central progression; bus-breaking is low tempo + low острота +
   frequent diagonals; a high line counters low острота; central attacks oppose frequent crosses.
2. **Coherence-only, no positive recommendation** — `дриблинг` has a single usable sentence
   ("complex techniques work when the opponent has closed up"), too thin to recommend a level.
3. **Untouched, and said so** — `подача стандартов` and `дальний удар`, so their absence reads as
   deliberate rather than as a bug.

Rules are data, not code, so a third article (or the manager's own experience rules, labelled as
such) can be added without restructuring.

## Panel

Fixed overlay, draggable, collapsible. Three zones:

1. **Diagnosis** — what is happening now, in plain language
2. **Recommendation** — which setting to change, with the manual rule quoted
3. **History** — read from the game's own `изменения по ходу матча` table

Colour is used only when something needs attention, so the panel is ignorable for most of the match.

## Non-goals

- Does not change settings automatically
- Does not run on a server or make requests of its own
- Does not require an API key or incur cost
- Does not attempt to read opponent settings (not exposed)

## Open Items

- Whether xT is present for all match types or only some (manager reports it is on the page)
- Third manual article, if it is ever published
