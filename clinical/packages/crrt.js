/**
 * Extracorporeal clearance during continuous renal replacement therapy.
 *
 * WHY THIS IS NOT `effluent x fu`
 * -------------------------------
 * The one-line approximation CL = Qeffluent * fu appears constantly in review
 * articles and dosing tables. It is only a reasonable approximation for a
 * small, minimally-bound solute under post-dilution, fully-saturated
 * conditions. It cannot distinguish:
 *
 *   - diffusive from convective transport (different governing flows),
 *   - pre-dilution from post-dilution (pre-dilution lowers the solute
 *     concentration presented to the membrane),
 *   - dialysate saturation falling as dialysate flow rises toward plasma
 *     water flow,
 *   - membrane adsorption (not modelled here at all - see NOTES).
 *
 * This module keeps the components separate, because the decomposition is the
 * teaching output of the application, not an implementation detail.
 *
 * CONVENTIONS
 *   All flows in L/h. Clearance returned in L/h.
 *   Sieving coefficient  SC  governs convective transport.
 *   Saturation coefficient SA governs diffusive transport.
 *   Both are frequently approximated by the unbound fraction, but they are
 *   distinct measured quantities and are exposed separately.
 */

import { requireFinite, requireFraction } from './units.js';

/** Supported modalities. SCUF is included because it changes the answer. */
export const MODALITIES = Object.freeze({
  SCUF: 'SCUF',
  CVVH: 'CVVH',
  CVVHD: 'CVVHD',
  CVVHDF: 'CVVHDF',
});

/**
 * @typedef {object} CrrtSettings
 * @property {keyof typeof MODALITIES} modality
 * @property {number} bloodFlow            L/h
 * @property {number} dialysateFlow        L/h  (counter-current, CVVHD/CVVHDF)
 * @property {number} preReplacementFlow   L/h  (pre-filter substitution)
 * @property {number} postReplacementFlow  L/h  (post-filter substitution)
 * @property {number} netUltrafiltration   L/h  (patient fluid removal)
 * @property {number} haematocrit          fraction 0-1
 * @property {number} sievingCoefficient   fraction 0-1
 * @property {number} saturationCoefficient fraction 0-1
 * @property {number} [dialysateSaturation] fraction 0-1, default 1
 */

/**
 * @typedef {object} CrrtClearance
 * @property {number} diffusive     L/h
 * @property {number} convective    L/h
 * @property {number} total         L/h
 * @property {number} plasmaWaterFlow L/h
 * @property {number} filtrationRate  L/h
 * @property {number} effluentFlow    L/h
 * @property {number} dilutionFactor  dimensionless, 1 when no pre-dilution
 * @property {string[]} warnings
 */

/**
 * Flows that are meaningless for a modality are forced to zero rather than
 * silently contributing. A dialysate flow left in the form after switching
 * CVVHDF -> CVVH must not keep removing drug.
 *
 * @param {CrrtSettings} s
 * @returns {CrrtSettings}
 */
export function applyModalityMask(s) {
  const m = s.modality;
  const masked = { ...s };
  if (m === MODALITIES.SCUF) {
    masked.dialysateFlow = 0;
    masked.preReplacementFlow = 0;
    masked.postReplacementFlow = 0;
  } else if (m === MODALITIES.CVVH) {
    masked.dialysateFlow = 0;
  } else if (m === MODALITIES.CVVHD) {
    masked.preReplacementFlow = 0;
    masked.postReplacementFlow = 0;
  } else if (m !== MODALITIES.CVVHDF) {
    throw new RangeError(`Unknown CRRT modality: ${m}`);
  }
  return masked;
}

/**
 * Compute the extracorporeal clearance and its components.
 *
 * Model
 *   Qp   = Qb * (1 - Hct)                      plasma water flow
 *   Qf   = Qpre + Qpost + Qnet                 total filtration across membrane
 *   DF   = Qp / (Qp + Qpre)                    pre-dilution correction
 *   CLd  = SA * Qd * eps                       diffusive
 *   CLc  = SC * Qf                             convective
 *   CL   = DF * (CLd + CLc)
 *
 * ASSUMPTION, STATED EXPLICITLY: the pre-dilution factor is applied to the
 * whole filter clearance rather than only to the pre-diluted stream. This is
 * the common simplification in the CRRT dosing literature. It slightly
 * under-predicts clearance when post-dilution replacement is also running.
 * The application surfaces this as a warning whenever both are non-zero.
 *
 * @param {CrrtSettings} settings
 * @returns {CrrtClearance}
 */
export function computeCrrtClearance(settings) {
  const s = applyModalityMask(settings);
  const warnings = [];

  const bloodFlow = requireFinite(s.bloodFlow, 'bloodFlow', { min: 0 });
  const dialysateFlow = requireFinite(s.dialysateFlow, 'dialysateFlow', { min: 0 });
  const preFlow = requireFinite(s.preReplacementFlow, 'preReplacementFlow', { min: 0 });
  const postFlow = requireFinite(s.postReplacementFlow, 'postReplacementFlow', { min: 0 });
  const netUf = requireFinite(s.netUltrafiltration, 'netUltrafiltration', { min: 0 });
  const hct = requireFraction(s.haematocrit, 'haematocrit');
  const sc = requireFraction(s.sievingCoefficient, 'sievingCoefficient');
  const sa = requireFraction(s.saturationCoefficient, 'saturationCoefficient');
  const eps = requireFraction(s.dialysateSaturation ?? 1, 'dialysateSaturation');

  const plasmaWaterFlow = bloodFlow * (1 - hct);
  const filtrationRate = preFlow + postFlow + netUf;
  const effluentFlow = dialysateFlow + preFlow + postFlow + netUf;

  const dilutionFactor = preFlow > 0 && plasmaWaterFlow > 0
    ? plasmaWaterFlow / (plasmaWaterFlow + preFlow)
    : 1;

  const diffusiveRaw = sa * dialysateFlow * eps;
  const convectiveRaw = sc * filtrationRate;

  const diffusive = dilutionFactor * diffusiveRaw;
  const convective = dilutionFactor * convectiveRaw;
  let total = diffusive + convective;

  /* --- physical plausibility guards ------------------------------------ */

  if (plasmaWaterFlow > 0 && total > plasmaWaterFlow) {
    warnings.push(
      `Computed extracorporeal clearance (${total.toFixed(2)} L/h) exceeds plasma water flow ` +
      `(${plasmaWaterFlow.toFixed(2)} L/h). Clearance has been capped at plasma water flow. ` +
      `Check blood flow, haematocrit and the prescribed flows.`
    );
    total = plasmaWaterFlow;
  }

  if (filtrationRate > 0 && plasmaWaterFlow > 0) {
    const filtrationFraction = filtrationRate / plasmaWaterFlow;
    if (filtrationFraction > 0.25) {
      warnings.push(
        `Filtration fraction is ${(filtrationFraction * 100).toFixed(0)}% of plasma water flow. ` +
        `Above roughly 20-25% haemoconcentration and filter clotting become likely, and the ` +
        `constant-sieving assumption used here degrades.`
      );
    }
  }

  if (dialysateFlow > 0 && plasmaWaterFlow > 0 && dialysateFlow > 0.3 * plasmaWaterFlow) {
    warnings.push(
      `Dialysate flow is high relative to plasma water flow, so complete dialysate saturation ` +
      `is unlikely. The saturation efficiency is currently set to ${eps.toFixed(2)}; consider ` +
      `lowering it or supplying a measured saturation coefficient.`
    );
  }

  if (preFlow > 0 && postFlow > 0) {
    warnings.push(
      `Pre- and post-dilution are both non-zero. The pre-dilution correction is applied to the ` +
      `whole filter clearance (the standard simplification), which slightly under-predicts ` +
      `clearance in this configuration.`
    );
  }

  return {
    diffusive,
    convective,
    total,
    plasmaWaterFlow,
    filtrationRate,
    effluentFlow,
    dilutionFactor,
    warnings,
  };
}

/**
 * Not modelled, and deliberately surfaced in the user interface rather than
 * buried here: membrane adsorption (relevant for some agents, notably
 * aminoglycosides on AN69 and several antifungals), filter performance decay
 * over the life of the circuit, citrate-related flow effects on effective
 * clearance, and protein binding that changes with time or concentration.
 */
export const UNMODELLED_EFFECTS = Object.freeze([
  'Membrane adsorption of drug (agent- and membrane-specific).',
  'Filter performance decay over circuit life; a clotting filter clears less than a fresh one.',
  'Concentration- or time-dependent changes in plasma protein binding.',
  'Regional citrate anticoagulation effects on effective solute transport.',
  'Drug removal by any concurrent extracorporeal circuit (for example ECMO sequestration).',
]);
