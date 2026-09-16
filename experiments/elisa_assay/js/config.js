/* =============================================================================
 * config.js  —  Single source of truth for the ELISA simulation.
 *
 * Everything the science depends on (the two 12-well strips, the dilution
 * series, reagents, volumes, the patient cohort and its answer key, and the
 * ordered procedure) lives here so the rest of the code stays generic.
 * Nothing in this file touches the DOM.
 *
 * Protocol source: PLTW / EDVOTEK Experiment #468 "Mystery Infection",
 * Module 1 (Performing a Quantitative ELISA) and Module 2 (Analysis).
 *
 * Exposed as the global  Lab.config  (classic script, works from file://).
 * ========================================================================== */
(function (Lab) {
  'use strict';

  /* ----- The two strips ---------------------------------------------------
     Protocol step 1: two 12-well strip tubes, one labelled 1–12 (the standard
     curve) and one labelled 13–24 (controls and patients).  Well ids are the
     printed numbers, as integers, so "well 7" in the protocol is well 7 here. */
  var STRIPS = [
    { id: 'A', first: 1,  last: 12, label: '1–12',  role: 'standards',
      caption: 'Standard curve', sub: 'serial dilution of the antigen' },
    { id: 'B', first: 13, last: 24, label: '13–24', role: 'samples',
      caption: 'Controls & patients', sub: 'three wells per sample' }
  ];

  var WELLS_PER_STRIP = 12;

  /* ----- The dilution series ----------------------------------------------
     Well 1 receives 100 µL of a 100 µg/mL antigen stock.  Every later well
     starts with 50 µL of dilution buffer and receives 50 µL from the well
     before it, so each step halves the concentration.  These numbers are not
     hard-coded into the simulation — the engine mixes volumes and lets the
     concentration fall out (see state.pourInto) — they are the answer key for
     Table A, and the ladder the patient samples are read against. */
  var STOCK = 100;                 // µg/mL, the antigen as supplied
  var DOSE = 50;                   // µL — every transfer in this protocol

  function standardConc(well) {    // well 1..12
    return STOCK / Math.pow(2, well - 1);
  }
  function standardDilution(well) {
    return well === 1 ? '—' : '1:' + Math.pow(2, well - 1);
  }

  /* The bottom of the scale sits one rung BELOW the last standard, not on it.
     If well 12 were the zero point it would develop no colour at all and be
     indistinguishable from the negative control — which is not what a real
     strip looks like, and it would hide the thing this experiment is for: an
     assay has a detection limit, and well 12 is sitting right on it. */
  var CONC_MIN = standardConc(WELLS_PER_STRIP + 1);   // 0.0244 µg/mL
  var CONC_MAX = STOCK;                               // 100 µg/mL, well 1

  /* ----- Signal model -----------------------------------------------------
     A real ELISA read is roughly linear in log(concentration) across the
     useful range, which is exactly why the standard curve is a 2-fold SERIAL
     dilution: evenly spaced in log space gives evenly spaced colour.  So the
     strength of a well is its position on that log ladder, which puts well n
     at (12 − n)/11 and lets a patient well be matched to a standard by eye —
     the whole point of the assay. */
  function signalOf(conc) {
    if (!conc || conc <= 0) return 0;
    var s = (Math.log(conc) - Math.log(CONC_MIN)) / (Math.log(CONC_MAX) - Math.log(CONC_MIN));
    return Math.max(0, Math.min(1, s));
  }

  /* ----- The colour a well actually shows ---------------------------------
     TMB is colourless going in.  HRP turns it BLUE; the acid stop solution
     converts that blue product to a stable YELLOW, which is what the assay is
     read as.  Both stages are modelled, because the colour flipping the
     moment stop solution lands is the part students remember. */
  var SIGNAL = {
    tmb:     { base: '#1782c8', deep: '#0c4f80' },   // developing — TMB blue
    stopped: { base: '#f2c00d', deep: '#a87c00' },   // read colour — acid yellow
    blank:   { base: '#f4f6f7', deep: '#d8dee1' }    // no antigen: near-colourless
  };

  /* ----- Reagents ---------------------------------------------------------
     `dark` doubles as the label colour called out in the protocol ("Dil. Buf.
     — pink label", "Antigen — yellow label", and so on), so the tube rack
     looks like the kit box.  `fill` is what the liquid itself looks like. */
  var REAGENTS = {
    DIL:  { id: 'DIL',  name: 'Dilution Buffer',    abbr: 'Dil. Buf.', fill: '#f7d3e0', dark: '#d9548d', bulk: true },
    AG:   { id: 'AG',   name: 'Antigen · 100 µg/mL', abbr: 'Antigen',  fill: '#fbe9a7', dark: '#d9a520', bulk: true },
    AB1:  { id: 'AB1',  name: 'Primary Antibody',   abbr: '1° AB',     fill: '#cfe9cd', dark: '#3f9142', bulk: true },
    AB2:  { id: 'AB2',  name: 'Secondary Antibody', abbr: '2° AB',     fill: '#fbd9b4', dark: '#e07b1f', bulk: true },
    TMB:  { id: 'TMB',  name: 'TMB Substrate',      abbr: 'TMB',       fill: '#cfe2f5', dark: '#1f6fb0', bulk: true },
    STOP: { id: 'STOP', name: 'Stop Solution',      abbr: 'Stop',      fill: '#e2cdb6', dark: '#8a5a2b', bulk: true },
    WASH: { id: 'WASH', name: 'Wash Buffer',        abbr: 'Wash',      fill: '#dbe7ee', dark: '#7c98a8', bulk: true },
    POS:  { id: 'POS',  name: 'Positive Control',   abbr: '+ CTRL',    fill: '#eef0f2', dark: '#5b6770', sample: true },
    NEG:  { id: 'NEG',  name: 'Negative Control',   abbr: '– CTRL',    fill: '#eef0f2', dark: '#5b6770', sample: true },
    P1:   { id: 'P1',   name: 'Patient sample 1',   abbr: 'PT 1',      fill: '#eef0f2', dark: '#5b6770', sample: true },
    P2:   { id: 'P2',   name: 'Patient sample 2',   abbr: 'PT 2',      fill: '#eef0f2', dark: '#5b6770', sample: true },
    MIX:  { id: 'MIX',  name: 'Diluted antigen',    abbr: 'dilution',  fill: '#fbe9a7', dark: '#d9a520', internal: true }
  };

  /* ----- The cohort -------------------------------------------------------
     Table C of the protocol names nine students.  The diagnoses — who is
     positive and who is not — are PLTW's own, from the Activity 1.1.5 ELISA
     Lab Results key (Sue 50, Jill 12, Maria 3.33, Marco 1.66 µg/mL; the other
     five negative).  The values here are those numbers snapped to the nearest
     rung of the standard ladder, which moves none of them by more than 7% —
     well inside what a strip can be read to — and buys the thing that makes
     the strip readable at all: every positive patient matches one standard
     well EXACTLY, so a student estimates by matching rather than guessing
     between two rungs.

     The concentrations also carry the epidemiology: antigen load falls as you
     move down the transmission chain, so ordering the positives from highest
     to lowest reconstructs who infected whom.  The histories are the
     corroborating evidence, and they also supply the dead ends — four of the
     five negatives had plausible contact and still did not catch it. */
  var PATIENTS = [
    { id: 'sue',     name: 'Sue',     conc: 50,     history: 'Index case. Dorm 3, room 214. Collapsed in class Monday; first spinal tap of the outbreak.' },
    { id: 'jill',    name: 'Jill',    conc: 12.5,   history: "Sue's room-mate in Dorm 3, room 214 — same room, same bathroom, right up until Sue was admitted." },
    { id: 'anthony', name: 'Anthony', conc: 0,      history: "Sue's lab partner in Biology — same bench, same equipment, three afternoons a week." },
    { id: 'wanda',   name: 'Wanda',   conc: 0,      history: 'Dorm 3, room 216 — next door to Sue, but the two have never met.' },
    { id: 'maggie',  name: 'Maggie',  conc: 0,      history: 'Works the cafeteria line with Jill. No contact off shift.' },
    { id: 'maria',   name: 'Maria',   conc: 3.125,  history: 'On the soccer team with Jill; they shared a water bottle at Thursday practice. Reported a stiff neck on Saturday.' },
    { id: 'arnie',   name: 'Arnie',   conc: 0,      history: 'Soccer team with Jill and Maria, but missed the Thursday practice.' },
    { id: 'marco',   name: 'Marco',   conc: 1.5625, history: "In Maria's Friday-evening study group. Mild headache only." },
    { id: 'alvin',   name: 'Alvin',   conc: 0,      history: 'Also in that study group; sat at the far end of the table.' }
  ];

  // Which group reported each patient on the shared class board (Module 2,
  // step 3: "SHARE your findings with other groups").
  var CLASS_GROUPS = ['Group 1', 'Group 2', 'Group 3', 'Group 4', 'Group 5'];

  /* ----- Controls ---------------------------------------------------------
     The positive control is the undiluted antigen; the negative control is
     dilution buffer with nothing in it. */
  var CONTROL_CONC = { POS: STOCK, NEG: 0 };

  /* ----- How strip B is loaded -------------------------------------------
     Protocol steps 11–14: three wells per sample, tip replaced between. */
  var SAMPLE_BLOCKS = [
    { key: 'POS', wells: [13, 14, 15], label: 'Positive Control',  short: '+ CTRL' },
    { key: 'NEG', wells: [16, 17, 18], label: 'Negative Control',  short: '– CTRL' },
    { key: 'P1',  wells: [19, 20, 21], label: '1st Patient Sample', short: 'Patient 1' },
    { key: 'P2',  wells: [22, 23, 24], label: '2nd Patient Sample', short: 'Patient 2' }
  ];

  /* ----- Volume model -----------------------------------------------------
     An adjustable-volume micropipette set to 50 µL, with 200 µL tips.  The
     pipette is charged ONCE PER WELL: draw 50 µL, dispense 50 µL, draw again.
     A 200 µL tip could physically hold four doses, but nobody works that way
     with an adjustable-volume pipette — it is set to one volume and that is
     the volume it moves, every time — and a student who watched one draw fill
     four wells would take away the wrong idea of what the instrument does. */
  var VOLUME = {
    tipMax: 200,        // µL the tip holds
    dose: DOSE,         // µL per draw AND per dispense — every step of this protocol
    wellMax: 300,       // µL the moulded well holds before it overflows
    washFill: 220       // µL of wash buffer per well — "fill each well"
  };

  /* ----- Timing -----------------------------------------------------------
     Real incubations are 5 minutes; the bench timer runs them at 50× so the
     lab fits a class period.  The clock face still counts real minutes,
     because that is the number students have to remember. */
  var TIMING = {
    speed: 50,
    incubate: 5 * 60,       // s — after samples, after 1° AB, after 2° AB
    develop: 5 * 60,        // s — TMB, "2–5 minutes"
    developMin: 2 * 60
  };

  /* ----- Procedure --------------------------------------------------------
     `module` decides which checklist the step appears under, so Module 2 can
     be opened and worked on its own. */
  var CHECKLIST = [
    { key: 'label',      module: 1, text: 'Label both strip tubes' },
    { key: 'buffer',     module: 1, text: 'Dilution buffer → wells 2–12' },
    { key: 'antigen',    module: 1, text: '100 µL antigen → well 1' },
    { key: 'serial',     module: 1, text: 'Serial dilution through well 12' },
    { key: 'discard',    module: 1, text: 'Discard 50 µL from well 12' },
    { key: 'samples',    module: 1, text: 'Load controls & patient samples' },
    { key: 'incubate1',  module: 1, text: 'Incubate 5 min' },
    { key: 'wash1',      module: 1, text: 'Wash the wells twice' },
    { key: 'primary',    module: 1, text: 'Primary antibody → every well' },
    { key: 'incubate2',  module: 1, text: 'Incubate 5 min' },
    { key: 'wash2',      module: 1, text: 'Wash the wells twice' },
    { key: 'secondary',  module: 1, text: 'Secondary antibody → every well' },
    { key: 'incubate3',  module: 1, text: 'Incubate 5 min' },
    { key: 'wash3',      module: 1, text: 'Wash the wells twice' },
    { key: 'substrate',  module: 1, text: 'TMB substrate → every well' },
    { key: 'develop',    module: 1, text: 'Develop 2–5 min' },
    { key: 'stop',       module: 1, text: 'Stop solution → every well' },
    { key: 'read',       module: 2, text: 'Diagnose the controls & patients' },
    { key: 'quantify',   module: 2, text: 'Quantify against the standards' },
    { key: 'trace',      module: 2, text: 'Trace the chain of infection' }
  ];

  /* Phase → the plain-language heading shown in the status pane.  Numbers are
     the protocol's own step numbers so a student can keep a finger on the
     printed procedure. */
  var PHASE_LABEL = {
    intro:      'Ready',
    label:      'Step 1 · Label the strips',
    buffer:     'Step 2 · Dilution buffer',
    antigen:    'Step 3 · Antigen',
    serial:     'Steps 4–7 · Serial dilution',
    discard:    'Step 8 · Discard from well 12',
    samples:    'Steps 10–14 · Controls & patients',
    incubate1:  'Step 15 · Incubate 5 min',
    wash1:      'Steps 16–19 · Wash twice',
    primary:    'Step 20 · Primary antibody',
    incubate2:  'Step 21 · Incubate 5 min',
    wash2:      'Step 22 · Wash twice',
    secondary:  'Step 23 · Secondary antibody',
    incubate3:  'Step 24 · Incubate 5 min',
    wash3:      'Step 25 · Wash twice',
    substrate:  'Step 26 · TMB substrate',
    develop:    'Step 27 · Develop',
    stop:       'Step 28 · Stop solution',
    analysis:   'Module 2 · Analysis',
    done:       'Complete'
  };

  /* The order phases run in.  Kept as data so the engine never hard-codes a
     "what comes next" chain. */
  var PHASE_ORDER = [
    'label', 'buffer', 'antigen', 'serial', 'discard', 'samples',
    'incubate1', 'wash1', 'primary', 'incubate2', 'wash2',
    'secondary', 'incubate3', 'wash3', 'substrate', 'develop', 'stop',
    'analysis'
  ];

  /* Which reagent each dispensing phase draws. */
  var PHASE_REAGENT = {
    buffer: 'DIL', antigen: 'AG', primary: 'AB1',
    secondary: 'AB2', substrate: 'TMB', stop: 'STOP'
  };

  /* The three incubations and the three washes, so one routine serves all. */
  var INCUBATIONS = {
    incubate1: { after: 'wash1',      seconds: TIMING.incubate, note: 'sample adsorbing to the wells' },
    incubate2: { after: 'wash2',      seconds: TIMING.incubate, note: 'primary antibody binding the antigen' },
    incubate3: { after: 'wash3',      seconds: TIMING.incubate, note: 'secondary antibody binding the primary' },
    develop:   { after: 'stop',       seconds: TIMING.develop,  note: 'HRP turning TMB blue' }
  };
  var WASHES = { wash1: 'primary', wash2: 'secondary', wash3: 'substrate' };

  /* ----- Derived helpers -------------------------------------------------- */
  function allWells() {
    var out = [];
    for (var i = 1; i <= WELLS_PER_STRIP * 2; i++) out.push(i);
    return out;
  }
  function stripOf(well) { return well <= WELLS_PER_STRIP ? STRIPS[0] : STRIPS[1]; }
  function patientById(id) {
    for (var i = 0; i < PATIENTS.length; i++) if (PATIENTS[i].id === id) return PATIENTS[i];
    return null;
  }
  function blockForWell(well) {
    for (var i = 0; i < SAMPLE_BLOCKS.length; i++) {
      if (SAMPLE_BLOCKS[i].wells.indexOf(well) !== -1) return SAMPLE_BLOCKS[i];
    }
    return null;
  }

  /* Format a concentration the way a student would write it into Table A/B. */
  function fmtConc(c) {
    if (!c) return '0';
    if (c >= 10) return String(Math.round(c * 100) / 100);
    if (c >= 1) return String(Math.round(c * 1000) / 1000);
    return String(Number(c.toPrecision(3)));
  }

  /* Is a typed answer close enough to the expected concentration?  A strip is
     read by eye and estimated against the ladder, so this accepts the right
     rung rather than an exact decimal — ±45% is comfortably inside the 2×
     gap between neighbouring standards. */
  function concMatches(expected, typed) {
    var v = parseFloat(String(typed).replace(/[^0-9.eE+-]/g, ''));
    if (isNaN(v)) return false;
    if (!expected) return v === 0;
    if (v <= 0) return false;
    return Math.abs(Math.log(v / expected)) < Math.log(1.45);
  }

  Lab.config = {
    STRIPS: STRIPS,
    WELLS_PER_STRIP: WELLS_PER_STRIP,
    STOCK: STOCK,
    DOSE: DOSE,
    CONC_MIN: CONC_MIN,
    CONC_MAX: CONC_MAX,
    SIGNAL: SIGNAL,
    REAGENTS: REAGENTS,
    PATIENTS: PATIENTS,
    CLASS_GROUPS: CLASS_GROUPS,
    CONTROL_CONC: CONTROL_CONC,
    SAMPLE_BLOCKS: SAMPLE_BLOCKS,
    VOLUME: VOLUME,
    TIMING: TIMING,
    CHECKLIST: CHECKLIST,
    PHASE_LABEL: PHASE_LABEL,
    PHASE_ORDER: PHASE_ORDER,
    PHASE_REAGENT: PHASE_REAGENT,
    INCUBATIONS: INCUBATIONS,
    WASHES: WASHES,
    standardConc: standardConc,
    standardDilution: standardDilution,
    signalOf: signalOf,
    allWells: allWells,
    stripOf: stripOf,
    patientById: patientById,
    blockForWell: blockForWell,
    fmtConc: fmtConc,
    concMatches: concMatches
  };
})(window.Lab = window.Lab || {});
