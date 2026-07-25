/**
 * Illustrative parameter sets, shipped as a module rather than fetched as
 * JSON so that the page issues no network request after load. The content is
 * plain data and is meant to be read and edited directly.
 *
 * NONE of these is a qualified population pharmacokinetic model. See
 * governance/model-selection.md for why none is bundled.
 */

export const DRUG_DATA = {
  "_README": "Illustrative parameter sets. NONE of these is a qualified population pharmacokinetic model. They exist so the interface can be exercised and so the shape of a parameter entry is clear. Every value carries a provenance record; where the basis is a general reference value rather than a specific published model, the record says so and carries no citation. Do not use these to draw conclusions about a patient. See governance/model-selection.md for why no qualified model is bundled.",
  "_schemaVersion": "1.0.0",
  "_qualityFlags": {
    "illustrative": "General reference value or round number chosen to exercise the interface. Not traceable to a specific published population model. Must not be relied upon.",
    "reported": "Value taken directly from a named source, with the table or figure recorded.",
    "derived": "Computed from reported values; the derivation is recorded.",
    "user": "Entered by the user of the application; provenance is whatever the user recorded."
  },
  "drugs": [
    {
      "id": "illustrative-beta-lactam-a",
      "name": "Illustrative beta-lactam A",
      "note": "Loosely shaped after a hydrophilic, renally cleared, minimally protein-bound beta-lactam. Chosen to make CRRT effects visible. Not any specific agent.",
      "applicability": "None. This is a teaching placeholder, not a patient-representative model.",
      "parameters": {
        "unboundFraction": {
          "value": 0.8,
          "unit": "fraction",
          "qualityFlag": "illustrative",
          "provenance": {
            "type": "general-reference",
            "note": "Approximate unbound fraction for a minimally protein-bound beta-lactam. No specific source."
          }
        },
        "nonrenalClearance": {
          "value": 1.0,
          "unit": "L/h",
          "qualityFlag": "illustrative",
          "provenance": {
            "type": "general-reference",
            "note": "Round value representing residual non-renal elimination. No specific source."
          }
        },
        "V1": {
          "value": 18,
          "unit": "L",
          "qualityFlag": "illustrative",
          "provenance": {
            "type": "general-reference",
            "note": "Central volume of the order expected for a hydrophilic agent in an oedematous critically ill adult. No specific source."
          }
        },
        "Q2": {
          "value": 6,
          "unit": "L/h",
          "qualityFlag": "illustrative",
          "provenance": {
            "type": "general-reference",
            "note": "Intercompartmental clearance chosen to give a visible distribution phase. No specific source."
          }
        },
        "V2": {
          "value": 12,
          "unit": "L",
          "qualityFlag": "illustrative",
          "provenance": {
            "type": "general-reference",
            "note": "Peripheral volume. No specific source."
          }
        }
      },
      "defaultTarget": {
        "mic": 16,
        "targetMultiple": 1,
        "note": "For beta-lactams the usual pharmacodynamic index is the fraction of the dosing interval during which the unbound concentration exceeds the MIC. The multiple to apply, and whether 40%, 60% or 100% of the interval is sought, are contested and setting-specific. Choose deliberately."
      }
    },
    {
      "id": "illustrative-beta-lactam-b",
      "name": "Illustrative beta-lactam B (higher clearance, single compartment)",
      "note": "A one-compartment variant, useful for checking behaviour against hand calculation because every quantity has a closed form.",
      "applicability": "None. Teaching placeholder.",
      "parameters": {
        "unboundFraction": {
          "value": 0.7,
          "unit": "fraction",
          "qualityFlag": "illustrative",
          "provenance": {
            "type": "general-reference",
            "note": "No specific source."
          }
        },
        "nonrenalClearance": {
          "value": 2.0,
          "unit": "L/h",
          "qualityFlag": "illustrative",
          "provenance": {
            "type": "general-reference",
            "note": "No specific source."
          }
        },
        "V1": {
          "value": 25,
          "unit": "L",
          "qualityFlag": "illustrative",
          "provenance": {
            "type": "general-reference",
            "note": "No specific source."
          }
        },
        "Q2": {
          "value": 0,
          "unit": "L/h",
          "qualityFlag": "illustrative",
          "provenance": {
            "type": "general-reference",
            "note": "Set to zero to give a one-compartment model."
          }
        },
        "V2": {
          "value": 0,
          "unit": "L",
          "qualityFlag": "illustrative",
          "provenance": {
            "type": "general-reference",
            "note": "Unused when Q2 is zero."
          }
        }
      },
      "defaultTarget": {
        "mic": 4,
        "targetMultiple": 1,
        "note": "See note on the other preset."
      }
    }
  ],
  "crrtPresets": [
    {
      "id": "cvvhdf-moderate",
      "label": "CVVHDF, moderate intensity",
      "settings": {
        "modality": "CVVHDF",
        "bloodFlowMlMin": 200,
        "dialysateFlowLh": 1.0,
        "preReplacementFlowLh": 0,
        "postReplacementFlowLh": 1.0,
        "netUltrafiltrationLh": 0.1
      },
      "note": "Effluent 2.1 L/h. At 70 kg that is 30 mL/kg/h. KDIGO-referenced delivered effluent doses are commonly quoted around 20-25 mL/kg/h; prescriptions are often written higher to allow for downtime."
    },
    {
      "id": "cvvh-post",
      "label": "CVVH, post-dilution",
      "settings": {
        "modality": "CVVH",
        "bloodFlowMlMin": 200,
        "dialysateFlowLh": 0,
        "preReplacementFlowLh": 0,
        "postReplacementFlowLh": 2.0,
        "netUltrafiltrationLh": 0.1
      },
      "note": "Purely convective. Compare with the pre-dilution preset to see the dilution penalty."
    },
    {
      "id": "cvvh-pre",
      "label": "CVVH, pre-dilution",
      "settings": {
        "modality": "CVVH",
        "bloodFlowMlMin": 200,
        "dialysateFlowLh": 0,
        "preReplacementFlowLh": 2.0,
        "postReplacementFlowLh": 0,
        "netUltrafiltrationLh": 0.1
      },
      "note": "Same fluid rate as the post-dilution preset, but solute reaching the membrane is diluted, so clearance is lower."
    },
    {
      "id": "cvvhd",
      "label": "CVVHD",
      "settings": {
        "modality": "CVVHD",
        "bloodFlowMlMin": 200,
        "dialysateFlowLh": 2.0,
        "preReplacementFlowLh": 0,
        "postReplacementFlowLh": 0,
        "netUltrafiltrationLh": 0.1
      },
      "note": "Purely diffusive apart from net fluid removal."
    }
  ]
};

export default DRUG_DATA;
