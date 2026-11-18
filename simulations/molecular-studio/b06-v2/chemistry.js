import {additions} from './vsepr-cases.js';
import {geometryMatches, bondSymbol,referenceLengths,dot,unit} from './vsepr-kit.js';
import {assemblyProblem} from './vsepr-assembly.js';
export const LETTERS = [...'ABCDEF'];
export const EMPTY = 'empty';
export const PAIR = 'pair';
export const isBond = kind => kind === 'bond' || kind === 'other';

// Only real domain directions are drilled into a case's hub. A socket is
// one bond direction or one lone-pair region, never one individual electron.
const planar = Array.from({length: 3}, (_, i) => {
  const a = Math.PI * (1 / 2 - 2*i / 3);
  return [Math.cos(a), Math.sin(a), 0];
});
const HUBS = {
  linear: {vectors:[[-1,0,0],[1,0,0]], names:['left','right'], example:[0,1], degrees:'180°', geometry:'linear'},
  planar: {vectors:planar, names:['upper','lower right','lower left'],
    example:[0,1,2], degrees:'120°', geometry:'trigonal planar'},
  tetra: {vectors:[[-1/3,Math.sqrt(8)/3,0],[-1/3,-Math.sqrt(2)/3,Math.sqrt(2/3)],[-1/3,-Math.sqrt(2)/3,-Math.sqrt(2/3)],[1,0,0]],
    names:['upper left','front lower left','back lower left','right'],example:[0,1,2,3],degrees:'109.5°',geometry:'tetrahedral'},
  tbp: {vectors:[[1,0,0],[-.5,0,Math.sqrt(3)/2],[-.5,0,-Math.sqrt(3)/2],[0,1,0],[0,-1,0]],
    names:['equatorial right','equatorial front left','equatorial back left','axial upper','axial lower'],
    example:[0,1,2,3,4],pairSites:[0,1,2],degrees:'90° / 120° / 180°',geometry:'trigonal bipyramidal'},
  octa: {vectors:[[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]],
    names:['upper','lower','right','left','front','back'],
    example:[0,1,2,3,4,5],pairSites:[0,1],degrees:'90° / 180°',geometry:'octahedral'},
};

// Pauling electronegativities quoted in the written feedback, and the valence
// electrons of each central atom used to explain its lone-pair count.
export const ELECTRONEGATIVITY = {H:2.20,Be:1.57,B:2.04,C:2.55,N:3.04,O:3.44,F:3.98,Si:1.90,P:2.19,S:2.58,Cl:3.16,Se:2.55,Br:2.96,I:2.66,Xe:2.60};
const VALENCE = {Be:2,B:3,C:4,N:5,O:6,Si:4,P:5,S:6,Cl:7,Se:6,Br:7,I:7,Xe:8};
// AP Chemistry assigns sp, sp² and sp³ to two, three and four electron domains.
const HYBRID = {2: 'sp', 3: 'sp²', 4: 'sp³'};
const SYMMETRY_SOURCE = {author: 'NIST CCCBDB point groups', url: 'https://cccbdb.nist.gov/pglistx.asp'};

// Bond arrows encode a qualitative classroom model. 0 suppresses a negligible
// bond contribution. Equal arrows indicate equivalent bonds within one species.
function ligand(element, count, order, lonePairs, arrow = 1) {
  return {element, count, order, lonePairs, arrow};
}
const definitions = {
  cs2: {
    name: 'Carbon disulfide', formula: 'CS₂', center: 'C', hub: 'linear',
    ligands: [ligand('S', 2, 2, 2, 0)], pairs: 0, shape: 'Linear', net: 'none',
    task: 'Build S=C=S. Carbon shares two of its 4 valence electrons with each S, so each C=S double bond is one bond piece. Seat both pieces and count the hub directions they fill.',
    evidence: 'Each C=S double bond shares two electron pairs along one direction. The two S atoms lie on opposite sides of C. Carbon and sulfur have almost equal Pauling electronegativities, so the kit omits the tiny C=S bond arrows. Identical ends give CS₂ zero net dipole.',
    physical: {text: 'Experiments place CS₂ in the linear, symmetric point group D∞h, so the S–C–S angle is exactly 180°.', ...SYMMETRY_SOURCE},
    real: 'Real CS₂ is linear: S–C–S measures 180°, the ideal angle.',
    why: 'With no lone pair on C, nothing can push the two double-bond domains off the line, so the measured angle equals the ideal one.',
    next: 'Next, try OCS: the same linear shape with unlike ends.',
  },
  sif4: {
    name: 'Silicon tetrafluoride', formula: 'SiF₄', center: 'Si', hub: 'tetra',
    ligands: [ligand('F', 4, 1, 3)], pairs: 0, shape: 'Tetrahedral', net: 'none',
    task: 'Si has 4 valence electrons, one for each Si–F bond. Seat four Si–F bond pieces in hub sockets so that every F–Si–F angle is the same.',
    evidence: 'Four bonding domains point toward the vertices of a tetrahedron. Every Si → F bond is polar. The four equivalent arrows sum to zero in this arrangement, so SiF₄ is nonpolar.',
    physical: {text: 'Experiments place SiF₄ in the tetrahedral point group Td, so every F–Si–F angle is exactly 109.47°.', ...SYMMETRY_SOURCE},
    real: 'Real SiF₄ keeps the ideal 109.5° between every pair of bonds.',
    why: 'Four identical bonding domains and no lone pair push equally on each other, so nothing distorts the tetrahedron.',
    next: 'Next, try PCl₃: still four domains, but one of them is a lone pair.',
  },
  pcl3: {
    physical: {text:'A gas-phase equilibrium estimate gives a Cl–P–Cl angle of about 100.2° from rotational data with calculated corrections.', author:'Breidung & Thiel (2019)', url:'https://doi.org/10.1021/acs.jpca.9b04406'},
    name: 'Phosphorus trichloride', formula: 'PCl₃', center: 'P', hub: 'tetra',
    ligands: [ligand('Cl', 3, 1, 3)], pairs: 1, shape: 'Trigonal pyramidal', net: 'Cl',
    task: 'Seat three P–Cl bond pieces on the hub. P has 5 valence electrons: subtract the ones used in bonds and seat a lone-pair piece for each remaining pair.',
    evidence: 'Three P–Cl bonds and one central lone pair occupy four domains. The atom positions form a trigonal pyramid. Its three P → Cl bond arrows add toward the center of the chlorine face. PCl₃ is polar.',
    real: 'Real PCl₃: Cl–P–Cl is about 100°, smaller than the ideal tetrahedral socket angle of 109.5°.',
    why: 'VSEPR predicts a trigonal-pyramidal shape with one lone pair, but does not calculate the measured angle. Atom-specific electronic structure and interactions matter: NH₃ has the same domain count but an angle near 107°.',
    next: 'Next, try BBr₃: three bonded atoms again, but no lone pair on the center.',
  },
  scl2: {
    physical: {text:'Millimeter-wave spectroscopy gives a Cl–S–Cl angle of about 102.7° in the gas-phase substitution structure.', author:'Bizzocchi et al. (2000)', url:'https://doi.org/10.1006/jmsp.2000.8223'},
    name: 'Sulfur dichloride', formula: 'SCl₂', center: 'S', hub: 'tetra',
    ligands: [ligand('Cl', 2, 1, 3)], pairs: 2, shape: 'Bent', net: 'Cl',
    task: 'Seat two S–Cl bond pieces. S has 6 valence electrons: seat the ones left after bonding as lone-pair pieces before you choose the angle between the bonds.',
    evidence: 'Two S–Cl bonds and two sulfur lone pairs occupy four domains. The two bonds form a bent molecular shape. Their S → Cl arrows add along the angle bisector toward the chlorine side. SCl₂ is polar.',
    real: 'Real SCl₂: Cl–S–Cl is about 103°, below the ideal 109.5° used by the kit.',
    why: 'Two bonds and two lone pairs give a bent shape. Lone-pair counting alone cannot explain the different measured angles of SCl₂, H₂O and H₂S; the bonds and atomic electronic structures also differ.',
    next: 'Next, try H₂S: the same center and lone pairs, with H in place of Cl.',
  },
  h2s: {
    name: 'Hydrogen sulfide', formula: 'H₂S', center: 'S', hub: 'tetra',
    ligands: [ligand('H', 2, 1, 0, -0.55)], pairs: 2, shape: 'Bent', net: 'S',
    task: 'Seat two S–H bond pieces and account for the rest of sulfur’s 6 valence electrons with lone-pair pieces. Compare the direction of electron pull with SCl₂.',
    evidence: 'Two S–H bonds and two sulfur lone pairs give a bent molecule. Sulfur pulls more strongly than H. The weak H → S bond arrows now point inward and add toward the sulfur side. H₂S is polar.',
    physical: {text:'Rotational spectroscopy gives a ground-state average H–S–H angle of about 92.1°.', author:'Cook, De Lucia & Helminger (1975)', url:'https://doi.org/10.1016/0022-2860(75)80094-9'},
    real: 'Real H₂S: H–S–H is only about 92°, far below the ideal 109.5° and below water’s 104.5°.',
    why: 'Four electron domains predict a bent shape here, but the ideal tetrahedral kit does not predict the measured 92.1° angle. The sp³ label is only the introductory domain-counting model; real orbital mixing need not be ideal sp³.',
    next: 'Next, compare SCl₂: the same bent shape with the bond arrows reversed.',
  },
  bbr3: {
    name: 'Boron tribromide', formula: 'BBr₃', center: 'B', hub: 'planar',
    ligands: [ligand('Br', 3, 1, 3)], pairs: 0, shape: 'Trigonal planar', net: 'none',
    task: 'B has 3 valence electrons, one assigned to each B–Br bond. Seat three B–Br pieces in the three planar sockets, 120° apart.',
    evidence: 'Three single bonds place six shared electrons around B. Three equivalent bonding directions spread through one plane. The B → Br arrows form a symmetric set at 120° and cancel, so BBr₃ is nonpolar.',
    physical: {text: 'Experiments place BBr₃ in the trigonal planar point group D3h, so every Br–B–Br angle is exactly 120°.', ...SYMMETRY_SOURCE},
    real: 'Real BBr₃ is flat, with every Br–B–Br angle at the ideal 120°.',
    why: 'B has only six electrons around it (an incomplete octet) and no lone pair. Three identical domains spread evenly in one plane, so the measured angle equals the ideal one.',
    next: 'Next, try PCl₃: three bonded atoms plus a lone pair make a pyramid instead.',
  },
  ocs: {
    name: 'Carbonyl sulfide', formula: 'OCS', center: 'C', hub: 'linear',
    ligands: [ligand('O', 1, 2, 2), ligand('S', 1, 2, 2, 0)], pairs: 0, shape: 'Linear', net: 'O',
    task: 'Build O=C=S from one C=O and one C=S bond piece. Each double bond uses two of carbon’s 4 valence electrons. Compare these unlike ends with those of CS₂.',
    evidence: 'Both double bonds occupy one direction each. The C=O bond pulls strongly toward O, while the C=S contribution is small on the Pauling scale. The ends are inequivalent, so the bond-arrow model points toward O. Linear OCS is polar. The real C=S bond is polar toward S even though the electronegativities nearly match. It partly cancels C=O, which is why OCS measures only 0.715 D, still with O as the negative end.',
    physical: {text: 'Experiments place OCS in the linear point group C∞v (a straight line with unlike ends), so the O–C–S angle is exactly 180°.', ...SYMMETRY_SOURCE},
    real: 'Real OCS is linear at 180°, like CS₂, yet it is polar because its two ends differ.',
    why: 'Two domains with no central lone pair always point opposite each other, whatever atoms sit at the ends. The shape comes from the domains; the polarity comes from the unlike ends.',
    next: 'Next, compare CS₂: the same shape with identical ends.',
  },
};

export const MOLECULES = Object.fromEntries(Object.entries({...additions,...definitions}).map(([id, raw]) => {
  const spec=referenceLengths(id,raw);
  const hub = {...HUBS[spec.hub],key:spec.hub};
  const pieces = Object.fromEntries(spec.ligands.map((part, i) => [i === 0 ? 'bond' : 'other', part]));
  const reference = hub.vectors.map(() => EMPTY);
  const kinds = Object.entries(pieces).flatMap(([kind, part]) => Array(part.count).fill(kind));
  const pairSites=hub.pairSites?.slice(0,spec.pairs)||hub.example.slice(kinds.length);
  pairSites.forEach(i=>{reference[i]=PAIR;});
  const bondSites=hub.example.filter(i=>!pairSites.includes(i));
  for(const kind of kinds){
    const part=pieces[kind];
    const site=bondSites.find(i=>reference[i]===EMPTY&&(!part.role||(hub.key==='tbp'?(i<3?'equatorial':'axial'):
      dot(unit(hub.vectors[i]),unit(hub.vectors[pairSites[0]]))<-.999?'axial':'equatorial')===part.role));
    reference[site]=kind;
  }
  return [id, {category:'Further comparisons',...spec, hub, pieces, reference, domains:kinds.length+spec.pairs}];
}));

export function partLabel(m, kind) {
  if (kind === PAIR) return 'Lone pair';
  if (kind === EMPTY) return 'Empty';
  const part = m.pieces[kind];
  return m.center + bondSymbol(part.order) + (part.group?.label||part.element)+(part.role?' · '+part.role:'');
}

export function netOptions(m) {
  return [['none',m.charge?'Bond arrows cancel':'Cancels · nonpolar'], ...[...new Set([m.center, ...m.ligands.map(p => p.element)])]
    .map(symbol => [symbol, 'Toward the ' + symbol + ' side'+(m.charge?' · bond sum':' · polar')])];
}

export function newBuild(m) {
  return {
    sites: m.hub.vectors.map(() => EMPTY), torsions:{}, bondSite:'', shape: '', dipole: '', domainAnswer: '', reason: '',
    angles: [], attempts: [], events: [], undo: [], step: 0, revision: 0, first: '', second: '', atoms: false, camera: null,
  };
}

export function counts(sites) {
  return {bonds: sites.filter(isBond).length, pairs: sites.filter(v => v === PAIR).length};
}

export function angle(directions, i, j) {
  return Math.acos(Math.max(-1, Math.min(1, directions[i].dot(directions[j])))) * 180 / Math.PI;
}

export function differentCameras(a, b) {
  if (!Array.isArray(a?.position) || !Array.isArray(b?.position)) return false;
  const direction = pose => pose.position.map((n, i) => n - (pose.target?.[i] ?? 0));
  const x = direction(a), y = direction(b), length = Math.hypot(...x) * Math.hypot(...y);
  if (!Number.isFinite(length) || length === 0) return false;
  return x.reduce((sum, n, i) => sum + n * y[i], 0) / length <= Math.cos(12 * Math.PI / 180);
}

export function evaluate(m, build, directions) {
  const sites = build.sites.flatMap((kind, i) => kind === EMPTY ? [] : [i]);
  const inventory = !assemblyProblem(m,build.sites) && Object.entries(m.pieces).every(([kind, part]) =>
    build.sites.filter(actual => actual === kind).length === part.count) &&
    counts(build.sites).pairs === m.pairs && sites.length === m.domains;
  const domains = Number(build.domainAnswer) === m.domains;
  const geometry = inventory && geometryMatches(m,build.sites,directions);
  const shape = build.shape === m.shape;
  const dipole = build.dipole === m.net;
  const pass = inventory && domains && geometry && shape && dipole;
  let message = [m.evidence, m.real, m.next].filter(Boolean).join(' ');
  if (!inventory) message = inventoryAdvice(m, build);
  else if (!domains) message = domainAdvice(m, Number(build.domainAnswer));
  else if (!geometry) message = geometryAdvice(m, build);
  else if (!shape) message = shapeAdvice(m, build.shape);
  else if (!dipole) message = dipoleAdvice(m, build.dipole);
  return {inventory, domains, geometry, shape, dipole, pass, message};
}

const quantity = (n, noun) => n + ' ' + noun + (n === 1 ? '' : 's');
const capital = text => text.charAt(0).toUpperCase() + text.slice(1);
const bondTotals = m => m.ligands.reduce((t, p) => ({
  atoms: t.atoms + p.count, used: t.used + p.count * p.order, pi: t.pi + p.count * (p.order - 1),
}), {atoms: 0, used: 0, pi: 0});

// Facts shown at Compare: electron geometry vs molecular shape, AP hybridization
// of the central atom and the sigma/pi bond count.
export function caseFacts(m) {
  const totals = bondTotals(m);
  return {
    electron: capital(m.hub.geometry), shape: m.shape, domains: m.domains, ideal: m.hub.degrees,
    hybrid: HYBRID[m.domains] || '', sigma: totals.atoms, pi: totals.pi,
  };
}

// Feedback after a checked attempt explains the reasoning behind the first
// criterion that does not match, aimed at the common VSEPR misconceptions.
function inventoryAdvice(m, build) {
  const notes = [];
  for (const [kind, part] of Object.entries(m.pieces)) {
    const placed = build.sites.filter(actual => actual === kind).length;
    if (placed === part.count) continue;
    notes.push('The Lewis structure of ' + m.formula + ' has ' + quantity(part.count, part.element + ' atom') + ' bonded to ' + m.center +
      ', so the hub needs ' + quantity(part.count, partLabel(m, kind) + ' bond piece') + '. You seated ' + placed + '.' +
      (part.order > 1 ? ' A multiple bond shares '+part.order+' pairs but is still one bond piece.' : ''));
  }
  const pairs = counts(build.sites).pairs;
  if (pairs !== m.pairs) {
    const valence = VALENCE[m.center], used = bondTotals(m).used, left = valence-(m.charge||0)-used;
    let note = m.center + ' has ' + valence + ' valence electrons. Its bonds use ' + used + ', leaving ' + left +
      ', so the hub carries ' + (m.pairs ? quantity(m.pairs, 'lone-pair piece') : 'no lone-pair piece') + '. You seated ' + pairs + '.';
    if(m.charge)note=m.center+' has '+valence+' valence electrons. Subtract '+m.charge+' for its positive formal charge, then '+used+' assigned to bonds: '+left+' nonbonding electrons, or '+m.pairs+' lone pair'+(m.pairs===1?'':'s')+'. You seated '+pairs+'.';
    if (pairs < m.pairs) note += ' With ' + pairs + ' on the hub, ' + m.center + ' would have a formal charge of +' + (valence-used-2*pairs) + ' instead of '+(m.charge?'+'+m.charge:'0')+'.';
    if (pairs > m.pairs) note += ' That needs more electrons than ' + m.center + ' has. The outer atoms’ lone pairs are already drawn as dots on each end piece; only the central atom’s own lone pairs go in hub sockets.';
    if (m.center === 'B') note += ' Boron is stable here with six electrons, an incomplete octet, and a formal charge of 0.';
    notes.push(note);
  }
  return notes.join(' ') || 'Compare each bond piece and each lone-pair piece on the hub with the Lewis structure. Count a double-bond piece once.';
}

function domainAdvice(m, answer) {
  const totals = bondTotals(m);
  if (m.pairs && answer === totals.atoms) return 'You counted only the bond pieces. Each lone-pair piece on the hub also fills a socket direction, so it counts as an electron domain too.';
  if (totals.pi && answer === m.domains + totals.pi) return 'A multiple-bond piece holds two or three shared pairs, but it fills one socket, so it counts as one domain.';
  if (answer > m.domains) return 'Count only the filled sockets on the hub. Lone pairs drawn on the end pieces belong to the outer atoms, and a multiple bond counts once.';
  return 'Count the filled sockets on the hub: each single, double or triple bond is one domain, and each lone-pair piece is one more. Atoms on an attached group are not additional neighbors of the hub.';
}

function geometryAdvice(m, build) {
  if(m.domains===5)return 'Use three equatorial directions at 120° and two opposite axial directions at 90° to the equatorial plane. Lone pairs must be equatorial, where they have only two 90° neighbors. Match any axial/equatorial connectors to their sites.';
  if(m.domains===6)return 'Use three pairs of opposite directions, with adjacent domains at 90°. For two lone pairs, choose opposite sites (180° apart), leaving four bonds in one square plane.';
  return 'Your pieces match the Lewis structure, but they are not spread evenly over the hub. ' + m.domains + ' domains get as far apart as possible at ' +
    m.hub.degrees + ', the ' + m.hub.geometry + ' electron geometry.' +
    (m.pairs ? ' Lone-pair pieces repel too: spread all ' + m.domains + ' pieces, not only the bond pieces.' : '') + ' Use the angle gauge to compare.';
}

function shapeAdvice(m, chosen) {
  const outer = m.ligands.map(p => p.element).join(' and ');
  if (m.pairs && chosen.toLowerCase() === m.hub.geometry) {
    return chosen + ' names the arrangement of all ' + m.domains + ' pieces on the hub, the electron geometry. Molecular shape names only where the atoms are. Switch on Atoms only to hide the lone-pair pieces and trace the atoms.';
  }
  if (m.domains===4 && m.pairs===1 && chosen === 'Trigonal planar') {
    return 'Three bonded atoms do not have to lie flat. The lone-pair piece on ' + m.center + ' fills the fourth tetrahedral socket and pushes the three ' + outer + ' atoms into a pyramid. Switch on Atoms only to see it.';
  }
  if (m.domains===4 && m.pairs===2 && chosen === 'Linear') {
    return 'Two bonded atoms do not have to lie in a line. The two lone-pair pieces on ' + m.center + ' fill two of the four tetrahedral sockets, so the bonds are bent.';
  }
  if (!m.pairs && chosen) {
    return 'The hub carries no lone-pair piece, so nothing pushes the ' + outer + ' atoms out of the ' + m.hub.geometry + ' arrangement. With no central lone pairs, the molecular shape has the same name as the electron geometry.';
  }
  return 'Switch on Atoms only and trace the atoms. Lone-pair pieces set the directions but are not part of the shape name.';
}

function dipoleAdvice(m, chosen) {
  if(m.charge||m.ligands.some(p=>p.group))return m.evidence;
  const EN = ELECTRONEGATIVITY;
  const bonds = m.ligands.map((p, i) => {
    const a = m.center, b = p.element, high = EN[a] > EN[b] ? a : b, low = high === a ? b : a;
    const label = partLabel(m, i === 0 ? 'bond' : 'other'), each = p.count > 1 ? 'each ' : 'the ';
    if (Math.abs(EN[a] - EN[b]) < 0.1) return a + ' and ' + b + ' have almost equal electronegativities (' + EN[a].toFixed(2) + ' and ' + EN[b].toFixed(2) + '), so ' + each + label + ' bond is nearly nonpolar';
    return high + ' (' + EN[high].toFixed(2) + ') is more electronegative than ' + low + ' (' + EN[low].toFixed(2) + '), so ' + each + label + ' arrow points toward ' + high;
  }).join('. ');
  if (m.net === 'none') {
    const polarBonds = m.ligands.some(p => p.arrow !== 0);
    return (polarBonds ? bonds + '. Polar bonds do not always make a polar molecule. ' +
      'In this symmetric arrangement the bond dipoles cancel, including the linear XeF₂ and square-planar XeF₄ models with central lone pairs.'
      : bonds + '. The two identical ends would cancel even if the bonds were polar.');
  }
  if (chosen === 'none') {
    return m.pairs ? bonds + '. The lone-pair pieces make the arrangement of atoms lopsided, so the bond arrows cannot cancel.'
      : bonds + '. Shape alone does not decide polarity. The ends differ, so the bond arrows cannot cancel.';
  }
  return bonds + '. Chemists draw each bond arrow toward the δ− end. Add the arrows head to tail to see which side their sum points toward.';
}
