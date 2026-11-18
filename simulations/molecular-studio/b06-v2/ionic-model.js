import {bySymbol} from './periodic-elements.js';

// Shared graph limit, also exposed by molecule-model.js for existing callers.
export const MAX_ATOMS = 80;

// Classroom monatomic charges and simplest whole-number ratios (OpenStax,
// Chemistry 2e §2.6). This model counts ions; it does not predict stable phases.
// https://openstax.org/books/chemistry-2e/pages/2-6-ionic-and-molecular-compounds
const anions = {
  H: [-1, 'hydride'], C: [-4, 'carbide'], N: [-3, 'nitride'], P: [-3, 'phosphide'],
  O: [-2, 'oxide'], S: [-2, 'sulfide'], Se: [-2, 'selenide'],
  F: [-1, 'fluoride'], Cl: [-1, 'chloride'], Br: [-1, 'bromide'], I: [-1, 'iodide'],
};

export function ionFor(symbol) {
  const element = bySymbol.get(symbol);
  if (!element?.available) return null;
  if (element.family === 'alkali' || element.family === 'earth') {
    return {charge: element.group, name: element.name.toLowerCase()};
  }
  if (!Object.hasOwn(anions, symbol)) return null;
  const [charge, name] = anions[symbol];
  return {charge, name};
}

export function ionLabel(symbol, charge = ionFor(symbol)?.charge) {
  if (!charge) return symbol;
  const magnitude = ['', '', '²', '³', '⁴'][Math.abs(charge)];
  return symbol + magnitude + (charge > 0 ? '⁺' : '⁻');
}

// Restrict the single-carbon (methanide) model to Be₂C and Mg₂C. Other
// carbides can contain carbon groups, as in CaC₂. See doi:10.1039/C9RA01573F.
const methanideMetals = new Set(['Be', 'Mg']);
export function ionicPlacementIssue(graph, symbol, replacingId = null) {
  const ion = ionFor(symbol);
  if (!ion) return 'Choose an enabled metal or nonmetal from the ionic kit.';
  for (const part of graph.atoms) {
    if (part.id === replacingId || part.element === symbol) continue;
    const existing = ionFor(part.element);
    if (Math.sign(existing.charge) === Math.sign(ion.charge)) {
      return `This bench uses one metal and one nonmetal. Remove all ${ionLabel(part.element)} ions before adding ${ionLabel(symbol)}.`;
    }
    const cation = ion.charge > 0 ? symbol : part.element;
    if ((symbol === 'C' || part.element === 'C') && !methanideMetals.has(cation)) {
      return 'For single-carbon carbide (C⁴⁻), use Be²⁺ or Mg²⁺ on this bench.';
    }
  }
  return '';
}
export function checkIonAddition(graph, symbol, replacingId = null) {
  // On the transfer bench, loose neutral atoms enter freely. Compatibility
  // becomes relevant when a contact joins two particles or assemblies.
  if (graph.transfers && ionFor(symbol)) return;
  const issue = ionicPlacementIssue(graph, symbol, replacingId);
  if (issue) throw Error(issue);
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

function formulaPart(symbol, count) {
  return symbol + (count === 1 ? '' : String(count).replace(/\d/g, n => '₀₁₂₃₄₅₆₇₈₉'[n]));
}

// Every transferred electron is recorded once at the contact that moved it.
// Deriving both endpoint charges from that same record conserves net charge
// through edits, undo, and file reload. The fixed-charge bench has no ledger.
export function atomCharge(graph, id) {
  if (!graph.transfers) {
    const part = graph.atoms.find(a => a.id === id);
    return graph.kind === 'ionic' ? ionFor(part?.element)?.charge ?? 0 : 0;
  }
  let charge = 0;
  for (const transfer of graph.transfers) {
    if (transfer.donor === id) charge += transfer.electrons;
    if (transfer.acceptor === id) charge -= transfer.electrons;
  }
  return charge;
}

export function particleLabel(graph, id) {
  const part = graph.atoms.find(a => a.id === id);
  return part ? ionLabel(part.element, atomCharge(graph, id)) : '';
}

// Qualitative trends only. Fractions of the final display change give the Mg⁺
// bookkeeping stage an intermediate radius; these are not measured ionic radii.
export function chargeRadiusScale(symbol, charge) {
  const limit = ionFor(symbol)?.charge;
  if (!limit || !charge) return 1;
  const fraction = Math.min(1, Math.abs(charge / limit));
  return 1 + (charge < 0 ? .28 : -.26) * fraction;
}

function transferAdjacency(graph) {
  const adjacency = new Map(graph.atoms.map(a => [a.id, []]));
  for (const {donor, acceptor} of graph.transfers || []) {
    adjacency.get(donor).push(acceptor);
    adjacency.get(acceptor).push(donor);
  }
  return adjacency;
}

export function clusterIds(graph, id) {
  return connectedIds(transferAdjacency(graph), id);
}

function connectedIds(adjacency, id) {
  const ids = new Set();
  if (!adjacency.has(id)) return ids;
  const pending = [id];
  while (pending.length) {
    const current = pending.pop();
    if (ids.has(current)) continue;
    ids.add(current);
    pending.push(...adjacency.get(current));
  }
  return ids;
}

export function transferCapacity(graph, sourceId, element, targetId) {
  if (!graph.transfers || sourceId === targetId) return 0;
  const target = graph.atoms.find(a => a.id === targetId);
  const sourceLimit = ionFor(element)?.charge, targetLimit = ionFor(target?.element)?.charge;
  if (!sourceLimit || !targetLimit || Math.sign(sourceLimit) === Math.sign(targetLimit)) return 0;
  const electrons = Math.min(Math.abs(sourceLimit - atomCharge(graph, sourceId)), Math.abs(targetLimit - atomCharge(graph, targetId)));
  if (!electrons) return 0;
  if (sourceId == null && graph.atoms.length >= MAX_ATOMS) return 0;
  if (sourceId != null && !graph.atoms.some(a => a.id === sourceId && a.element === element)) return 0;
  const targetGroup = clusterIds(graph,targetId);
  if (targetGroup.has(sourceId)) return 0;
  const sourceGroup = sourceId == null ? new Set() : clusterIds(graph,sourceId);
  const metal = sourceLimit > 0 ? element : target.element;
  const nonmetal = sourceLimit < 0 ? element : target.element;
  if (nonmetal === 'C' && !methanideMetals.has(metal)) return 0;
  if (graph.atoms.some(a => (sourceGroup.has(a.id) || targetGroup.has(a.id)) &&
      a.element !== metal && a.element !== nonmetal)) return 0;
  return electrons;
}

export function addTransfer(graph, sourceId, targetId) {
  const source = graph.atoms.find(a => a.id === sourceId);
  const electrons = source && transferCapacity(graph, sourceId, source.element, targetId);
  if (!electrons) throw Error('Bring an available metal and nonmetal together to transfer electrons.');
  const giving = ionFor(source.element).charge > 0;
  const transfer = {donor: giving ? sourceId : targetId, acceptor: giving ? targetId : sourceId, electrons};
  graph.transfers.push(transfer);
  return transfer;
}

export function transferSummary(graph) {
  const adjacency = transferAdjacency(graph), remaining = new Set(adjacency.keys());
  const compounds = new Map();
  let units = 0, finishedAtoms = 0;
  while (remaining.size) {
    const ids = connectedIds(adjacency, remaining.values().next().value);
    for (const id of ids) remaining.delete(id);
    const atoms = graph.atoms.filter(part => ids.has(part.id));
    if (!atoms.every(a => atomCharge(graph, a.id) === ionFor(a.element).charge)) continue;
    const mixture = ionicComposition({atoms});
    compounds.set(mixture.formula,mixture.name);
    units += mixture.units;
    finishedAtoms += atoms.length;
  }
  const electronsTransferred = graph.transfers.reduce((sum, t) => sum + t.electrons, 0);
  const complete = units > 0 && finishedAtoms === graph.atoms.length;
  const formula = [...compounds.keys()].join(' + '), name = [...compounds.values()].join(' and ');
  const netCharge = graph.atoms.reduce((sum, a) => sum + atomCharge(graph, a.id), 0);
  let advice = 'Bring a metal and a nonmetal together to transfer electrons.';
  if (!graph.atoms.length) advice = 'Place a neutral metal atom and a neutral nonmetal atom.';
  else if (complete && compounds.size > 1) advice = `${formula} complete. ${units} formula units in total.`;
  else if (complete) advice = `${units} formula unit${units === 1 ? '' : 's'} of ${formula} complete.`;
  else if (units) advice = `${formula} complete. Other atoms still need a partner.`;
  else if (electronsTransferred) {
    const pending = graph.atoms.find(a => atomCharge(graph, a.id) && atomCharge(graph, a.id) !== ionFor(a.element).charge);
    if (pending) {
      const needed = ionFor(pending.element).charge - atomCharge(graph, pending.id);
      advice = `${particleLabel(graph, pending.id)} can ${needed > 0 ? 'give' : 'accept'} ${Math.abs(needed)} more electron${Math.abs(needed) === 1 ? '' : 's'}.`;
    }
  }
  return {formula, name, units, complete, netCharge, electronsTransferred, advice};
}

export function ionicComposition(graph) {
  if (graph.transfers) return transferSummary(graph);
  let cation = null, anion = null, cationCount = 0, anionCount = 0, netCharge = 0;
  for (const part of graph.atoms) {
    const ion = ionFor(part.element);
    if (!ion) throw Error('This bench requires supported monatomic ions.');
    if (ion.charge > 0) {
      cation = part.element;
      cationCount++;
    } else {
      anion = part.element;
      anionCount++;
    }
    netCharge += ion.charge;
  }
  let formula = '', name = '', units = 0, advice = 'Place a metal ion or a nonmetal ion to begin.';
  if (cation && anion) {
    const metal = ionFor(cation), nonmetal = ionFor(anion);
    const divisor = gcd(metal.charge, -nonmetal.charge);
    const metalsPerUnit = -nonmetal.charge / divisor, nonmetalsPerUnit = metal.charge / divisor;
    formula = formulaPart(cation, metalsPerUnit) + formulaPart(anion, nonmetalsPerUnit);
    name = metal.name + ' ' + nonmetal.name;
    if (netCharge === 0) {
      units = cationCount / metalsPerUnit;
      advice = `Charge balanced. ${units} formula unit${units === 1 ? '' : 's'} of ${formula}.`;
    } else {
      const nextUnits = Math.ceil(Math.max(cationCount / metalsPerUnit, anionCount / nonmetalsPerUnit));
      const targetUnits = Math.min(nextUnits, Math.floor(MAX_ATOMS / (metalsPerUnit + nonmetalsPerUnit)));
      const changes = [[cation, targetUnits * metalsPerUnit - cationCount], [anion, targetUnits * nonmetalsPerUnit - anionCount]];
      const describeChange = ([symbol, count]) => `${Math.abs(count)} ${ionLabel(symbol)}`;
      const remove = changes.filter(([,count]) => count < 0).map(describeChange);
      const add = changes.filter(([,count]) => count > 0).map(describeChange);
      const steps = [];
      if (remove.length) steps.push('Remove ' + remove.join(' and '));
      if (add.length) steps.push((steps.length ? 'add ' : 'Add ') + add.join(' and '));
      advice = steps.join(', then ') + ' to balance the charge.';
    }
  } else if (cation) {
    advice = 'Add a nonmetal ion to balance the positive charge.';
  } else if (anion) {
    advice = anion === 'C' ? 'Add Be²⁺ or Mg²⁺ to balance the carbide charge.' : 'Add a metal ion to balance the negative charge.';
  }
  if ((!anion || !cation) && graph.atoms.length === MAX_ATOMS) {
    advice = 'Remove some ions to make space. ' + advice;
  }
  return {cation, anion, cationCount, anionCount, netCharge, formula, units, name, advice};
}
