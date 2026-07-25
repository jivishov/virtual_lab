# Landscape review — exact-use-case novelty

Search date: **2026-07-25**. Searches covered peer-reviewed literature, app
stores, GitHub, institutional calculators and commercial precision-dosing
product documentation.

This review states what searching did and did not find. It does not claim
that no equivalent tool exists anywhere — only that a deliberate search did
not identify one. Re-run this review before making any novelty claim publicly.

## Verdict by candidate

| Candidate | Verdict | Basis |
|---|---|---|
| Vancomycin AUC / Bayesian TDM | **Occupied** | VancoCalc (free, open source), TDMx, NextDose, plus every commercial platform |
| General Bayesian TDM for antimicrobials | **Occupied** | TDMx and NextDose are both free and require no registration |
| Antidepressant hyperbolic tapering | **Occupied** | Two free Maudsley/Horowitz-aligned calculators |
| Quantitative CYP DDI prediction (AUC ratio) | **Occupied** | DDI-Predictor covers the major CYPs, reports interindividual distributions, and combines polymorphism with inhibition/induction |
| DDI combined with genotype (phenoconversion) | **Occupied** | Same tool; this was incorrectly assessed as a gap in an earlier draft |
| Generic antimicrobial PTA vs MIC | **Partly occupied** | Monte Carlo PTA is a standard published method with existing software support; a browser tool would be convenience, not new function |
| CRRT *prescription* dose (effluent mL/kg/h) | **Occupied** | Baxter CRRT Dose Calculator (iOS/Android); QxMD calculator 378 |
| **Drug exposure across CRRT state changes over time** | **Not identified** | See below |
| Kinetic eGFR as a number | **Occupied** | QxMD calculator 367, Medscape, others |
| Kinetic eGFR carried forward into a drug exposure timeline | **Not identified** | Existing calculators stop at the eGFR value |
| Buprenorphine transition time-course simulation | **Not identified** | Conversion calculators and induction-readiness screeners exist; none has a time axis |
| Lactation RID calculation | **Occupied** | Formula is standard and widely implemented |
| Infant accumulation from maternal dosing with maturation | **Not identified**, but see note | Published work is drug-specific PBPK; a drug-general tool would not be defensible |

## The retained gap

What searching did not find is a tool that answers:

> What happens to drug exposure when CRRT stops for four hours, restarts at a
> different effluent rate, changes modality, or runs alongside recovering
> residual renal function?

The distinction matters and was blurred in an earlier draft of this document.
Calculators for CRRT **do** exist — they compute the *dialysis prescription*,
the effluent dose delivered to the patient in mL/kg/h. That is a different
quantity from the drug's extracorporeal clearance, and neither of the tools
found produces a concentration-time profile for a drug.

Institutional CRRT dosing guidance repeatedly instructs clinicians to account
for changing residual renal function, changing filtration rates and circuit
interruptions. A table cannot show the consequences of those events, because
the consequences are dynamic. That is the gap this project addresses.

## Corrections to the previous draft of this review

Recorded so the same errors are not repeated:

1. **"CRRT drug dosing has no calculator at all."** Overstated. CRRT
   prescription calculators exist. The gap is specifically drug exposure
   across state changes.
2. **"Buprenorphine transition: zero tools, free or paid."** Overstated. A
   conversion calculator with an induction-readiness screening mode exists,
   as does a professional-society shared decision tool. The accurate claim is
   that none simulates a time course.
3. **"Simcyp/GastroPlus cost five figures per year."** Unverified; pricing is
   not public. Removed.
4. **"DDI-Predictor is registration-gated" / "TDMx lacks CRRT support."** Both
   were inferred from HTTP 403 responses that were bot filtering, not
   paywalls. Both retracted; neither tool's feature set was verified.
5. **"Nothing free models DDI x pharmacogenomics."** False. DDI-Predictor
   provides exactly this. This error alone invalidated the previous flagship
   choice.

## Re-review triggers

Repeat this review before any public novelty claim, and in any case if more
than twelve months have passed, if a precision-dosing vendor announces CRRT
functionality, or if a reader reports an equivalent tool.
