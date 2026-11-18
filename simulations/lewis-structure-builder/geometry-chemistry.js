import {DOMAIN_TEMPLATES, GEOMETRY_NAMES, HYBRID_NAMES} from './geometry-tasks.js';

export const GEOMETRY_EVALUATOR_VERSION = 1;
export const initialRotation = () => ({yaw: 20, pitch: 15});
export const geometrySites = arrangement =>
  Array.from({length: DOMAIN_TEMPLATES[arrangement]?.count || 0}, (_, index) =>
    ({id: 'abcd'[index], occupant: null}));

export function initialGeometry() {
  return {
    arrangement: null, sites: [], rotation: initialRotation(), domainCount: null,
    electronGeometry: null, molecularGeometry: null, angle: null, hybridization: null, polarity: null
  };
}

function isChoice(value, choices) {
  return value === null || (typeof value === 'string' && Object.hasOwn(choices, value));
}

export function normalizeGeometry(raw, task) {
  if (!raw || task?.kind !== 'geometry' ||
      !isChoice(raw.arrangement, DOMAIN_TEMPLATES) || !isChoice(raw.electronGeometry, DOMAIN_TEMPLATES) ||
      !isChoice(raw.molecularGeometry, GEOMETRY_NAMES) || !isChoice(raw.angle, task.angleChoices) ||
      !isChoice(raw.hybridization, task.hybridization ? HYBRID_NAMES : {}) ||
      ![null, 'polar', 'nonpolar'].includes(raw.polarity) ||
      !(raw.domainCount === null || Number.isInteger(raw.domainCount) && raw.domainCount >= 0 && raw.domainCount <= 8)) return null;
  const sites = geometrySites(raw.arrangement);
  if (!Array.isArray(raw.sites) || raw.sites.length !== sites.length) return null;
  for (const site of sites) {
    const saved = raw.sites.find(item => item?.id === site.id);
    if (!saved || (saved.occupant !== null && !task.palette.includes(saved.occupant))) return null;
    site.occupant = saved.occupant;
  }
  const rotation = raw.rotation;
  if (!rotation || !Number.isFinite(rotation.yaw) || rotation.yaw < 0 || rotation.yaw >= 360 ||
      !Number.isFinite(rotation.pitch) || rotation.pitch < -60 || rotation.pitch > 60) return null;
  return {
    arrangement: raw.arrangement, sites, rotation: {yaw: rotation.yaw, pitch: rotation.pitch},
    domainCount: raw.domainCount, electronGeometry: raw.electronGeometry, molecularGeometry: raw.molecularGeometry,
    angle: raw.angle, hybridization: raw.hybridization, polarity: raw.polarity
  };
}

export function evaluateGeometry(raw, task) {
  const answer = normalizeGeometry(raw, task);
  if (!answer) return {outcome: 'unsupported', criteria: [], message: 'This construction could not be read.'};
  const criteria = [];
  function compare(label, actual, expected, feedback) {
    const status = actual === null ? 'missing' : actual === expected ? 'met' : 'revise';
    criteria.push({label, status, message: actual === null ? 'Choose an answer for this item.' : feedback});
  }

  compare('Domain count', answer.domainCount, task.domains, `Count the bonds at ${task.center} by direction. Add only the lone pairs on ${task.center}.`);
  compare('Template', answer.arrangement, task.arrangement, 'Find a template with one direction per bonding or lone-pair domain.');
  const counts = {};
  for (const site of answer.sites) {
    if (site.occupant !== null) counts[site.occupant] = (counts[site.occupant] || 0) + 1;
  }
  let siteStatus = 'missing', siteFeedback = 'Fill each site with a bonded atom or a central lone pair.';
  if (answer.arrangement && answer.sites.every(site => site.occupant !== null)) {
    const matches = answer.arrangement === task.arrangement && Object.keys(counts).length === Object.keys(task.inventory).length &&
      Object.entries(task.inventory).every(([piece, count]) => counts[piece] === count);
    siteStatus = matches ? 'met' : 'revise';
    siteFeedback = 'Trace each bond from the central atom in the reference. Compare the terminal atom counts and the number of central lone pairs with your occupied sites.';
  }
  criteria.push({label: 'Assigned sites', status: siteStatus, message: siteFeedback});
  compare('Electron-domain geometry', answer.electronGeometry, task.arrangement,
    'Name the arrangement of every direction around the central atom, including lone-pair sites.');
  compare('Molecular shape', answer.molecularGeometry, task.molecularGeometry,
    'Locate the center and its bonded neighbors. Use those atom positions to name the shape.');
  compare(task.anglePrompt, answer.angle, task.angle, task.angleChoices.smaller
    ? 'Compare the bond angle of this lone-pair-bearing molecule with the four-site ideal reference. A drawing on the screen only shows a projection.'
    : 'Use the ideal angle for the selected electron-domain geometry. A 2D projection can make that angle appear wider or narrower.');
  if (task.hybridization) compare('Central orbital model', answer.hybridization, task.hybridization,
    'Match the number of similarly directed hybrids in the simple valence-bond model to the central domain count.');
  compare('Molecular polarity', answer.polarity, task.polarity,
    'Consider both the directions and the identities of the bonds. Ask whether their dipoles cancel as vectors in this molecule.');
  const missing = criteria.filter(item => item.status === 'missing').length;
  const revise = criteria.filter(item => item.status === 'revise').length;
  const outcome = revise ? 'revise' : missing ? 'incomplete' : 'correct';
  const message = outcome === 'correct' ? `${task.formula} construction complete. ${task.explanation}`
    : `${criteria.length - missing - revise} of ${criteria.length} checks met. ${revise ? 'Review the marked choices and try again.' : 'Complete the unanswered items and check again.'}`;
  return {outcome, criteria, message};
}
