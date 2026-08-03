/* =============================================================================
 * config.js  —  Single source of truth for the DNA Microarray simulation.
 *
 * Everything the science depends on (patients, genes, expected spot colours,
 * reagents, volumes, procedure phases) lives here so the rest of the code can
 * stay generic.  Nothing in this file touches the DOM.
 *
 * Exposed as the global  Lab.config  (classic script, works from file://).
 * ========================================================================== */
(function (Lab) {
  'use strict';

  /* ----- Grid geometry ---------------------------------------------------- */
  // Four patients (rows E–H) × nine assay columns.  This shape is fixed by the
  // science: the analysis table needs all 4×9 = 36 results.
  var ROW_KEYS = ['E', 'F', 'G', 'H'];
  var COLS = 9;

  /* ----- Patients --------------------------------------------------------- */
  // Row key -> patient.  Patient 1 is "Grandpa Joe" (the original scenario).
  var PATIENTS = [
    { row: 'E', n: 1, name: 'Grandpa Joe', note: 'Long-term smoker, persistent cough.' },
    { row: 'F', n: 2, name: 'Patient 2',   note: 'Non-smoker, routine screening.' },
    { row: 'G', n: 3, name: 'Patient 3',   note: 'Former smoker, family history.' },
    { row: 'H', n: 4, name: 'Patient 4',   note: 'Occupational exposure (radon).' }
  ];

  /* ----- Assay columns ---------------------------------------------------- */
  // Columns 1–4 are calibration/reference spots; 5–9 are the genes of interest.
  var COLUMNS = [
    { col: 1, short: 'Normal', gene: null,      label: 'Reference', desc: 'Calibration spot — always reads Normal (yellow).' },
    { col: 2, short: 'Up',     gene: null,      label: 'Positive +', desc: 'Positive control — always Up-regulated (red).' },
    { col: 3, short: 'Down',   gene: null,      label: 'Negative –', desc: 'Negative control — always Down-regulated (green).' },
    { col: 4, short: 'Blank',  gene: null,      label: 'Blank',      desc: 'No probe printed — stays dark (black).' },
    { col: 5, short: 'Gene 1', gene: 'CEACAM6', label: 'CEACAM6',    desc: 'Carcinoembryonic antigen — over-expressed in many lung adenocarcinomas.' },
    { col: 6, short: 'Gene 2', gene: 'SFTPB',   label: 'SFTPB',      desc: 'Surfactant protein B — marks healthy alveolar (type II) cells.' },
    { col: 7, short: 'Gene 3', gene: 'TP53',    label: 'TP53',       desc: 'Guardian of the genome — the key tumour-suppressor gene.' },
    { col: 8, short: 'Gene 4', gene: 'SRY',     label: 'SRY',        desc: 'Y-chromosome sex-determining gene (sample-sex check).' },
    { col: 9, short: 'Gene 5', gene: 'CYP1A1',  label: 'CYP1A1',     desc: 'Metabolises tobacco carcinogens — induced by smoking.' }
  ];

  /* ----- Expected result colours (the "answer key") ----------------------- */
  // Preserved exactly from the original experiment.  Index 0 => column 1.
  var EXPECTED = {
    E: ['yellow', 'red', 'green', 'black', 'red', 'yellow', 'green', 'black', 'red'],
    F: ['yellow', 'red', 'green', 'black', 'red', 'yellow', 'green', 'black', 'red'],
    G: ['yellow', 'red', 'green', 'black', 'red', 'yellow', 'green', 'black', 'yellow'],
    H: ['yellow', 'red', 'green', 'black', 'red', 'yellow', 'yellow', 'black', 'red']
  };

  /* ----- Colour → meaning legend ------------------------------------------ */
  var LEGEND = {
    red:    { symbol: '↑', keys: ['u', '↑'],       word: 'Up-regulated',   meaning: 'Gene expression increased vs. reference.' },
    green:  { symbol: '↓', keys: ['d', '↓'],       word: 'Down-regulated', meaning: 'Gene expression decreased vs. reference.' },
    yellow: { symbol: '=', keys: ['n', '='],       word: 'Normal',         meaning: 'Expression unchanged vs. reference.' },
    black:  { symbol: '–', keys: ['-', 'b', ''],   word: 'None / Blank',   meaning: 'No signal (blank or below detection).' }
  };

  /* ----- Reagents --------------------------------------------------------- */
  // `fill` is the liquid colour; `glow` is how a finished spot fluoresces.
  var REAGENTS = {
    EB:   { id: 'EB',   name: 'Equilibration Buffer', fill: '#4fc3f7', dark: '#0277bd', abbr: 'EB' },
    cDNA: { id: 'cDNA', name: 'Control cDNA',         fill: '#81c784', dark: '#2e7d32', abbr: 'cDNA' },
    HB:   { id: 'HB',   name: 'Hybridisation Buffer', fill: '#ba68c8', dark: '#6a1b9a', abbr: 'HB' },
    MIX:  { id: 'MIX',  name: 'Mixed Sample',         fill: '#ffb74d', dark: '#e65100', abbr: 'MIX' }
  };

  // Colour a finished spot shows under UV, keyed by the answer-key colour name.
  var SPOT_COLORS = {
    red:    { base: '#e53935', glow: '#ff5252' },
    green:  { base: '#43a047', glow: '#69f0ae' },
    yellow: { base: '#fdd835', glow: '#ffee58' },
    black:  { base: '#1a1a1a', glow: '#2a2a2a' }
  };

  /* ----- Volume model ----------------------------------------------------- */
  // A single-channel pipette holds ONE dose. The student aspirates and
  // dispenses for every well/spot individually — no bulk load, no sweeping.
  var VOLUME = {
    max: 10,         // µL the tip can hold (P10-style, so 5 µL reads half-full)
    dispense: 5,     // µL delivered per spot/well
    fill: 5          // µL drawn per aspiration (one dose)
  };

  /* ----- Procedure phases & checklist ------------------------------------- */
  // The ordered checklist shown to the learner (same steps as the original).
  var CHECKLIST = [
    { key: 'orient',    text: 'Orient card & plate' },
    { key: 'eb',        text: 'Apply Equilibration Buffer (EB)' },
    { key: 'dry1',      text: 'Dry card (post-EB)' },
    { key: 'mixSpot',   text: 'Mix control cDNA & spot samples' },
    { key: 'dry2',      text: 'Dry card (post-sample)' },
    { key: 'hb',        text: 'Apply Hybridisation Buffer (HB)' },
    { key: 'dry3',      text: 'Dry card (post-HB)' },
    { key: 'visualize', text: 'Visualise with UV light' },
    { key: 'analyze',   text: 'Analyse results' }
  ];

  /* ----- Derived helpers -------------------------------------------------- */
  // Ordered list of every spot/well id, e.g. "E1" … "H9".
  function allIds() {
    var out = [];
    ROW_KEYS.forEach(function (r) {
      for (var c = 1; c <= COLS; c++) out.push(r + c);
    });
    return out;
  }

  function patientByRow(row) {
    for (var i = 0; i < PATIENTS.length; i++) if (PATIENTS[i].row === row) return PATIENTS[i];
    return null;
  }

  function expectedColor(id) {
    var row = id.charAt(0);
    var col = parseInt(id.slice(1), 10);
    return EXPECTED[row] ? EXPECTED[row][col - 1] : null;
  }

  Lab.config = {
    ROW_KEYS: ROW_KEYS,
    COLS: COLS,
    PATIENTS: PATIENTS,
    COLUMNS: COLUMNS,
    EXPECTED: EXPECTED,
    LEGEND: LEGEND,
    REAGENTS: REAGENTS,
    SPOT_COLORS: SPOT_COLORS,
    VOLUME: VOLUME,
    CHECKLIST: CHECKLIST,
    allIds: allIds,
    patientByRow: patientByRow,
    expectedColor: expectedColor
  };
})(window.Lab = window.Lab || {});
