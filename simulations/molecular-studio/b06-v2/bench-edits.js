import {
  ELEMENTS, V, atom, neighbors, environment, addAtom, connect, placePair,
  snapSites, domainDirections, rotateTo, bondLength,
} from './molecule-model.js';

function emptyGridPosition(graph, element) {
  if (graph.kind === 'ionic') {
    // Fill a compact patch of the work plane without moving ions already placed.
    // Positions illustrate the inventory; they do not prescribe a crystal structure.
    const extent = Math.ceil(Math.sqrt(graph.atoms.length)) + 1;
    const sites = [];
    for (let y = -extent; y <= extent; y++) {
      for (let x = -extent; x <= extent; x++) sites.push([x * 2.2, y * 2.2, 0]);
    }
    sites.sort((a, b) => Math.hypot(...a) - Math.hypot(...b) || Math.abs(a[1]) - Math.abs(b[1]));
    return sites.find(p => graph.atoms.every(a =>
      Math.hypot(...V.sub(p, a.position)) >= ELEMENTS[a.element].r + ELEMENTS[element].r + .12));
  }
  // Choose the first empty location in a compact grid. Users can reposition
  // each loose atom and join previously placed atoms in any order.
  const occupied = graph.atoms.map(a => a.position);
  const side = Math.ceil(Math.sqrt(4 * occupied.length + 1));
  let position = [0, 0, 0];
  outer: for (let y = 0; y <= side; y++) {
    for (let x = 0; x <= side; x++) {
      const proposed = [x * 2.6, y * 2.6, 0];
      if (occupied.every(p => Math.hypot(...V.sub(p, proposed)) >= 1.6)) {
        position = proposed;
        break outer;
      }
    }
  }
  return position;
}

export function placeLoose(graph, element, position = emptyGridPosition(graph, element)) {
  const id = addAtom(graph, element);
  Object.assign(atom(graph, id), {position, pairs: 0, pairDirections: []});
  return id;
}

export function attach(graph, selected, element, order) {
  const sites = snapSites(graph, selected, {kind:'atom', element, order});
  const site = sites.find(s => graph.atoms.every(a =>
    Math.hypot(...V.sub(s.position, a.position)) >= (ELEMENTS[a.element].r + ELEMENTS[element].r) * .65));
  if (!site) throw Error('No free ring fits this atom and bond order. Try another center, a lower order, or move a neighbor.');
  const id = addAtom(graph, element);
  Object.assign(atom(graph, id), {position:[...site.position], pairs:0, pairDirections:[]});
  connect(graph, selected, id, order);
  // Keep the growth center selected so equivalent neighbors can be added in sequence.
  return selected;
}

export function addPairAtSite(graph, id) {
  const site = snapSites(graph, id, {kind:'pair'})[0];
  if (!site) throw Error('No open lone-pair site on this atom. Check its bonds and valence electrons.');
  placePair(graph, id, site.direction);
  return id;
}

function branches(graph, center, roots) {
  const seen = new Set([center]), groups = [];
  for (const root of roots) {
    if (seen.has(root.id)) throw Error('Branches close a ring. Move ring atoms individually.');
    const group = [], pending = [root.id];
    while (pending.length) {
      const id = pending.pop();
      if (seen.has(id)) continue;
      seen.add(id);group.push(atom(graph,id));
      for (const n of neighbors(graph,id)) if (!seen.has(n.id)) pending.push(n.id);
    }
    groups.push(group);
  }
  return groups;
}

export function arrangeDomains(graph, id, count) {
  const center = atom(graph,id), env = environment(graph,id);
  if (!env || env.missing || !env.balanced) throw Error('Complete the bonds and lone pairs at the selection first.');
  if (![2,3,4,5,6].includes(count) || count !== env.domains) {
    throw Error(env.domains + ' domains at the selection (bonds + lone pairs). Choose the ' + env.domains + '-domain arrangement.');
  }
  if (!env.neighbors.length) throw Error('Select an atom with at least one bond.');
  const groups = branches(graph, id, env.neighbors);
  const ideal = domainDirections(count, env.pairs);
  const original = env.neighbors.map(n => V.sub(atom(graph,n.id).position,center.position));
  const anchor = original[0];
  const orient = p => rotateTo(p, ideal.bonds[0], anchor);
  const available = ideal.bonds.map(orient);
  center.pairDirections = ideal.pairs.map(orient);

  for (const [i, group] of groups.entries()) {
    const from = original[i], neighbor = env.neighbors[i];
    let best = 0;
    available.forEach((p,k) => { if (V.dot(p,from) > V.dot(available[best],from)) best=k; });
    const [to] = available.splice(best,1);
    const length = Math.hypot(...from) || bondLength(graph,id,neighbor.id,neighbor.order);
    const oldOrigin = [...atom(graph,neighbor.id).position];
    const newOrigin = V.add(center.position,V.mul(to,length));
    // Rotate the complete branch so already constructed neighboring centers
    // retain their bond angles and their lone-pair directions.
    for (const a of group) {
      a.position = V.add(newOrigin,rotateTo(V.sub(a.position,oldOrigin),from,to));
      a.pairDirections = (a.pairDirections || []).map(p=>rotateTo(p,from,to));
    }
  }
  return id;
}
