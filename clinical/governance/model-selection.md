# Model selection and the Gate B outcome

Last reviewed: 2026-07-25

## The gate

A population model may be bundled and presented as a patient-representative
model only if enough is available to reproduce it:

1. structural equations;
2. fixed-effect parameter estimates;
3. covariate equations;
4. the variability model **including** the covariance matrix or the
   nonparametric support points and their weights;
5. the residual error model, where relevant;
6. the applicability population;
7. the treatment and sampling conditions;
8. at least one published output that can be reproduced as a check.

A table of means and standard deviations is **not** sufficient when the
original analysis used a correlated or nonparametric parameter distribution.
Sampling such parameters independently manufactures virtual patients that the
source model never contained.

## Candidate identified

The strongest candidate found was a prospective cefepime population
pharmacokinetic analysis in critically ill adults on CRRT, in which cefepime
was described by a **five-compartment model representing both the patient and
the CRRT circuit**, with CRRT flow rates governing the transfer rates between
compartments. Covariates tested included weight, urine output, CRRT downtime,
and blood, ultrafiltrate, therapy-fluid and total effluent flow rates. The
analysis used nonparametric adaptive grid estimation.

That structure is close to ideal for this application: it treats the circuit
as part of the system rather than as a clearance add-on, and it explicitly
carries downtime as a covariate.

## Outcome: Gate B **not passed** in this environment

The full text could not be retrieved. The publisher host, PubMed Central and
the NCBI E-utilities endpoint are all blocked by this environment's egress
policy (`connect_rejected` at the proxy). Only abstract-level information was
obtainable.

Abstract-level information is not enough. It gives the compartment count and
the covariates tested, but not the parameter estimates, not the transfer-rate
equations, and not the nonparametric support points. Reconstructing the
remainder from typical literature values and presenting the result as that
published model would be a fabrication, and would be exactly the failure mode
this gate exists to prevent.

Known limitations of the candidate, even if it were obtainable: the cohort was
small, and specific machines and filters were used, so the authors' own
generalisability caveats would need to be carried into any model card.

## Consequence: intended use narrowed, not evidence fabricated

Per the governance framework, a gate failure either stops the build or
narrows its intended use. The intended use was narrowed.

**No population model is bundled.** Instead:

- Drug and system parameters are **first-class user inputs**. The user
  supplies clearance, volumes, unbound fraction, and sieving and saturation
  coefficients from a source they have chosen and can cite.
- The application records the provenance the user enters alongside the
  numbers, and displays it with the results.
- Shipped presets are labelled **illustrative** and carry a quality flag.
  They exist so the interface can be exercised, not so anyone can rely on
  them. They are not represented as a qualified population model.
- No population variability layer is implemented, because no justified joint
  distribution is available. Between-patient uncertainty is offered only as a
  user-driven **sensitivity envelope**, with the naming rules in
  `claim-language.md`.

This turns out to be the more useful design regardless of access. The
differentiated value of the application is the CRRT event engine, the
clearance decomposition and scenario comparison — none of which depends on any
one drug's parameters. Making parameters user-supplied means the tool works
for any drug for which the user has a defensible parameter set, rather than
only for the drug whose paper happened to be reachable.

## What would change this

If the full text of a suitable model becomes available, it can be added as a
model definition without touching the engine, provided every Gate B item is
satisfied. Required: the complete parameter set, the variability
representation as published, the applicability population, and at least one
reproducible published output to check against. Until then, no bundled model
may be described as validated.

## Prohibited shortcuts

Recorded explicitly because each is tempting:

- Do not fill a missing model component with a generic literature average and
  present the result as the source model.
- Do not sample nonparametric support points as if they were independent
  normal distributions.
- Do not substitute a different renal-function metric for the one the source
  model was built on. A creatinine clearance estimate, a measured urinary
  clearance and a kinetic eGFR are not interchangeable merely because they
  share units.
- Do not combine parameters from two models into one composite model.
