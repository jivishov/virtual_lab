// Objects start at their working stations. Each step describes a laboratory operation.
export const samples = ['blank', 'std_0.1', 'std_0.2', 'std_0.4', 'unknown'];

function cuvetteRun(sample, source, phase) {
  const blank = sample === 'blank';
  const role = blank ? 'water' : sample;
  const draw = blank ? 'drawBlank' : sample === 'unknown' ? 'drawUnknown' : 'drawStandard';
  return [
    { action: 'getCuvette', from: 'rack', prompt: 'takeCell' },
    { action: 'fillPipette', from: 'pipette', to: source, role, prompt: draw },
    { action: 'dispenseToCuvette', from: 'pipette', to: sample, prompt: 'fillCell' },
    ...(blank ? [{ action: 'toggleLid', from: 'lid', prompt: 'openLid' }] : []),
    { action: 'insertCuvette', from: sample, to: 'chamber', prompt: 'insertCell' },
    blank
      ? { action: 'calibrateSpec', from: 'zero', prompt: 'zeroBlank' }
      : { action: 'measure', from: 'read', prompt: 'readCell' },
    { action: 'removeCuvette', from: 'lid', prompt: 'returnCell' },
  ].map((step) => ({ ...step, phase, sample }));
}

export const steps = [
  { phase: 'weigh', action: 'weighBrass', from: 'brass', to: 'balance', prompt: 'weighBrass' },
  { phase: 'dissolve', action: 'transferBrass', from: 'brass', to: 'beaker', prompt: 'transferBrass' },
  { phase: 'dissolve', action: 'fillPipette', from: 'pipette', to: 'acid', role: 'acid', prompt: 'drawAcid' },
  { phase: 'dissolve', action: 'dispensePipette', from: 'pipette', to: 'beaker', prompt: 'addAcid' },
  { phase: 'dissolve', action: 'disposePipette', from: 'pipette', to: 'waste', role: 'acid', prompt: 'discardAcid' },
  { phase: 'dissolve', action: 'waitReaction', from: 'beaker', prompt: 'observeBrass' },
  { phase: 'dilution', action: 'fillPipette', from: 'pipette', to: 'beaker', role: 'copper', prompt: 'drawDigest' },
  { phase: 'dilution', action: 'dispensePipette', from: 'pipette', to: 'flask', prompt: 'quantTransfer' },
  { phase: 'dilution', action: 'disposePipette', from: 'pipette', to: 'waste', role: 'copper', prompt: 'discardCopper' },
  { phase: 'dilution', action: 'fillPipette', from: 'pipette', to: 'water', role: 'water', prompt: 'drawWater' },
  { phase: 'dilution', action: 'dispensePipette', from: 'pipette', to: 'flask', prompt: 'fillMark' },
  ...cuvetteRun('blank', 'water', 'blanking'),
  ...cuvetteRun('std_0.1', 'std1', 'standardsPhase'),
  ...cuvetteRun('std_0.2', 'std2', 'standardsPhase'),
  ...cuvetteRun('std_0.4', 'std4', 'standardsPhase'),
  ...cuvetteRun('unknown', 'flask', 'unknown'),
  { phase: 'report', action: 'cleaningChecklist', from: 'notebook', prompt: 'recordCleanup' },
  { phase: 'report', action: 'submitCalculation', from: 'notebook', prompt: 'reportCopper' },
];
