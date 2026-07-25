# Risk register

Last reviewed: 2026-07-25

Ordered by severity of consequence. "Mitigated" means a specific,
inspectable control exists — not that the risk is gone.

## R1 — A user treats model output as a dosing recommendation

**Consequence:** patient harm from a dose chosen on an unvalidated model.
**Severity:** highest.

Controls:
- No dose is ever computed or displayed. There is no dose output field.
- No scenario is ranked, scored or declared preferable.
- The banned-phrasing list in `claim-language.md` is applied to all UI text.
- Comparison output describes differences and explicitly states that the
  application does not determine which regimen is appropriate.
- Validation status is on the landing page and the model card, not only in a
  footer disclaimer.

Residual risk: real. A determined user can read a curve as advice. Level 5
interpretability testing exists specifically to measure this, and is not yet
done.

## R2 — Illustrative preset parameters are mistaken for a validated model

**Consequence:** confident wrong conclusions from plausible-looking defaults.
**Severity:** high.

Controls:
- Presets carry an explicit `illustrative` quality flag, shown in the UI next
  to the values, not buried in a data file.
- Every parameter displays its provenance, including "no source — user
  supplied" when that is the case.
- `model-selection.md` records the Gate B failure in full.
- The model card states that no qualified population model is bundled.

## R3 — Extrapolation beyond the parameter set's applicability

**Consequence:** output generated for a patient type the parameters never
described.
**Severity:** high.

Controls:
- Physical plausibility guards on flows: extracorporeal clearance is capped at
  plasma water flow, and the cap emits a warning.
- Filtration fraction above 25% warns that the constant-sieving assumption
  degrades.
- High dialysate flow relative to plasma water flow warns that complete
  saturation is unlikely.
- Applicability text accompanies any parameter set that declares one.

## R4 — Silent numerical error at event boundaries

**Consequence:** the tool is wrong precisely where it claims to be useful —
at the moment the circuit stops.
**Severity:** high, and easy to miss.

Controls:
- The timeline is cut at every discontinuity, so no integration step
  straddles an event.
- Within a segment the solution is a matrix exponential, exact to machine
  precision, rather than a stepped approximation.
- Tests assert the output grid contains every event time and that clearance
  changes exactly there.
- Independent-solver cross-check at 3.7e-12.

## R5 — Unmodelled mechanisms silently omitted

**Consequence:** systematically wrong clearance for affected agents —
adsorption in particular can dominate for some drug-membrane combinations.
**Severity:** moderate to high, agent-dependent.

Controls:
- `UNMODELLED_EFFECTS` is exported from the CRRT module and rendered in the
  interface, not left as a source comment.
- The pre-dilution simplification is stated in the code and warns at run time
  when pre- and post-dilution are combined.

Residual risk: a user who does not read the list. Unavoidable short of
refusing to simulate affected agents.

## R6 — Sensitivity envelope read as a probability statement

**Consequence:** "90% of patients fall in this band" claimed from what is
only a low/high parameter sweep.
**Severity:** moderate.

Controls:
- Terminology table in `claim-language.md`, with "prediction interval"
  reserved and currently unused.
- No population layer is implemented at all, so there is nothing to misread
  as one.
- Envelope output is labelled by the parameters varied and their ranges.

## R7 — Entered clinical values leaving the browser

**Consequence:** inadvertent disclosure.
**Severity:** moderate; low likelihood given the design.

Controls:
- No network requests after page load. No analytics, no third-party scripts,
  no external fonts or assets.
- An automated check scans the app sources for external references.
- No identifying field exists to be disclosed: no name, date of birth or
  record number is collected.
- The privacy claim is worded as a statement about the application, not about
  the network — see `intended-use.md`.

## R8 — Landscape claims going stale

**Consequence:** a novelty claim that has quietly become false.
**Severity:** low for patients, high for credibility.

Controls:
- `landscape.md` is date-stamped with explicit re-review triggers.
- Claims are phrased as "a search on <date> did not identify", never "no tool
  exists".
- The five corrections to the earlier draft are recorded in that document so
  the same overstatements are not repeated.
