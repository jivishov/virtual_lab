export {LEWIS_SPECIES} from './structure-examples.js';

const VALENCE = Object.freeze({H: 1, C: 4, N: 5, O: 6, F: 7, Si: 4, P: 5, S: 6, Cl: 7});
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const integerIn = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
export const copyDrawing = drawing => structuredClone(drawing);
export const LEWIS_CHECKS = Object.freeze({
  formula: 'Atom inventory', skeleton: 'Connections', bonds: 'Shared electron pairs',
  electrons: 'Valence electron budget', pairs: 'Nonbonding pairs',
  shells: 'Electrons around each atom', charges: 'Formal charge and net charge'
});

export function blankDrawing() {
  return {version: 1, atoms: [], bonds: [], brackets: false, ionCharge: 0};
}

export function normalizeDrawing(raw) {
  if (raw?.version !== 1 || !Array.isArray(raw.atoms) || !Array.isArray(raw.bonds) ||
      raw.atoms.length > 40 || raw.bonds.length > 80 || typeof raw.brackets !== 'boolean' ||
      !integerIn(raw.ionCharge, -4, 4)) return null;

  const atoms = [], bonds = [], ids = new Set(), edges = new Set();
  for (const atom of raw.atoms) {
    if (!atom || typeof atom.id !== 'string' || !/^[A-Za-z0-9_-]{1,24}$/.test(atom.id) || ids.has(atom.id) ||
        typeof atom.element !== 'string' || !Object.hasOwn(VALENCE, atom.element) || !integerIn(atom.lonePairs, 0, 6) ||
        !integerIn(atom.charge, -4, 4) || !Number.isFinite(atom.x) || !Number.isFinite(atom.y)) return null;
    ids.add(atom.id);
    atoms.push({id: atom.id, element: atom.element, x: clamp(atom.x, .05, .95), y: clamp(atom.y, .12, .88),
      lonePairs: atom.lonePairs, charge: atom.charge});
  }
  for (const bond of raw.bonds) {
    if (!bond || !ids.has(bond.a) || !ids.has(bond.b) || bond.a === bond.b || !integerIn(bond.order, 1, 3)) return null;
    const key = [bond.a, bond.b].sort().join(':');
    if (edges.has(key)) return null;
    edges.add(key);
    bonds.push({a: bond.a, b: bond.b, order: bond.order});
  }
  return {version: 1, atoms, bonds, brackets: raw.brackets, ionCharge: raw.ionCharge};
}

export function atomAudits(drawing) {
  const counts = new Map();
  return drawing.atoms.map(atom => {
    const index = (counts.get(atom.element) || 0) + 1;
    counts.set(atom.element, index);
    const bondOrder = drawing.bonds.reduce((sum, bond) =>
      sum + (bond.a === atom.id || bond.b === atom.id ? bond.order : 0), 0);
    return {...atom, label: atom.element + index, bondOrder,
      electrons: 2 * (bondOrder + atom.lonePairs),
      calculatedCharge: VALENCE[atom.element] - 2 * atom.lonePairs - bondOrder};
  });
}

export function electronCount(drawing) {
  return 2 * (drawing.bonds.reduce((sum, bond) => sum + bond.order, 0) +
              drawing.atoms.reduce((sum, atom) => sum + atom.lonePairs, 0));
}

function inventory(drawing) {
  return drawing.atoms.map(atom => atom.element).sort().join(',');
}

function adjacency(drawing) {
  const neighbors = new Map(drawing.atoms.map(atom => [atom.id, new Map()]));
  for (const {a, b, order} of drawing.bonds) {
    neighbors.get(a).set(b, order);
    neighbors.get(b).set(a, order);
  }
  return neighbors;
}

// Match labels and undirected edges under one consistent bijection. Creation
// order, screen positions and names assigned to equivalent atoms are immaterial.
function graphMatches(drawing, reference, {orders = false, pairs = false} = {}) {
  if (drawing.bonds.length !== reference.bonds.length || inventory(drawing) !== inventory(reference)) return false;
  const drawnEdges = adjacency(drawing), referenceEdges = adjacency(reference);
  const candidates = new Map(drawing.atoms.map(atom => [
    atom.id, reference.atoms.filter(other => other.element === atom.element &&
      drawnEdges.get(atom.id).size === referenceEdges.get(other.id).size && (!pairs || atom.lonePairs === other.lonePairs))
  ]));
  const atoms = [...drawing.atoms].sort((a, b) => candidates.get(a.id).length - candidates.get(b.id).length);
  const assigned = new Map();
  const used = new Set();

  function match(index) {
    if (index === atoms.length) return true;
    const id = atoms[index].id;
    for (const other of candidates.get(id)) {
      if (used.has(other.id)) continue;
      let compatible = true;
      for (const [drawnId, referenceId] of assigned) {
        const left = drawnEdges.get(id).get(drawnId) || 0;
        const right = referenceEdges.get(other.id).get(referenceId) || 0;
        if (Boolean(left) !== Boolean(right) || (orders && left !== right)) {
          compatible = false;
          break;
        }
      }
      if (!compatible) continue;
      assigned.set(id, other.id);
      used.add(other.id);
      if (match(index + 1)) return true;
      assigned.delete(id);
      used.delete(other.id);
    }
    return false;
  }
  return match(0);
}

export function evaluateLewis(raw, species) {
  const drawing = normalizeDrawing(raw);
  if (!drawing || !species) return {valid: false, correct: false, criteria: [], atoms: [], message: 'This diagram could not be read.'};
  const atoms = atomAudits(drawing);
  const used = electronCount(drawing);
  const expected = species.graph.atoms.reduce((sum, atom) => sum + VALENCE[atom.element], 0) - species.charge;
  const formula = inventory(drawing) === inventory(species.graph);
  const skeleton = formula && graphMatches(drawing, species.graph);
  const bonds = skeleton && graphMatches(drawing, species.graph, {orders: true});
  const pairs = skeleton && graphMatches(drawing, species.graph, {orders: bonds, pairs: true});
  const targetShell = atom => atom.element === 'H' ? 2 : 8;
  const openShell = atoms.find(atom => atom.electrons !== targetShell(atom));
  const wrongCharge = atoms.find(atom => atom.charge !== atom.calculatedCharge);
  const net = atoms.reduce((sum, atom) => sum + atom.calculatedCharge, 0);
  const charges = formula && !wrongCharge && net === species.charge && drawing.ionCharge === species.charge &&
    Boolean(drawing.brackets) === (species.charge !== 0);
  const budget = `${species.formula} has ${expected} valence electrons available. You have placed ${used}. Count a shared pair only once in this budget.`;
  const chargeFeedback = wrongCharge
    ? `${wrongCharge.label} has ${wrongCharge.lonePairs * 2} nonbonding electrons and a bond-order sum of ${wrongCharge.bondOrder}. Subtract both from its ${VALENCE[wrongCharge.element]} valence electrons.`
    : `The formal charges in this drawing add to ${net}. The formula calls for a net charge of ${species.charge}. Match the overall selector to the formula and put brackets around an ion.` +
      (species.charge === 0 && drawing.brackets ? ' A neutral molecule takes no brackets.' : '');
  const check = (id, ok, feedback) => ({id, ok, label: LEWIS_CHECKS[id], feedback});
  const criteria = [
    check('formula', formula, `Compare the number of atoms of each element with ${species.formula}.`),
    check('skeleton', skeleton, 'Follow the connections one atom at a time. Moving an atom across the board leaves its bonds attached.'),
    check('bonds', bonds, 'Try changing the number of shared pairs between a pair of bonded atoms. Recheck the shell counts after each change.'),
    check('electrons', used === expected, budget),
    check('pairs', pairs, 'Select each atom and account for the pairs that lie entirely on that atom, including the terminal atoms.'),
    check('shells', formula && !openShell, openShell
      ? `${openShell.label} currently counts ${openShell.electrons} electrons around it. Its shell calls for ${targetShell(openShell)} in this structure.`
      : 'Complete the atom inventory before comparing the shells.'),
    check('charges', charges, chargeFeedback)
  ];
  return {valid: true, correct: criteria.every(entry => entry.ok),
    passed: criteria.filter(entry => entry.ok).length, total: criteria.length, criteria, atoms, used, expected};
}
