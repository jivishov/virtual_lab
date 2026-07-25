# Validation plan and current status

Last reviewed: 2026-07-25

Five levels, in increasing strength of claim. Levels 1 and 2 are complete.
Levels 3 to 5 are blocked, and the reasons are recorded rather than skipped.

## Level 1 — dimensional and software verification — **COMPLETE**

Automated, in `tests/tests.js`. Run with `node tests/tests.js`.

Covered:

- unit conversions, including rejection of a fraction entered as a percentage;
- mass balance under zero clearance, with and without infusion;
- zero-dose, zero-duration and zero-flow behaviour;
- singular rate matrix (total clearance zero) — the case that breaks
  eigenvalue-based solvers;
- near-repeated eigenvalues as intercompartmental clearance approaches zero,
  checked against the one-compartment limit;
- linearity and superposition;
- infusion start and stop landing exactly on segment boundaries;
- CRRT clearance component algebra for every modality, including modality
  masking, the pre-dilution correction, and the plasma-water-flow cap;
- rejection of malformed scenarios rather than silent NaN propagation;
- counterfactual event attribution, including window truncation at the next
  event and a direction check that starting CRRT never increases target
  coverage — the error a naive before/after window comparison produces.

## Level 2 — analytical reference cases — **COMPLETE**

- One-compartment decay and constant-infusion profiles against their closed
  forms, agreeing to ~1e-12 relative.
- Steady-state concentration equals `R/CL`.
- Unbound AUC over the full profile equals `fu x Dose / CL`.
- Percentage of time above target for a monoexponential profile against the
  closed-form crossing time `ln(C0/threshold)/k`.
- Cross-check of the matrix-exponential solver against an independent
  adaptive Dormand-Prince 5(4) integrator that shares no code with it, over
  one-, two- and three-compartment cases with and without infusion. **Worst
  observed relative disagreement: 3.7e-12**, against a predeclared tolerance
  of 1e-7.

Tolerances are predeclared in the test file, not chosen after seeing results.

### Suite adequacy

The suite was mutation-tested to confirm it is not vacuous. Removing the
pre-dilution correction produced 2 failures; transposing `k21` for `k12` in
the two-compartment rate matrix produced 6, including the independent-solver
cross-check. Both mutations were reverted.

## Level 3 — source-model reproduction — **BLOCKED**

Requires a bundled published model, which Gate B did not deliver (see
`model-selection.md`). No source outputs can be reproduced because no source
model is implemented.

To unblock: obtain a full-text population model meeting every Gate B item,
implement it as a model definition, and reproduce its published
concentration-time figures, target-attainment values and downtime scenarios
within a predeclared tolerance that accounts for reported rounding.

## Level 4 — locked external evaluation — **BLOCKED**

Depends on Level 3. When reached: use a dataset not used to select or
calibrate any parameter, predeclare the metrics, and publish the results
whether or not they are favourable. Any model change after seeing external
results creates a new version and requires a fresh external set.

## Level 5 — pharmacist interpretability testing — **NOT STARTED**

Not blocked by the above; it tests the interface, not the model. A small
number of ICU or infectious-diseases pharmacists attempt predefined tasks:

1. identify the effect of a four-hour CRRT interruption on target coverage;
2. compare two timelines and state how they differ;
3. find the applicability limits of the parameters in use;
4. state whether a given output is a prediction or a recommendation;
5. locate the source of a parameter on screen.

Task 4 is the safety-critical one. If a participant reads any output as a
recommendation, the interface has failed regardless of what the disclaimer
says, and the wording must change.

This is usability evaluation. It is not clinical-outcome validation and must
never be described as such.

## Status summary for the landing page

| Claim | Status |
|---|---|
| The code solves the stated equations correctly | **Verified** — 110 automated checks, independent solver cross-check |
| The bundled parameters represent a real population | **Not established** — no qualified model is bundled |
| Predictions match independent clinical observations | **Not established** — no external evaluation |
| Using this tool improves clinical decisions or outcomes | **Not established, not claimed** |
