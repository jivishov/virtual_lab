# Claim language

Last reviewed: 2026-07-25

Wording rules for the interface, documentation and any write-up. The point is
to prevent the output from sounding more certain, more personal or more
directive than the evidence supports.

## Uncertainty vocabulary

Four different things get conflated under the word "uncertainty". They are
named separately and must not be mixed.

| Term | Means | May be used when |
|---|---|---|
| **Sensitivity envelope** | Deterministic low / base / high runs over user-chosen parameter values | Always. This is the default and the only one currently implemented. |
| **Simulated population interval** | Spread across virtual subjects drawn from a justified population distribution | Only with a published joint distribution, covariance preserved |
| **Prediction interval** | A calibrated probability statement about a future observation | Only after independent external evaluation supporting that interpretation |
| **Confidence interval** | Frequentist interval on an estimated parameter | Only when reproducing an interval a source actually reported |

Sampling a published minimum and maximum for a parameter produces a
**sensitivity envelope**, never a prediction interval. Published ranges mix
assay differences, laboratory differences, substrate differences,
unbound-versus-total measurement differences, genuine between-patient
variability and plain experimental error. That mixture has no probability
interpretation.

Independent sampling of correlated parameters is also prohibited: clearance,
volume, unbound fraction and sieving coefficient are not independent, and
sampling them separately generates physiologically impossible subjects.

## Banned output phrasings

Never emitted by the application:

- "Recommended dose ..."
- "Reduce the dose by N%"
- "Give N mg every N hours"
- "Safe" / "unsafe", "adequate" / "inadequate", "therapeutic" / "subtherapeutic"
- "This patient will ..."
- "Optimal regimen"
- Any ranking that names a winning scenario

## Required phrasings

- "Model-predicted", never "predicted" bare.
- "Under the stated assumptions", attached to every quantitative result.
- "Simulated subject", never "patient".
- Scenario comparison describes the difference and stops:

  > Scenario B produced a higher simulated trough and a longer period above
  > the selected target during the interruption. The application does not
  > determine which regimen is appropriate.

## Validation vocabulary

Four distinct claims, in increasing strength. Only the first two are currently
supported.

1. **Software verification** — the code correctly solves the stated
   equations. *Supported*: 110 automated checks, including agreement with an
   independent Dormand-Prince integrator to ~4e-12 relative, and closed-form
   checks on every metric.
2. **Numerical verification** — mass balance, event handling, degenerate
   inputs. *Supported*, same suite.
3. **External model validation** — performance against independent clinical
   observations. *Not supported.* No bundled model, no external dataset.
4. **Clinical impact validation** — using the software improves decisions or
   outcomes. *Not supported, and not claimed.* Nothing here is evidence for
   this and no amount of work in this repository would produce it.

The landing page must keep these visibly separate. "Verified" must never be
allowed to read as "validated".

## Novelty claims

Say "a search on <date> did not identify an equivalent tool", never "no such
tool exists". Every novelty claim carries its search date and is subject to
the re-review triggers in `landscape.md`.
