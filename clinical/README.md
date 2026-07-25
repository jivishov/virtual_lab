# Clinical pharmacology model explorers

Open, browser-based pharmacokinetic model explorers. No build step, no
dependencies, no network access at runtime.

This directory is deliberately self-contained: it shares no code with the rest
of the repository and can be lifted into its own project unchanged.

## What is here

| Path | Purpose |
|---|---|
| `index.html` | Suite landing page |
| `apps/renal-shift/` | **RenalShift** — antimicrobial exposure across CRRT state changes |
| `packages/` | Shared engine: units, linear algebra, compartmental solver, CRRT clearance, simulation, metrics, charting |
| `validation/` | Independently written reference integrator used to cross-check the production solver |
| `data/` | Illustrative parameter presets, each carrying a provenance record and a quality flag |
| `governance/` | Intended use, landscape review, model selection, validation plan, claim language, risk register |
| `tests/` | Verification suite |

## Running it

Any static file server. There is nothing to build.

```sh
python3 -m http.server 8000
# then open http://localhost:8000/clinical/
```

Modules are loaded with `<script type="module">`, so opening the files
directly with `file://` will not work — the browser blocks module loading from
that scheme.

## Verification

```sh
cd clinical && node tests/tests.js
```

110 assertions covering unit conversion, mass balance, degenerate inputs
(zero clearance, near-repeated eigenvalues, zero duration), linearity,
event-boundary handling, CRRT clearance component algebra for every modality,
closed-form checks on every exposure metric, and counterfactual event
attribution.

The production solver advances the system by matrix exponential, which is
exact within each segment. It is cross-checked against an independently
written adaptive Dormand-Prince 5(4) integrator in `validation/` that shares
no code with it. Worst observed relative disagreement across one-, two- and
three-compartment cases: **3.7e-12** against a predeclared tolerance of 1e-7.

The suite has been mutation-tested. Removing the pre-dilution correction
produces 2 failures; transposing two rate constants in the compartment matrix
produces 6.

## What this does and does not establish

| Claim | Status |
|---|---|
| The code solves the stated equations correctly | **Verified** |
| Numerical behaviour at boundaries and degenerate inputs | **Verified** |
| Bundled parameters represent a real patient population | **Not established** — none are bundled |
| Predictions match independent clinical observations | **Not established** |
| Using these tools improves clinical decisions or outcomes | **Not established, not claimed** |

"Verified" is not "validated". See `governance/validation-plan.md`.

## Design decisions worth knowing

**No population model is bundled.** A suitable prospective cefepime CRRT model
was identified but its full text was not retrievable in the environment where
this was built. Rather than reconstruct the missing parameters from typical
literature values and present the result as that model, parameters were made
first-class user inputs. The reasoning is in `governance/model-selection.md`.
This turned out to be the better design regardless: the differentiated value
is the event engine and the clearance decomposition, neither of which depends
on any one drug's parameters.

**No dosing recommendation is produced, by construction.** There is no dose
output field. Scenarios are not ranked. The banned-phrasing list lives in
`governance/claim-language.md`.

**Event effects are attributed counterfactually.** Comparing equal windows
before and after an event confounds the CRRT change with dose timing — during
development that artefact made *starting* CRRT appear to *increase* target
coverage. Each event is instead compared against a simulation in which that
one event did not occur.

**Timelines are cut at every discontinuity.** No integration step crosses an
event boundary, because the moment the circuit stops is exactly where a naive
simulator is wrong and where this tool claims to be useful.

## Licence

Same as the parent repository.
