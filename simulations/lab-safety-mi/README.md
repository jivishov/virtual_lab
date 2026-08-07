# Mission: Impossible - Laboratory Protocol

A Mission: Impossible themed lab safety trainer: ten timed scenarios, a scripted
protocol-violation sequence, earned ranks and a printable certificate.

## Features

- **English and Spanish** — the whole simulation, chosen from a selector on the
  codename screen and remembered per browser
- **10 Mission Scenarios** covering critical lab safety protocols
- **Protocol violation sequence** — water poured into concentrated acid, played on
  a single synchronised timeline with a skip control and a wrong-vs-right comparison
- **Fit-to-viewport layout** — the scenario screen fits one screen on tablets,
  15" laptops and desktops without scrolling
- **Drawn scene illustrations** — each scenario is an annotated apparatus
  diagram in SVG, not an emoji collage
- **Centred feedback dialog** stating the chosen answer against the correct
  protocol, so the explanation is never below the fold
- **Difficulty tiers** that change the clock and intel support, not the score
- **Rank earned from accuracy**, with a certificate of completion that
  downloads as a real PDF
- **Protocol review** of every scenario, including why the chosen answer failed
- **Badge system** for speed, accuracy, streaks and unaided passes
- **Keyboard operable** — `1`–`4` to answer, `Enter`/`Esc` to advance
- **Reduced-motion support** throughout

## Language

A segmented **EN / Español** selector sits on the codename screen, above the
codename field — before any copy the student has to read to answer correctly.
Everything downstream follows it: briefing, scenarios, option cards, the labels
drawn inside the scene illustrations, feedback, debriefing, protocol review, the
certificate and the generated PDF, including the date format.

The language is picked in this order, first match wins:

1. `?lang=en` or `?lang=es` in the URL — how a teacher pins a class to one language
2. the student's own last choice, from `localStorage`
3. the browser's `Accept-Language` (anything `es-*` opens in Spanish)
4. English

Only an explicit click is persisted, so a shared lab machine does not trap the
next student in a language their browser never asked for.

### About the Spanish

The Spanish is **neutral Latin American Spanish (es-419)**, aimed at Spanish-
speaking students in United States schools — largely of Mexican and Central
American origin. It uses `tú`/`ustedes`, never `vosotros`, and pan-regional
safety vocabulary (`bata`, `gafas de seguridad`, `ducha de seguridad`,
`gabinete de inflamables`). Ranks and job titles avoid assuming a student's
gender: `DIRECCIÓN DE SEGURIDAD DE LABORATORIO`, not `DIRECTOR`.

### Adding or editing copy

All UI strings for both languages live in **`js/i18n.js`** in one flat key space.
Static markup is translated by attribute — `data-i18n`, `data-i18n-html`,
`data-i18n-placeholder`, `data-i18n-title`, `data-i18n-aria-label` — and the
English text left in the HTML is the no-JS fallback.

English scenario copy stays in `js/questions.js`, which remains the canonical
description of the mission: ids, option order, `correct` flags and artwork keys.
`I18N_SCENARIOS.es` overlays **words only**, matched to options **by position**.
That coupling is checked on every load by `i18nAuditScenarios()`, which warns in
the console if a translated option list drifts out of step with the English one —
the one way this design could show a student the wrong explanation for their
answer. Translation happens before the per-attempt shuffle and carries the
`correct` flag with it, so no translation can move the correct answer.

Adding a third language means adding a dictionary and a scenario pack to
`I18N_SUPPORTED`; the selector and its sliding highlight are generated from that
list and need no CSS change.

## Topics Covered

1. **PPE Checkpoint** — protective equipment as a complete set
2. **Hazard Identification** — reading the pictogram
3. **Clothing Fire** — safety shower first, never an extinguisher at a person
4. **Contamination Alert** — spill escalation
5. **Dilution Protocol** — acid into water (CRITICAL)
6. **Lab Responsibility** — clearing your own station
7. **Flammable Storage** — approved vented cabinets
8. **Access Control** — supervision, not an unlocked door
9. **Conduct Protocol** — movement, aisles and PPE discipline
10. **Biological Samples** — observe with instruments only

Every item asks for the **safe** action. None asks the student to select a hazard,
so a green "PROTOCOL EXECUTED" always marks correct safety behaviour.

## Difficulty and rank

Difficulty and rank are separate. Clearance level sets the response window and
whether intel support is available; **every agent starts on zero points**.

| Clearance | Time per scenario | Intel requests |
|---|---|---|
| Recruit | 25s | 2 |
| Field Agent | 20s | 1 |
| Special Ops | 16s | none |
| IMF Director | 12s | none |

Rank comes from **percentage correct**, so it measures learning rather than the
menu choice:

| Accuracy | Rank |
|---|---|
| 100% | Director of Laboratory Safety |
| 90–99% | Special Agent — Hazmat Division |
| 70–89% | Field Agent — Lab Protocol |
| 50–69% | Probationary Operative |
| below 50% | Recruit — Retraining Required |

The pass mark is a single constant (`PASS_THRESHOLD`, 70%) shared by the mission
verdict and the certificate.

## Scoring

- **Base**: 10 per correct answer
- **Streak bonus**: +5 at 3 or more consecutive correct
- **Speed bonus**: +5 for a correct answer between 3s and 9s — the lower bound is
  deliberate, so the bonus rewards fluency rather than fast guessing
- **Penalties**: −5 for a wrong answer or a timeout, −3 per intel request

Points drive engagement; the certificate and rank are derived from accuracy.

Answer options are shuffled on every attempt, so card position carries no signal.

## Certificate

`VIEW CERTIFICATE` on the debriefing screen issues a printable certificate showing
the codename, success rate, protocols passed, rank, commendations, date and an
issuing-authority block:

> Certified by **{instructor}**
> *Chief Lab Safety Officer — IMF Science Division*

Below 70% the same screen issues a **retraining notice** with the same statistics
instead of a certificate.

### Setting up for your class

Open **`teacher.html`**, enter your name once, and share the link it gives you:

```
https://virtuallab.az/simulations/lab-safety-mi/?instructor=Ms.%20Rivera
```

The setup page also lets you pin the language your students open in, which adds
`&lang=es` (or `&lang=en`) to that link. It defaults to **letting students
choose**, so the link you hand out does not override a student whose browser
asks for Spanish unless you decide it should.

Every student who opens that link gets your name on their certificate, and the
field is **read-only** for them — the point of the mechanism is that the student,
who has no reason to know how you spell your name, is not the one typing it. The
setup page previews the signature line through the real PDF text pipeline, so it
warns before you share the link if the name will overrun the signature rule or
contains characters the PDF cannot print.

That last one is worth knowing: the certificate encodes text as Latin-1, so
accents such as *Muñoz* and *García* are fine, but *Nguyễn* would print as
*Nguyn*. The setup page shows you exactly what will be printed.

No server is involved — the name travels in the link itself, so it works on any
device with no sign-in. Opened without the parameter, the field falls back to
whatever was last used in that browser and stays editable.

**`⭳ DOWNLOAD PDF`** writes a real A4-landscape PDF (`js/pdf.js`), drawn as
vectors and text in the standard PDF fonts — not a screenshot — so it stays
crisp at any size and the text is selectable. There is no external library and
no network call; text is centred using canvas metrics from metrically
compatible families rather than an embedded font-width table. **`PRINT`** is
kept as a fallback and prints the certificate alone: the print stylesheet
removes every other screen, the scanline overlay and all glow.

The certificate deliberately drops the dark spy theme — it is the one artefact
a student keeps and shows someone, so it reads as printed stationery: warm
paper, navy ink, gold rules and a rosette seal.

## Audio

`assets/audio/mi-theme.mp3` is the only audio file. Every sound effect (beep,
ejection, success, failure, alarm) is synthesised with the Web Audio API, so there
are no missing-file requests. Both music and effects can be toggled from the HUD.

## Accessibility

- Answer cards are real `<button>` elements: tab-reachable, with visible focus
  rings and `1`–`4` shortcuts
- The feedback dialog uses `role="dialog"`, traps focus, and returns focus to the
  answered card
- `prefers-reduced-motion` disables the scanlines, glitch, shake and float
  animations; the violation sequence collapses to a static labelled diagram
- The question timer pauses when the tab is hidden

## Responsive behaviour

| Viewport | Layout |
|---|---|
| ≥1200px | Two columns — scene and situation left, timer and 2×2 options right |
| 1024–1199px | Single column, options 2×2 |
| 768–1023px | Single column, options 2×2, HUD wraps |
| <768px | Options stacked, 44px touch targets, scenario may scroll |

## How to Use

1. Serve the folder (e.g. `python -m http.server 8000`) and open `index.html`
2. Pick a language if the default is not the one you want, then enter a codename
3. Read the briefing (skippable) and watch the violation sequence
4. Choose a clearance level
5. Complete 10 scenarios
6. Review the protocols you missed, then print your certificate

## Graphics

Scene art and option icons live in `js/graphics.js`. Scenes are drawn on a
shared `320x176` grid as annotated apparatus diagrams — glassware, cabinets,
a microscope, a plan view of a bench aisle — with leader lines, dimension
lines and labels. Option icons are a `24x24` line set.

Each scene is a **function**, not a baked string, so its labels are resolved
through `T()` at render time and follow the language. Keep label text short:
the canvas is only 320 wide and a `label()` has no box to grow into. A `plate()`
sizes itself to its text and is nudged back inside the viewBox if a longer
translation would otherwise overhang the edge and be clipped.

Styling is inherited from the `<svg>` element (stroke, width, caps) so each
CSS class overrides only what it needs. Do **not** add a blanket
`[class^="art-"]` rule: an earlier version did, and it silently overrode every
gradient fill. All scene animation is disabled under `prefers-reduced-motion`.

## Technologies Used

- **HTML5**, **CSS3** — fluid `clamp()` scale, `dvh` units, container queries
  on the certificate, grid/flex layout
- **Vanilla JavaScript** — game engine, state, SVG art and the PDF writer
- **Web Audio API** — synthesised sound effects
- **CSS keyframe animations** — glassware, spatter and fume effects

## Browser Compatibility

Chrome/Edge, Firefox and Safari (current versions), plus tablet and mobile browsers.

---

**Remember**: In a real lab, safety is not a game. Always follow your instructor's protocols!
