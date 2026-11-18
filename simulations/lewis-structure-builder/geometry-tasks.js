import {LEWIS_SPECIES} from './structure-examples.js';

export const DOMAIN_TEMPLATES = Object.freeze({
  linear: {label: 'Two directions · linear', count: 2},
  'trigonal-planar': {label: 'Three directions · trigonal planar', count: 3},
  tetrahedral: {label: 'Four directions · tetrahedral', count: 4}
});
export const GEOMETRY_NAMES = Object.freeze({
  linear: 'Linear', 'trigonal-planar': 'Trigonal planar', bent: 'Bent',
  'trigonal-pyramidal': 'Trigonal pyramidal', tetrahedral: 'Tetrahedral'
});
export const REFERENCE_ANGLES = Object.freeze({'180': '180°', '120': '120°', tetra: 'About 109.5°'});
const relativeAngles = Object.freeze({smaller: 'Smaller', equal: 'About equal', larger: 'Larger'});
export const HYBRID_NAMES = Object.freeze({sp: 'sp', sp2: 'sp²', sp3: 'sp³'});

function geometry(id, {shape, angle, anglePrompt, polarity, hybridization = null, prompt, explanation}) {
  const {graph, formula, name} = LEWIS_SPECIES[id];
  const center = graph.atoms.find(atom => atom.id === 'center');
  const bonded = graph.bonds.filter(bond => bond.a === center.id || bond.b === center.id);
  const inventory = {}, bondOrders = {};
  for (const bond of bonded) {
    const neighborId = bond.a === center.id ? bond.b : bond.a;
    const {element} = graph.atoms.find(atom => atom.id === neighborId);
    inventory[element] = (inventory[element] || 0) + 1;
    bondOrders[element] = bond.order;
  }
  if (center.lonePairs) inventory['lone-pair'] = center.lonePairs;
  const domains = bonded.length + center.lonePairs;
  const arrangement = Object.keys(DOMAIN_TEMPLATES).find(key => DOMAIN_TEMPLATES[key].count === domains);
  const palette = [...Object.keys(bondOrders), 'lone-pair'];
  return {
    taskId: `geometry-${id}`, taskVersion: 1, kind: 'geometry', formula, name, prompt, explanation,
    reference: graph, center: center.element, inventory, bondOrders, domains, arrangement, palette,
    molecularGeometry: shape, angle, anglePrompt,
    angleChoices: Object.hasOwn(relativeAngles, angle) ? relativeAngles : REFERENCE_ANGLES,
    hybridization, polarity
  };
}

const tasks = [
  geometry('sif4', {
    shape: 'tetrahedral', angle: 'tetra', anglePrompt: 'Ideal F–Si–F angle', polarity: 'nonpolar', hybridization: 'sp3',
    prompt: 'Arrange the fluorines around silicon. From a second viewing direction, decide whether all four bond dipoles can cancel.',
    explanation: 'Four equivalent Si–F bonds point toward the corners of a regular tetrahedron. Their dipoles add to zero even though each bond is polar.'
  }),
  geometry('pcl3', {
    shape: 'trigonal-pyramidal', angle: 'smaller', anglePrompt: 'Cl–P–Cl angle compared with 109.5°', polarity: 'polar',
    prompt: 'Translate phosphorus trichloride into a domain model. Use the chlorine positions to name the molecular shape and predict its dipole.',
    explanation: 'Three P–Cl bonds and one phosphorus lone pair occupy four domains. The three chlorine atoms form the base of a pyramid, and PCl₃ has a net dipole. Its Cl–P–Cl angle is smaller than the ideal tetrahedral angle.'
  }),
  geometry('scl2', {
    shape: 'bent', angle: 'smaller', anglePrompt: 'Cl–S–Cl angle compared with 109.5°', polarity: 'polar',
    prompt: 'Represent the central sulfur domains. Then decide what an observer would call the geometry if only the atom positions were visible.',
    explanation: 'The two sulfur lone pairs contribute to the four-domain count. The Cl–S–Cl framework is bent and polar, with a bond angle smaller than the tetrahedral reference.'
  }),
  geometry('cs2', {
    shape: 'linear', angle: '180', anglePrompt: 'Ideal S–C–S angle', polarity: 'nonpolar', hybridization: 'sp',
    prompt: 'Use the carbon disulfide drawing to place the central domains. Decide how many directions two multiple bonds occupy.',
    explanation: 'Each C=S double bond takes one direction at carbon. Identical sulfur ends lie opposite one another, so the linear molecule has no net dipole.'
  }),
  geometry('ocs', {
    shape: 'linear', angle: '180', anglePrompt: 'Ideal O–C–S angle', polarity: 'polar', hybridization: 'sp',
    prompt: 'Replace one end of carbon disulfide with oxygen in your comparison. Decide which predictions about shape and dipole survive the substitution.',
    explanation: 'The two double bonds again define a straight molecular axis. Carbonyl sulfide has unlike ends and a net dipole along this axis.'
  }),
  geometry('h2cs', {
    shape: 'trigonal-planar', angle: '120', anglePrompt: 'Reference angle for ideal domains around carbon', polarity: 'polar', hybridization: 'sp2',
    prompt: 'Use the supplied electron pairs to decide how many directions carbon needs. Rotate your model to see whether the atoms can all lie in one plane.',
    explanation: 'Two C–H bonds and one C=S bond define three coplanar directions. The ideal domain spacing is 120°. The different bond types allow unequal bond angles, and the molecule has a net dipole.'
  })
];
export const GEOMETRY_TASKS = Object.freeze(Object.fromEntries(tasks.map(task => [task.taskId, task])));
