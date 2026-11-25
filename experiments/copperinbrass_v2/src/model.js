// The four-language protocol and the worksheet constants live with the original lab.
import steps from '../../copperinbrass/js/instructions.js';
import {
  BRASS_CU_PERCENT,
  FLASK_VOLUME,
  MOLAR_MASS_CU,
  MOLAR_ABSORPTIVITY,
  Y_INTERCEPT,
  MAX_HISTORY,
  calculateConcentration,
  calculateMassPercent,
} from '../../copperinbrass/js/config.js';

export { steps };
export const samples = ['blank', 'std_0.1', 'std_0.2', 'std_0.4', 'unknown'];
export const concentrations = { blank: 0, 'std_0.1': 0.1, 'std_0.2': 0.2, 'std_0.4': 0.4 };
export const reactionTime = 3600;
const liquids = {
  beaker: 'copper',
  flask: 'unknown',
  water: 'blank',
  acid: 'acid',
  std1: 'std_0.1',
  std2: 'std_0.2',
  std4: 'std_0.4',
};
export const round = (n, digits) => Number(n.toFixed(digits));

export function newRun(random = Math.random) {
  return {
    index: 0,
    mass: round(1.3 + random() * 0.4, 3),
    weighed: false,
    brass: 'loose',
    errorOffsets: Object.fromEntries(samples.map((key) => [key, (random() - 0.5) * 0.004])),
    placed: {},
    positions: {},
    pipette: null,
    reactionEnd: null,
    fluid: null,
    flask: 'empty',
    cuvettes: {},
    activeSample: null,
    inserted: null,
    lidOpen: false,
    zeroed: false,
    reading: null,
    readings: [],
    cleanup: [false, false, false, false],
    answer: null,
  };
}

// Equipment IDs describe physical objects. A cuvette keeps its sample identity
// from issue through disposal, even while another cuvette occupies the instrument.
export function operation(s) {
  const step = steps[s.index];
  if (!step) return null;
  const sample = step.cuvetteType || step.assignAs;
  switch (step.action) {
    case 'placeEquipment':
      return { from: step.equipment };
    case 'weighBrass':
      return { from: 'brass', to: 'balance' };
    case 'transferBrass':
      return { from: 'brass', to: 'beaker' };
    case 'fillPipette':
      return { from: 'pipette', to: step.source };
    case 'dispensePipette':
      return { from: 'pipette', to: step.destination };
    case 'disposePipette':
      return { from: 'pipette', to: 'waste' };
    case 'waitReaction':
      return { from: 'beaker' };
    case 'getCuvette':
      return { from: 'rack' };
    case 'dispenseToCuvette':
      return { from: 'pipette', to: sample };
    case 'toggleLid':
      return { from: 'lid' };
    case 'insertCuvette':
      return { from: sample, to: 'chamber' };
    case 'calibrateSpec':
      return { from: 'zero' };
    case 'measure':
      return { from: 'read' };
    case 'removeCuvette':
      return { from: 'lid' };
    case 'cleaningChecklist':
    case 'submitCalculation':
      return { from: 'notebook' };
    default:
      throw Error('Unknown copper protocol action: ' + step.action);
  }
}

export function fitStandards(readings) {
  const rows = readings.filter((row) => row.id.startsWith('std_'));
  if (rows.length < 2) return null;
  const mean = (key) => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
  const x = mean('concentration'),
    y = mean('absorbance');
  let xx = 0,
    xy = 0;
  for (const row of rows) {
    xx += (row.concentration - x) ** 2;
    xy += (row.concentration - x) * (row.absorbance - y);
  }
  if (!xx) return null;
  const slope = xy / xx;
  return { slope, intercept: y - slope * x };
}

function fail(key) {
  return { ok: false, key: 'messages.' + key };
}
function record(s, id, concentration) {
  const value =
    id === 'blank' ? 0 : round(MOLAR_ABSORPTIVITY * concentration + Y_INTERCEPT + s.errorOffsets[id], 3);
  s.reading = value;
  s.readings.push({ id, concentration: id === 'unknown' ? null : concentration, absorbance: value });
}
export function answerFromReadings(s) {
  const reading = s.readings.find((r) => r.id === 'unknown');
  return s.weighed && reading
    ? calculateMassPercent(calculateConcentration(reading.absorbance), s.mass)
    : null;
}

export function act(s, { from, to, answer }, now = Date.now()) {
  const step = steps[s.index],
    expected = operation(s);
  if (!step) return fail('labComplete');
  if (from !== expected.from || to !== expected.to) return fail('invalidInteraction');
  switch (step.action) {
    case 'placeEquipment':
      s.placed[from] = true;
      if (from === 'pipette') s.pipette = { role: step.assignAs, content: null };
      break;
    case 'weighBrass':
      s.weighed = true;
      s.brass = 'pan';
      break;
    case 'transferBrass':
      if (!s.weighed) return fail('weighFirst');
      s.brass = 'beaker';
      break;
    case 'dispensePipette':
      if (!s.pipette?.content) return fail('pipetteEmpty');
      if (to === 'beaker') {
        if (s.pipette.content !== 'acid' || s.brass !== 'beaker') return fail('addAcidFirst');
        s.reactionEnd = now + reactionTime;
        s.fluid = 'reacting';
      } else if (s.pipette.content === 'copper') {
        s.flask = 'digest';
      } else if (s.pipette.content === 'blank' && s.flask === 'digest') {
        s.flask = 'diluted';
      } else return fail('invalidInteraction');
      s.pipette.content = null;
      break;
    case 'fillPipette':
      if (!s.pipette || s.pipette.content) return fail('invalidInteraction');
      if (to === 'beaker' && s.fluid !== 'copper') return fail('fillFromBeaker');
      if (to === 'flask' && s.flask !== 'diluted') return fail('fillFromFlask');
      s.pipette.content = liquids[to];
      if (to === 'beaker') s.fluid = null;
      break;
    case 'disposePipette':
      if (s.pipette?.role !== step.pipetteAssignment) return fail('invalidInteraction');
      s.placed.pipette = false;
      s.pipette = null;
      break;
    case 'waitReaction':
      if (s.reactionEnd == null || now < s.reactionEnd) return fail('reactionInProgress');
      s.brass = 'dissolved';
      s.fluid = 'copper';
      break;
    case 'getCuvette':
      s.activeSample = step.assignAs;
      s.cuvettes[s.activeSample] = { filled: false };
      // Each standard gets a clean transfer pipette when its clean cuvette is issued.
      if (s.activeSample.startsWith('std_')) s.pipette = { role: s.activeSample, content: null };
      break;
    case 'dispenseToCuvette':
      if (!s.cuvettes[to] || s.cuvettes[to].filled || s.pipette?.content !== to)
        return fail('invalidInteraction');
      s.cuvettes[to].filled = true;
      s.pipette.content = null;
      break;
    case 'toggleLid':
      s.lidOpen = true;
      break;
    case 'insertCuvette':
      if (!s.lidOpen || s.inserted || !s.cuvettes[from]?.filled) return fail('openLidFirst');
      s.inserted = from;
      s.reading = null;
      break;
    case 'calibrateSpec':
      if (s.inserted !== 'blank') return fail('useBlankToCalibrate');
      s.lidOpen = false;
      s.zeroed = true;
      record(s, 'blank', 0);
      break;
    case 'measure': {
      if (!s.zeroed || !s.inserted || s.inserted !== s.activeSample) return fail('calibrateFirst');
      const c =
        s.inserted === 'unknown'
          ? (s.mass * BRASS_CU_PERCENT) / MOLAR_MASS_CU / FLASK_VOLUME
          : concentrations[s.inserted];
      s.lidOpen = false;
      record(s, s.inserted, c);
      break;
    }
    case 'removeCuvette':
      if (!s.inserted) return fail('noCuvetteToRemove');
      s.lidOpen = true;
      s.inserted = null;
      s.reading = null;
      break;
    case 'cleaningChecklist':
      if (!s.cleanup.every(Boolean)) return fail('completeCleanupFirst');
      break;
    case 'submitCalculation': {
      if (answer == null || String(answer).trim() === '' || !Number.isFinite(Number(answer)))
        return fail('enterNumeric');
      const percent = answerFromReadings(s);
      if (percent === null) return fail('measureUnknownFirst');
      if (Math.abs(Number(answer) - percent) > 2) return fail('incorrect');
      s.answer = Number(answer);
      break;
    }
  }
  s.index++;
  return { ok: true };
}

export class Run {
  constructor(random) {
    this.state = newRun(random);
    this.history = [];
  }
  perform(input, now) {
    const before = structuredClone(this.state);
    const result = act(this.state, input, now);
    if (result.ok) {
      this.history.push(before);
      if (this.history.length > MAX_HISTORY) this.history.shift();
    }
    return result;
  }
  undo() {
    if (!this.history.length) return false;
    this.state = this.history.pop();
    return true;
  }
}
