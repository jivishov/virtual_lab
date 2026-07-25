# Intended use

Last reviewed: 2026-07-25

## What this is

An open, browser-based **pharmacokinetic model explorer**. It integrates a
compartmental model across a user-defined therapy timeline and displays the
resulting concentration-time profile, the decomposition of total clearance
into its components, and exposure metrics computed from that profile.

## What it is for

- Teaching and learning how extracorporeal clearance interacts with a drug's
  own disposition.
- Exploring how a candidate regimen behaves under CRRT interruptions, flow
  changes and modality transitions — questions a static dosing table cannot
  express, because a table has no time axis.
- Comparing user-defined scenarios against each other under a shared,
  explicitly stated set of assumptions.
- Auditing the arithmetic. Every equation is in the repository, every
  parameter is entered or overridable by the user, and every number on screen
  can be traced to an input.

## What it is not for

This software must not be used to:

- select a dose for a patient;
- replace therapeutic drug monitoring;
- replace local antimicrobial or renal-replacement guidance;
- replace the approved product information;
- estimate an individual patient's exposure and act on that estimate.

It issues **no dosing recommendation of any kind**. It does not compute a
"recommended dose", does not rank scenarios, and does not declare a regimen
adequate or inadequate. Where two scenarios differ, it describes the
difference and stops there.

## Why the output is framed the way it is

A model output becomes a treatment directive at the moment it tells a
clinician what to do. Software that issues specific directives is judged by a
different standard from software that displays a calculation the user can
independently check — and rightly so, because the user of a directive cannot
verify it without redoing the work.

Everything here is designed so a pharmacist can independently review the
basis of what is shown: the structural model, the parameters, the flows, the
assumptions, and the arithmetic are all visible. A disclaimer does not make
software safe. Not emitting the directive does.

## Who it is for

Intensive care and infectious-diseases pharmacists, clinical pharmacologists,
pharmacy residents and fellows, and educators. It assumes the user already
understands what a sieving coefficient is and can judge whether a parameter
set is appropriate. It is not a tool for patients.

## Standing limitations

The application:

- has no validated population model bundled with it (see
  `model-selection.md` — this is a known, documented gate failure);
- does not model membrane adsorption, filter performance decay over circuit
  life, concentration- or time-dependent protein binding, regional citrate
  effects, or sequestration by any concurrent extracorporeal circuit;
- treats the sieving and saturation coefficients as constant;
- represents between-patient variability only as a user-driven sensitivity
  envelope, never as a probability statement (see `claim-language.md`);
- has been verified for numerical correctness but has **not** been externally
  validated against clinical observations.

## Data handling

All computation happens in the page. Values entered into the simulator are
processed locally and are not transmitted by the application: there are no
network requests after page load, no analytics, no third-party scripts, no
fonts or assets fetched from other origins.

This is a statement about the application, not about the network. Serving any
web page necessarily reveals ordinary request metadata — client IP address and
the path requested — to the host. The application therefore avoids collecting
identifiers in the first place: it has no field for a name, a date of birth, a
record number, or anything else that identifies a person, and it asks only for
the physiological parameters the model actually consumes.
