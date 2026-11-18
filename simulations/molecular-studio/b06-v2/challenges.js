import {ELEMENTS, atom, neighbors, sumBonds, environment, spacingError, ANGLE_TOLERANCE, IDEAL_ANGLE, hybridization, signed} from './molecule-model.js';

function target(elements, bonds) {
  const graph = {
    atoms: Object.entries(elements).map(([id, element]) => ({id, element})),
    bonds: bonds.map(([a, b, order = 1]) => ({a, b, order})),
  };
  for (const a of graph.atoms) {
    a.pairs = (ELEMENTS[a.element].electrons - sumBonds(graph, a.id)) / 2;
  }
  return graph;
}

export const CHALLENGES = {
  acetonitrile: {
    name: 'Acetonitrile', formula: 'CH₃–C≡N',
    brief: 'Build acetonitrile and compare its two carbon centers. Include all H atoms and the nitrogen lone pair.',
    hints: ['Group the three H atoms on one carbon. The other carbon joins that group to nitrogen.',
      'Complete the octets with a multiple bond. Count each neighboring nucleus once when arranging directions.',
      'Turn on Geometry and select the methyl carbon. Choose two H neighbors to measure H–C–H. At the other carbon, choose C and N to measure C–C–N.'],
    target: target({methyl: 'C', nitrile: 'C', n: 'N', h1: 'H', h2: 'H', h3: 'H'},
      [['methyl','nitrile'], ['nitrile','n',3], ['methyl','h1'], ['methyl','h2'], ['methyl','h3']]),
    centers: {methyl: 'Methyl carbon', nitrile: 'Nitrile carbon'},
    real: 'Measured: C–C≡N 180°; H–C–H close to 109.5°. Methyl C sp³, nitrile C sp. 5 σ, 2 π (both π in C≡N).',
  },
  carbonylFluoride: {
    name: 'Carbonyl fluoride', formula: 'COF₂',
    brief: 'Build one neutral molecule with C at the center, both F atoms terminal and O bonded to C. Choose the bond orders yourself.',
    hints: ['Give each F one neighbor and complete its valence shell.',
      'Use the remaining electrons to fill the carbon and oxygen octets.',
      'Inspect all three directions at carbon. Count the double bond once.'],
    target: target({c: 'C', o: 'O', f1: 'F', f2: 'F'}, [['c','o',2], ['c','f1'], ['c','f2']]),
    centers: {c: 'Carbonyl carbon'},
    real: 'Measured: planar; F–C–F ≈108°, not 120°: the C=O double bond takes more angular space than C–F. C sp². 3 σ, 1 π.',
  },
  hydrazine: {
    name: 'Hydrazine', formula: 'H₂N–NH₂',
    brief: 'Join two nitrogen centers and distribute four hydrogens between them. Complete the lone pairs and arrange the domains at both centers.',
    hints: ['Start with an N–N link and place the same number of H atoms on each N.',
      'Each N supplies five valence electrons. Account for the electrons it contributes to its bonds.',
      'Inspect both local sets of domains. Rotation about the N–N bond is free in this model.'],
    target: target({n1:'N', n2:'N', h1:'H', h2:'H', h3:'H', h4:'H'},
      [['n1','n2'], ['n1','h1'], ['n1','h2'], ['n2','h3'], ['n2','h4']]),
    centers: {n1: 'Nitrogen center', n2: 'Nitrogen center'},
    real: 'Measured: each N pyramidal, H–N–H below 109.5° (lone pair takes more space). Preferred conformation gauche; the kit leaves N–N torsion free and does not grade it. Both N sp³. 5 σ, 0 π.',
  },
  hof: {
    name: 'Hypofluorous acid', formula: 'HOF',
    brief: 'Build the neutral H–O–F skeleton. Give both electron-rich atoms their lone pairs and arrange the domains at oxygen.',
    hints: ['H occupies one end. O is the only atom bonded to two different elements.',
      'Account separately for the six valence electrons on O and the seven on F.',
      'Follow only the nuclei to describe the H–O–F shape. Include lone pairs when spacing the domains.'],
    target: target({h:'H', o:'O', f:'F'}, [['h','o'], ['o','f']]),
    centers: {o: 'Oxygen center'},
    real: 'Measured: H–O–F ≈97°, below water’s 104.5°. VSEPR predicts the sign of the deviation from 109.5°, not its size. O sp³ (AP model). 2 σ, 0 π.',
  },
  methanimine: {
    name: 'Methanimine', formula: 'H₂C=NH',
    brief: 'Build a neutral C–N framework with two H atoms on carbon and one on nitrogen. Distinguish their local molecular shapes.',
    hints: ['Use the H distribution to identify the two different centers.',
      'Choose a C–N bond order that satisfies both octets. Place the remaining nonbonding electrons.',
      'Compare the number of bonded neighbors with the number of occupied directions at each center.'],
    target: target({c:'C', n:'N', h1:'H', h2:'H', h3:'H'},
      [['c','n',2], ['c','h1'], ['c','h2'], ['n','h3']]),
    centers: {c: 'Imine carbon', n: 'Imine nitrogen'},
    real: 'Measured: planar; angles at C near 120°, H–N=C ≈110° (lone pair on N). C sp², N sp²: same domain count, different shapes. 4 σ, 1 π.',
  },
  dimethylSulfide: {
    name: 'Dimethyl sulfide', formula: 'CH₃–S–CH₃',
    brief: 'Link two methyl groups through sulfur. Build the electron pairs at sulfur and arrange both methyl centers.',
    hints: ['Put S between the two C atoms. The two carbon atoms do not share a direct bond.',
      'Complete each methyl group with H. Use the two S–C bonds to find the remaining electrons on S.',
      'Compare the shape traced by the three heavy atoms with the four directions at each C.'],
    target: target({left:'C', s:'S', right:'C', h1:'H', h2:'H', h3:'H', h4:'H', h5:'H', h6:'H'},
      [['left','s'], ['right','s'], ['left','h1'], ['left','h2'], ['left','h3'],
       ['right','h4'], ['right','h5'], ['right','h6']]),
    centers: {s: 'Sulfur bridge', left: 'Methyl carbon', right: 'Methyl carbon'},
    real: 'Measured: C–S–C ≈99° (two lone pairs on S; cf. H₂S ≈92°). Methyl C near 109.5°. 8 σ, 0 π.',
  },
  ketene: {
    name: 'Ketene', formula: 'H₂C=C=O',
    brief: 'Construct two consecutive double bonds. Use the positions of the nuclei to distinguish the two neighboring carbon centers.',
    hints: ['Attach both H atoms to the same end carbon. O occupies the other end.',
      'Fill the carbon octets along C–C–O. Supply oxygen with its nonbonding electrons.',
      'Measure the C–C–O angle, then inspect a bond angle at the carbon carrying H.'],
    target: target({end:'C', middle:'C', o:'O', h1:'H', h2:'H'},
      [['end','middle',2], ['middle','o',2], ['end','h1'], ['end','h2']]),
    centers: {end: 'CH₂ carbon', middle: 'Middle carbon'},
    real: 'Measured: C=C=O 180° (sp middle C); CH₂ end planar with H–C–H close to 120° (sp² C). The two π bonds lie in perpendicular planes. 4 σ, 2 π.',
  },
};

function composition(g) {
  const counts = new Map();
  for (const a of g.atoms) counts.set(a.element, (counts.get(a.element) || 0) + 1);
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([element, count]) => count + ' ' + element).join(' · ');
}

// Match element-labelled graphs by a bijection. A degree/neighbor signature
// narrows the candidates, but only the full pairwise edge check accepts them.
function matchGraph(expected, actual, withOrders, withPairs) {
  if (expected.bonds.length !== actual.bonds.length) return null;
  const signature = (g, id) => neighbors(g, id)
    .map(n => atom(g,n.id).element + (withOrders ? n.order : '')).sort().join('/');
  const actualSignatures = new Map(actual.atoms.map(a => [a.id, signature(actual, a.id)]));
  const candidates = expected.atoms.map(e => {
    const neighborElements = signature(expected, e.id);
    const matches = actual.atoms.filter(a => a.element === e.element &&
      actualSignatures.get(a.id) === neighborElements && (!withPairs || a.pairs === e.pairs));
    return {id: e.id, matches};
  }).sort((a, b) => a.matches.length - b.matches.length);
  const edge = (g, a, b) => neighbors(g, a).find(n => n.id === b)?.order || 0;
  const mapping = new Map(), used = new Set();

  function assign(index) {
    if (index === candidates.length) return true;
    const {id, matches} = candidates[index];
    for (const candidate of matches) {
      if (used.has(candidate.id)) continue;
      const compatible = [...mapping].every(([e, a]) => {
        const wanted = edge(expected, id, e), observed = edge(actual, candidate.id, a);
        return withOrders ? wanted === observed : Boolean(wanted) === Boolean(observed);
      });
      if (!compatible) continue;
      mapping.set(id, candidate.id);
      used.add(candidate.id);
      if (assign(index + 1)) return true;
      mapping.delete(id);
      used.delete(candidate.id);
    }
    return false;
  }
  return assign(0) ? mapping : null;
}

export function assessChallenge(challenge, graph) {
  const expected = challenge.target, checks = [];
  function check(label, pass, detail) {
    checks.push({label, pass, detail});
    return pass;
  }
  const wanted = composition(expected), actual = composition(graph);
  if (!check('Atom inventory', wanted === actual, 'Target ' + wanted + '. Placed ' + (actual || 'no atoms') + '.')) return checks;
  const connected = matchGraph(expected, graph, false, false);
  if (!check('Connectivity', Boolean(connected), connected
      ? 'Every atom has the intended neighbors.'
      : 'Trace each link from the scaffold, including the center that carries each H. The element counts already match.')) return checks;

  const ordered = matchGraph(expected, graph, true, false);
  const orderNames = ['','single','double','triple'];
  const wrongOrders = ordered ? [] : expected.bonds.flatMap(b => {
    const a = atom(graph,connected.get(b.a)), other = atom(graph,connected.get(b.b));
    const placed = neighbors(graph,a.id).find(n=>n.id===other.id).order;
    return placed===b.order ? [] : [a.element+a.id+'–'+other.element+other.id+' uses a '+orderNames[placed]+' bond and needs a '+orderNames[b.order]+' bond.'];
  });
  // Explain the orders with the neutral bond counts of the elements involved.
  const bondCounts = [...new Set(expected.atoms.map(a => a.element))].map(element => {
    const a = expected.atoms.find(x => x.element === element);
    return element + ' ' + sumBonds(expected, a.id);
  }).join(', ');
  const orderWhy = ' Neutral bond counts (all FC 0): ' + bondCounts + '; a double bond counts 2, a triple bond 3.';
  if (!check('Bond orders', Boolean(ordered), ordered ? 'Each connection has the intended bond order.' : wrongOrders.join(' ') + orderWhy)) return checks;
  const paired = matchGraph(expected, graph, true, true);
  const missing = expected.atoms.filter(a => a.pairs !== atom(graph, ordered.get(a.id)).pairs);
  const pairDetail = paired ? 'Lone-pair counts match the neutral Lewis structure; every FC is 0.' : missing.map(e => {
    const a = atom(graph, ordered.get(e.id)), electrons = ELEMENTS[a.element].electrons, bonds = sumBonds(graph, a.id);
    const charge = electrons - 2 * a.pairs - bonds;
    return a.element + a.id + ': ' + a.pairs + ' placed, ' + e.pairs + ' needed (' + electrons + ' valence − ' + bonds +
      ' bonding = ' + (electrons - bonds) + ' nonbonding electrons; current FC ' + signed(charge) + ')';
  }).join(' · ') + '.';
  if (!check('Lone pairs', Boolean(paired), pairDetail)) return checks;

  for (const [key, role] of Object.entries(challenge.centers)) {
    const a = atom(graph, paired.get(key)), model = environment(expected, key);
    const error = spacingError(graph, a.id);
    const electron = model.electron.toLowerCase(), hybrid = hybridization(model);
    const setting = model.shape.toLowerCase() === electron
      ? electron + ' electron geometry, 0 lone pairs'
      : electron + ' electron geometry, ' + model.pairs + ' lone pair' + (model.pairs === 1 ? '' : 's');
    const pass = error !== null && error <= ANGLE_TOLERANCE;
    const detail = model.shape + ' · ' + model.domains + ' domains (' + setting + (hybrid ? ', ' + hybrid : '') + '). ' + (error !== null
      ? 'Largest departure from ' + IDEAL_ANGLE[model.domains].toFixed(1) + '° is ' + error.toFixed(1) + '° (allowance ' + ANGLE_TOLERANCE + '°).' +
        (pass ? '' : ' Re-spread all ' + model.domains + ' domains, lone pairs included: drag atoms or use Apply directions.')
      : 'Separate the atoms and seat every local lone pair before measuring.');
    check(role + ' · ' + a.element + a.id, pass, detail);
  }
  return checks;
}
