// instructions.js
// All 84 procedural steps (0-83) stay identical to the original spectrophotometry lab,
// using dedicated pipettes for each liquid type to prevent cross-contamination:
//   - pipette_stock   : Stock Blue #1 bottle & Blue #1 dilution tubes (10/0 .. 2/8)
//   - pipette_water   : Distilled H₂O bottle & Blank tube (0/10)
//   - pipette_unknown : Unknown Drink bottle

import { RINSE_VOLUME } from './config.js';

const instructions = [
    // Sample Prep (Steps 0-19)
    { step: 0,  text: "Prepare Sample 1 (Stock): Use Blue #1 Pipette on 'Stock Blue#1' bottle (Fill 10mL).", action: 'fillPipette', pipette: 'pipette_stock', source: 'stockBottle', volume: 10, highlight: ['pipette_stock', 'stockBottle'] },
    { step: 1,  text: "Dispense 10mL Stock from Blue #1 Pipette into Tube '10/0'.", action: 'dispensePipette', pipette: 'pipette_stock', destination: 'tube_10_0', volume: 10, highlight: ['pipette_stock', 'tube_10_0'] },
    { step: 2,  text: "Prepare Sample 2 (8/2): Fill Blue #1 Pipette with 8mL Stock.", action: 'fillPipette', pipette: 'pipette_stock', source: 'stockBottle', volume: 8, highlight: ['pipette_stock', 'stockBottle'] },
    { step: 3,  text: "Dispense 8mL Stock into Tube '8/2'.", action: 'dispensePipette', pipette: 'pipette_stock', destination: 'tube_8_2', volume: 8, highlight: ['pipette_stock', 'tube_8_2'] },
    { step: 4,  text: "Fill Water (H₂O) Pipette with 2mL Distilled H₂O.", action: 'fillPipette', pipette: 'pipette_water', source: 'waterBottle', volume: 2, highlight: ['pipette_water', 'waterBottle'] },
    { step: 5,  text: "Dispense 2mL Water into Tube '8/2'.", action: 'dispensePipette', pipette: 'pipette_water', destination: 'tube_8_2', volume: 2, highlight: ['pipette_water', 'tube_8_2'] },
    { step: 6,  text: "Prepare Sample 3 (6/4): Fill Blue #1 Pipette with 6mL Stock.", action: 'fillPipette', pipette: 'pipette_stock', source: 'stockBottle', volume: 6, highlight: ['pipette_stock', 'stockBottle'] },
    { step: 7,  text: "Dispense 6mL Stock into Tube '6/4'.", action: 'dispensePipette', pipette: 'pipette_stock', destination: 'tube_6_4', volume: 6, highlight: ['pipette_stock', 'tube_6_4'] },
    { step: 8,  text: "Fill Water (H₂O) Pipette with 4mL Distilled H₂O.", action: 'fillPipette', pipette: 'pipette_water', source: 'waterBottle', volume: 4, highlight: ['pipette_water', 'waterBottle'] },
    { step: 9,  text: "Dispense 4mL Water into Tube '6/4'.", action: 'dispensePipette', pipette: 'pipette_water', destination: 'tube_6_4', volume: 4, highlight: ['pipette_water', 'tube_6_4'] },
    { step: 10, text: "Prepare Sample 4 (4/6): Fill Blue #1 Pipette with 4mL Stock.", action: 'fillPipette', pipette: 'pipette_stock', source: 'stockBottle', volume: 4, highlight: ['pipette_stock', 'stockBottle'] },
    { step: 11, text: "Dispense 4mL Stock into Tube '4/6'.", action: 'dispensePipette', pipette: 'pipette_stock', destination: 'tube_4_6', volume: 4, highlight: ['pipette_stock', 'tube_4_6'] },
    { step: 12, text: "Fill Water (H₂O) Pipette with 6mL Distilled H₂O.", action: 'fillPipette', pipette: 'pipette_water', source: 'waterBottle', volume: 6, highlight: ['pipette_water', 'waterBottle'] },
    { step: 13, text: "Dispense 6mL Water into Tube '4/6'.", action: 'dispensePipette', pipette: 'pipette_water', destination: 'tube_4_6', volume: 6, highlight: ['pipette_water', 'tube_4_6'] },
    { step: 14, text: "Prepare Sample 5 (2/8): Fill Blue #1 Pipette with 2mL Stock.", action: 'fillPipette', pipette: 'pipette_stock', source: 'stockBottle', volume: 2, highlight: ['pipette_stock', 'stockBottle'] },
    { step: 15, text: "Dispense 2mL Stock into Tube '2/8'.", action: 'dispensePipette', pipette: 'pipette_stock', destination: 'tube_2_8', volume: 2, highlight: ['pipette_stock', 'tube_2_8'] },
    { step: 16, text: "Fill Water (H₂O) Pipette with 8mL Distilled H₂O.", action: 'fillPipette', pipette: 'pipette_water', source: 'waterBottle', volume: 8, highlight: ['pipette_water', 'waterBottle'] },
    { step: 17, text: "Dispense 8mL Water into Tube '2/8'.", action: 'dispensePipette', pipette: 'pipette_water', destination: 'tube_2_8', volume: 8, highlight: ['pipette_water', 'tube_2_8'] },
    { step: 18, text: "Prepare Blank (0/10): Fill Water (H₂O) Pipette with 10mL Distilled H₂O.", action: 'fillPipette', pipette: 'pipette_water', source: 'waterBottle', volume: 10, highlight: ['pipette_water', 'waterBottle'] },
    { step: 19, text: "Dispense 10mL Water into Tube '0/10 (Blank)'.", action: 'dispensePipette', pipette: 'pipette_water', destination: 'tube_0_10', volume: 10, highlight: ['pipette_water', 'tube_0_10'] },

    // Zeroing (Steps 20-23)
    { step: 20, text: `Zero Spectrophotometer: Fill Water (H₂O) Pipette (~${RINSE_VOLUME}mL) from Blank Tube '0/10'.`, action: 'fillPipette', pipette: 'pipette_water', source: 'tube_0_10', volume: RINSE_VOLUME, highlight: ['pipette_water', 'tube_0_10'] },
    { step: 21, text: "Dispense Blank from Water (H₂O) Pipette into the Cuvette.", action: 'dispensePipette', pipette: 'pipette_water', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette_water', 'cuvette'] },
    { step: 22, text: "Place Cuvette (with Blank) into the Spectrophotometer.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', allowEmpty: false, allowDirtyInsert: true, highlight: ['cuvette', 'spec20'] },
    { step: 23, text: "Click the 'ZERO' button on the Spectrophotometer.", action: 'zeroSpec', hint: "Click the 'ZERO' button on Spec 20D+.", highlight: ['spec20', 'btn_zero'] },

    // Empty Blank + Rinse (Steps 24-27)
    { step: 24, text: "Empty the Blank Cuvette: Drag Cuvette from Spec 20 to Waste Beaker.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, hint: "Drag (or click) the cuvette to Waste Beaker.", highlight: ['cuvette', 'wasteBeaker'] },
    { step: 25, text: `Rinse Cuvette 1/3: Fill Water (H₂O) Pipette with Distilled H₂O (~${RINSE_VOLUME}mL).`, action: 'fillPipette', pipette: 'pipette_water', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette_water', 'waterBottle'] },
    { step: 26, text: "Rinse Cuvette 2/3: Dispense Water into the Cuvette.", action: 'dispensePipette', pipette: 'pipette_water', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette_water', 'cuvette'] },
    { step: 27, text: "Rinse Cuvette 3/3: Empty rinse water into Waste (Drag Cuvette to Waste).", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, hint: "Drag cuvette to Waste.", highlight: ['cuvette', 'wasteBeaker'] },

    // Measure Sample 1 (10/0) + Rinse (Steps 28-35)
    { step: 28, text: `Measure Sample 1 (10/0): Fill Blue #1 Pipette (~${RINSE_VOLUME}mL) from Tube '10/0'.`, action: 'fillPipette', pipette: 'pipette_stock', source: 'tube_10_0', volume: RINSE_VOLUME, highlight: ['pipette_stock', 'tube_10_0'] },
    { step: 29, text: "Dispense Sample 1 into the *clean* Cuvette.", action: 'dispensePipette', pipette: 'pipette_stock', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette_stock', 'cuvette'] },
    { step: 30, text: "Place Cuvette (Sample 1) into Spec 20.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
    { step: 31, text: "Click the 'MEASURE' button on Spec 20.", action: 'measure', targetDataRowId: 'tube_10_0', highlight: ['spec20', 'btn_measure'] },
    { step: 32, text: "Empty Sample 1 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, highlight: ['cuvette', 'wasteBeaker'] },
    { step: 33, text: "Rinse Cuvette 1/3: Fill Water (H₂O) Pipette with Distilled H₂O.", action: 'fillPipette', pipette: 'pipette_water', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette_water', 'waterBottle'] },
    { step: 34, text: "Rinse Cuvette 2/3: Dispense Water into Cuvette.", action: 'dispensePipette', pipette: 'pipette_water', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette_water', 'cuvette'] },
    { step: 35, text: "Rinse Cuvette 3/3: Empty rinse water into Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, highlight: ['cuvette', 'wasteBeaker'] },

    // Measure Sample 2 (8/2) + Rinse (Steps 36-43)
    { step: 36, text: `Measure Sample 2 (8/2): Fill Blue #1 Pipette (~${RINSE_VOLUME}mL) from Tube '8/2'.`, action: 'fillPipette', pipette: 'pipette_stock', source: 'tube_8_2', volume: RINSE_VOLUME, highlight: ['pipette_stock', 'tube_8_2'] },
    { step: 37, text: "Dispense Sample 2 into Cuvette.", action: 'dispensePipette', pipette: 'pipette_stock', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette_stock', 'cuvette'] },
    { step: 38, text: "Place Cuvette (Sample 2) into Spec 20.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
    { step: 39, text: "Click 'MEASURE' on Spec 20.", action: 'measure', targetDataRowId: 'tube_8_2', highlight: ['spec20', 'btn_measure'] },
    { step: 40, text: "Empty Sample 2 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, highlight: ['cuvette', 'wasteBeaker'] },
    { step: 41, text: "Rinse Cuvette 1/3: Fill Water (H₂O) Pipette with Distilled H₂O.", action: 'fillPipette', pipette: 'pipette_water', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette_water', 'waterBottle'] },
    { step: 42, text: "Rinse Cuvette 2/3: Dispense Water into Cuvette.", action: 'dispensePipette', pipette: 'pipette_water', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette_water', 'cuvette'] },
    { step: 43, text: "Rinse Cuvette 3/3: Empty rinse water into Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, highlight: ['cuvette', 'wasteBeaker'] },

    // Measure Sample 3 (6/4) + Rinse (Steps 44-51)
    { step: 44, text: `Measure Sample 3 (6/4): Fill Blue #1 Pipette (~${RINSE_VOLUME}mL) from Tube '6/4'.`, action: 'fillPipette', pipette: 'pipette_stock', source: 'tube_6_4', volume: RINSE_VOLUME, highlight: ['pipette_stock', 'tube_6_4'] },
    { step: 45, text: "Dispense Sample 3 into Cuvette.", action: 'dispensePipette', pipette: 'pipette_stock', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette_stock', 'cuvette'] },
    { step: 46, text: "Place Cuvette (Sample 3) into Spec 20.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
    { step: 47, text: "Click 'MEASURE' on Spec 20.", action: 'measure', targetDataRowId: 'tube_6_4', highlight: ['spec20', 'btn_measure'] },
    { step: 48, text: "Empty Sample 3 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, highlight: ['cuvette', 'wasteBeaker'] },
    { step: 49, text: "Rinse Cuvette 1/3: Fill Water (H₂O) Pipette with Distilled H₂O.", action: 'fillPipette', pipette: 'pipette_water', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette_water', 'waterBottle'] },
    { step: 50, text: "Rinse Cuvette 2/3: Dispense Water into Cuvette.", action: 'dispensePipette', pipette: 'pipette_water', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette_water', 'cuvette'] },
    { step: 51, text: "Rinse Cuvette 3/3: Empty rinse water into Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, highlight: ['cuvette', 'wasteBeaker'] },

    // Measure Sample 4 (4/6) + Rinse (Steps 52-59)
    { step: 52, text: `Measure Sample 4 (4/6): Fill Blue #1 Pipette (~${RINSE_VOLUME}mL) from Tube '4/6'.`, action: 'fillPipette', pipette: 'pipette_stock', source: 'tube_4_6', volume: RINSE_VOLUME, highlight: ['pipette_stock', 'tube_4_6'] },
    { step: 53, text: "Dispense Sample 4 into Cuvette.", action: 'dispensePipette', pipette: 'pipette_stock', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette_stock', 'cuvette'] },
    { step: 54, text: "Place Cuvette (Sample 4) into Spec 20.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
    { step: 55, text: "Click 'MEASURE' on Spec 20.", action: 'measure', targetDataRowId: 'tube_4_6', highlight: ['spec20', 'btn_measure'] },
    { step: 56, text: "Empty Sample 4 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, highlight: ['cuvette', 'wasteBeaker'] },
    { step: 57, text: "Rinse Cuvette 1/3: Fill Water (H₂O) Pipette with Distilled H₂O.", action: 'fillPipette', pipette: 'pipette_water', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette_water', 'waterBottle'] },
    { step: 58, text: "Rinse Cuvette 2/3: Dispense Water into Cuvette.", action: 'dispensePipette', pipette: 'pipette_water', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette_water', 'cuvette'] },
    { step: 59, text: "Rinse Cuvette 3/3: Empty rinse water into Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, highlight: ['cuvette', 'wasteBeaker'] },

    // Measure Sample 5 (2/8) + Rinse (Steps 60-67)
    { step: 60, text: `Measure Sample 5 (2/8): Fill Blue #1 Pipette (~${RINSE_VOLUME}mL) from Tube '2/8'.`, action: 'fillPipette', pipette: 'pipette_stock', source: 'tube_2_8', volume: RINSE_VOLUME, highlight: ['pipette_stock', 'tube_2_8'] },
    { step: 61, text: "Dispense Sample 5 into Cuvette.", action: 'dispensePipette', pipette: 'pipette_stock', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette_stock', 'cuvette'] },
    { step: 62, text: "Place Cuvette (Sample 5) into Spec 20.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
    { step: 63, text: "Click 'MEASURE' on Spec 20.", action: 'measure', targetDataRowId: 'tube_2_8', highlight: ['spec20', 'btn_measure'] },
    { step: 64, text: "Empty Sample 5 Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, highlight: ['cuvette', 'wasteBeaker'] },
    { step: 65, text: "Rinse Cuvette 1/3: Fill Water (H₂O) Pipette with Distilled H₂O.", action: 'fillPipette', pipette: 'pipette_water', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette_water', 'waterBottle'] },
    { step: 66, text: "Rinse Cuvette 2/3: Dispense Water into Cuvette.", action: 'dispensePipette', pipette: 'pipette_water', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette_water', 'cuvette'] },
    { step: 67, text: "Rinse Cuvette 3/3: Empty rinse water into Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, highlight: ['cuvette', 'wasteBeaker'] },

    // Measure Blank again (0/10) + Rinse (Steps 68-75)
    { step: 68, text: `Measure Blank (0/10) again: Fill Water (H₂O) Pipette (~${RINSE_VOLUME}mL) from Tube '0/10'.`, action: 'fillPipette', pipette: 'pipette_water', source: 'tube_0_10', volume: RINSE_VOLUME, highlight: ['pipette_water', 'tube_0_10'] },
    { step: 69, text: "Dispense Blank into Cuvette.", action: 'dispensePipette', pipette: 'pipette_water', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette_water', 'cuvette'] },
    { step: 70, text: "Place Cuvette (Blank) into Spec 20.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', allowEmpty: false, allowDirtyInsert: true, highlight: ['cuvette', 'spec20'] },
    { step: 71, text: "Click 'MEASURE' (Should read ~100%T / ~0 Abs).", action: 'measure', targetDataRowId: 'tube_0_10', allowBlankMeasure: true, highlight: ['spec20', 'btn_measure'] },
    { step: 72, text: "Empty the Blank Cuvette: Drag Cuvette to Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: false, highlight: ['cuvette', 'wasteBeaker'] },
    { step: 73, text: "Rinse Cuvette 1/3: Fill Water (H₂O) Pipette with Distilled H₂O.", action: 'fillPipette', pipette: 'pipette_water', source: 'waterBottle', volume: RINSE_VOLUME, highlight: ['pipette_water', 'waterBottle'] },
    { step: 74, text: "Rinse Cuvette 2/3: Dispense Water into Cuvette.", action: 'dispensePipette', pipette: 'pipette_water', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette_water', 'cuvette'] },
    { step: 75, text: "Rinse Cuvette 3/3: Empty rinse water into Waste.", action: 'emptyCuvette', cuvette: 'cuvette', destination: 'wasteBeaker', markClean: true, highlight: ['cuvette', 'wasteBeaker'] },

    // Graph Analysis Info Step (Step 76)
    { step: 76, id: 'graph_analysis', text: "Calibration complete. Observe Data Table & Graph. Note the slope.", action: 'info', highlight: ['data-panel', 'graph-panel', 'slope-display'] },

    // Measure Unknown (Steps 77-81) — uses dedicated Unknown Pipette!
    { step: 77, text: `Measure Unknown: Fill Unknown Pipette (~${RINSE_VOLUME}mL) from 'Unknown Drink'.`, action: 'fillPipette', pipette: 'pipette_unknown', source: 'unknownBottle', volume: RINSE_VOLUME, highlight: ['pipette_unknown', 'unknownBottle'] },
    { step: 78, text: "Dispense Unknown from Unknown Pipette into the clean Cuvette.", action: 'dispensePipette', pipette: 'pipette_unknown', destination: 'cuvette', volume: RINSE_VOLUME, highlight: ['pipette_unknown', 'cuvette'] },
    { step: 79, text: "Set Cuvette as Unknown (Internal Step - Auto).", action: 'setUnknownFlag', cuvette: 'cuvette' },
    { step: 80, text: "Place Cuvette (Unknown) into Spec 20.", action: 'insertCuvette', cuvette: 'cuvette', destination: 'spec20', highlight: ['cuvette', 'spec20'] },
    { step: 81, text: "Click 'MEASURE' to find the absorbance of the Unknown.", action: 'measure', targetDataRowId: 'unknown', highlight: ['spec20', 'btn_measure'] },

    // Final Info Steps (Steps 82-83)
    { step: 82, text: "Result recorded. Use Abs and Slope to find concentration.", action: 'info', highlight: ['data-panel', 'unknown-result', 'graph-panel'] },
    { step: 83, text: "Experiment Complete! Analysis finished." },
];

export default instructions;
