# Titration Flight Simulator — HCl vs NaOH

A 3D procedural trainer for the classic acid–base titration: determine the
molarity of an unknown hydrochloric acid solution against standardised
0.1000 M sodium hydroxide.

It is built the way a flight simulator is built. There is a full bench, a
checklist you work through in order, instruments that tell you only what a real
instrument would tell you, and a debrief at the end that scores accuracy,
precision, technique and safety, and explains what moved your number.

Static site, no build step, no external requests. Drop it on GitHub Pages and
it runs.

```
titration-flight-sim/
├── index.html          HUD markup and the import map
├── css/style.css
├── js/
│   ├── main.js         wiring: picking, camera stations, render loop
│   ├── scene.js        renderer, lighting, orbit rig, camera flights
│   ├── lab.js          the bench: casework, sink, stand, glassware, reagents
│   ├── vessel.js       procedural glassware + exact volume↔height tables
│   ├── apparatus.js    burette, graduations, stopcock, drops, pink plume
│   ├── chem.js         the chemistry — pH, indicator equilibrium, statistics
│   ├── sim.js          procedure state machine, flow physics, error sources
│   ├── ui.js           checklist, instruments, dialogs, charts, debrief
│   └── audio.js        synthesised bench sounds (no audio files)
└── vendor/three/       three.js r170, vendored (MIT)
```

## Deploying on GitHub Pages

Serve the repository root and open `/titration-flight-sim/`. Nothing else is
required — no bundler, no npm install, no CDN. `three.js` is vendored in
`vendor/three/` and resolved through an import map, so the page makes no
outbound requests at all and keeps working offline and behind strict CSPs.

Locally, any static server will do:

```sh
npx http-server -p 8123 -c-1 .
# then open http://127.0.0.1:8123/titration-flight-sim/
```

ES modules need a real HTTP origin, so opening `index.html` from `file://`
will not work.

## Controls

| Input | Action |
| --- | --- |
| `Space` (hold) | stopcock wide open, ~2.4 mL/s |
| `S` (hold) | trickle — breaks into discrete drops |
| `D` / `F` | release one drop / half a drop |
| `↑` / `↓` | latch the stopcock at a fixed opening |
| `W` (hold) | swirl the flask |
| `E` | rinse the flask walls with deionised water |
| `R` or `Enter` | read the meniscus |
| `P` | pH electrode in / out |
| `1`–`5` | camera stations: bench, tip, meniscus, flask, wide |
| `Tab` | lab notebook |
| `H` | help · `M` mute |
| mouse | left-drag orbit, wheel zoom, right-drag pan |
| stopcock | drag the white handle down to open it |

Every keyboard action also has a button in the dock at the bottom, so the whole
procedure is playable on a touchscreen.

## What is actually simulated

Nothing in the run is scripted. There is no rule that says "turn pink at
25 mL". The colour comes from the indicator equilibrium, which comes from the
pH, which is solved from a charge balance on the contents of the flask.

**pH.** Exact solution of the strong-acid/strong-base equilibrium including
water autoionisation, from `[H+]² − C[H+] − K_w = 0` where
`C = (n_H − n_OH)/V`. That is what keeps the curve finite through equivalence
instead of dividing by zero.

**The indicator is a reagent, not a paint job.** Phenolphthalein is modelled
as a weak acid with pKa 9.4. The coloured In⁻ fraction sets the pink intensity
(Beer–Lambert in its linear regime, scaled by how much indicator you added).
Because ionising it consumes hydroxide, pH and the coloured fraction are
coupled and solved by fixed-point iteration — so dosing eight drops of
indicator instead of two visibly costs you titrant, and the pH at
stoichiometric equivalence sits slightly *below* 7.

**Glassware fills the way its shape says it should.** Each vessel is defined by
an inner-wall profile; the volume↔height relationship is integrated from that
profile as a cumulative frustum table. A 250 mL conical flask therefore fills
fast near the top and slowly at the wide base, and 57 mL genuinely reaches only
about 10 mm up the wall. Liquid surfaces are full-height solids clipped by a
world-space horizontal plane, so the surface stays level while the flask is
swirled.

**Burette geometry is real.** Inner radius 5.5 mm over 520 mm of scale gives
exactly 50 mL. The reading maps linearly to a height, graduations are marked
every 0.1 mL, one drop is 0.048 mL, and the valve has a quadratic
characteristic so fine control lives near the bottom of the handle travel.

**Errors behave like errors, not like penalties.** Each one is modelled at its
physical cause, and the consequence propagates on its own:

- An unconditioned burette holds a film of water that genuinely dilutes the
  titrant in the barrel (0.35 mL of water in a 51.2 mL charge makes it
  0.09932 M), so every titre comes out high.
- Air trapped below the stopcock is flushed almost immediately by a wide-open
  stopcock but clings to a trickle, working loose later. Whenever it leaves,
  liquid from the barrel takes its place: the reading advances ~0.22 mL while
  none of that volume reaches whatever is under the tip. Before the initial
  reading that *is* purging; during a titration it is a systematic error. Same
  event, same code path — only the timing differs.
- A water-wet pipette delivers 25.00 mL of slightly diluted sample, so you
  titrate less acid than you think.
- Leaving the tip over nothing runs titrant onto the bench.
- Your **recorded** readings are what your answer is built from. Misread a
  meniscus and the error propagates exactly as it would on the bench; the
  debrief compares what you wrote down against what was really there.

The checklist teaches the correct order but does not force it: the conditioning
and purging steps can be skipped deliberately, and the skip is logged so the
debrief can connect the habit to the number. Measured single-trial bias for each
deviation, with the endpoint landed dropwise in every case:

| Run | Bias in the answer | Where it comes from |
| --- | --- | --- |
| Correct technique | +0.29 % | endpoint 0.08 mL past equivalence |
| Skipped conditioning | +1.01 % | +0.68 % diluted titrant, +0.32 % endpoint |
| Air left in the tip | +1.36 % | +0.97 % bubble (0.22 mL), +0.39 % endpoint |
| Water-wet pipette | −0.72 % | −1.00 % dilute aliquot, +0.28 % endpoint |

No error is applied as a score penalty; each is applied at its physical cause
and the consequence is left to propagate through the arithmetic on its own.

**The pink flash is modelled separately from the bulk.** A drop of base landing
in the flask blooms a local plume of colour that shears out when you swirl and
lingers when you do not — which is why the sim can distinguish "there is pink
in the flask" from "the solution has reached the endpoint".

## A detail worth knowing before you titrate

In a strong-acid/strong-base titration the curve at equivalence is so steep
that **one drop spans phenolphthalein's entire range**. With a 25 mL aliquot
and 0.1 M titrant:

| Past equivalence | pH | Appearance |
| --- | --- | --- |
| 0.000 mL | 6.8 | colourless |
| 0.004 mL (1/12 drop) | 8.9 | faint pink |
| 0.024 mL (half drop) | 9.4 | pink |
| 0.050 mL (one drop) | 9.8 | deep magenta |

So the textbook "faint pink endpoint" is only reachable with fractional drops.
The simulator judges your endpoint on **volume** — did you stop within a drop
of equivalence — rather than on the shade you stopped at, and the half-drop
technique (`F`, then rinse the tip in with `E`) is there because it is the only
way to land inside that window.

## Deliberately not automated

Reading the meniscus, deciding the endpoint, and doing the arithmetic are the
student's job. The instrument panel never volunteers the delivered volume — the
scale on the burette is for that. A digital burette readout is available as a
training aid, and switching it on is recorded in the debrief.

## The procedure

1. PPE — goggles, gloves, coat. Reagent actions are blocked without them, and
   attempting one is logged as a safety violation.
2. Inspect the burette.
3. Condition it twice with the titrant, draining to waste.
4. Charge above 0.00 mL through the funnel.
5. Purge the air from below the stopcock and trim onto the scale.
6. Record the initial reading at eye level, using the reading card behind the
   barrel.
7. Condition the pipette with the unknown, then deliver a 25.00 mL aliquot.
8. Two or three drops of phenolphthalein.
9. Titrate — fast at first, dropwise near the end, swirling throughout, walls
   rinsed down before you call it.
10. Record the final reading. Repeat: one scouting run and two precision runs.
11. Calculate the molarity from your concordant titres and submit it.
12. Debrief.

## Grading

Overall = 35 % accuracy + 20 % precision + 35 % technique + 10 % safety, graded
A–F. Accuracy is your submitted answer against the hidden true value; precision
is the RSD of the two precision titres; technique is eleven checks covering
conditioning, purging, indicator dose, swirling, dropwise finish, wall rinsing,
endpoint volume, reading accuracy and concordance. The debrief also charts the
theoretical curve for the true concentration with your endpoints marked on it,
and explains which of your habits moved your answer and in which direction.

## Browser support

Needs WebGL2 (or WebGL) — any current Chrome, Edge, Firefox or Safari. The HUD
collapses to a mobile layout below 900 px and every action is available as a
button. Panels are individually collapsible.

## Licence

MIT, matching the repository. `three.js` in `vendor/three/` is MIT
(© three.js authors); its licence is included alongside it.
