import {escapeHTML as esc, mountPointerDrag} from './direct-controls.js';
import {LEWIS_SPECIES, LEWIS_CHECKS, blankDrawing, normalizeDrawing, copyDrawing, atomAudits, electronCount, evaluateLewis} from './lewis-chemistry.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const edgeKey = bond => [bond.a, bond.b].sort().join(':');
const bondNames = ['', 'single', 'double', 'triple'];
const sign = number => number > 0 ? '+' + number : String(number).replace('-', '−');
const chargeLabel = number => number ? (Math.abs(number) === 1 ? '' : Math.abs(number)) + (number > 0 ? '+' : '−') : '0';
const position = (atom, w, h) => ({x: clamp(atom.x * w, 40, w - 40), y: clamp(atom.y * h, 40, h - 40)});

function pairAngles(atom, drawing, width, height) {
  const center = position(atom, width, height);
  const occupied = drawing.bonds.filter(bond => bond.a === atom.id || bond.b === atom.id).map(bond => {
    const id = bond.a === atom.id ? bond.b : bond.a;
    const end = position(drawing.atoms.find(item => item.id === id), width, height);
    return Math.atan2(end.y - center.y, end.x - center.x) * 180 / Math.PI;
  });
  if (atom.charge) occupied.push(-45);
  const choices = [-90, 0, 90, 180, -45, 45, 135, -135], selected = [];
  for (let i = 0; i < atom.lonePairs; i++) {
    const gap = angle => Math.min(180, ...[...occupied, ...selected].map(other => Math.abs(((angle - other + 540) % 360) - 180)));
    const available = choices.filter(angle => !selected.includes(angle));
    available.sort((a, b) => gap(b) - gap(a));
    selected.push(available[0]);
  }
  return selected;
}

export function diagramMarkup(drawing, {width = 800, height = 260, selected, bondFrom, interactive = true} = {}) {
  const atoms = atomAudits(drawing), byId = new Map(atoms.map(atom => [atom.id, atom]));
  let html = '';
  if (drawing.brackets) {
    html += `<path class="lewis-bracket" d="M22 20 H12 V${height - 20} H22 M${width - 35} 20 H${width - 25} V${height - 20} H${width - 35}"/>
      <text class="lewis-charge-text" x="${width - 22}" y="23">${chargeLabel(drawing.ionCharge)}</text>`;
  }
  for (const bond of drawing.bonds) {
    const a = position(byId.get(bond.a), width, height), b = position(byId.get(bond.b), width, height);
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
    const ux = dx / length, uy = dy / length, inset = Math.min(19, length / 2);
    const key = edgeKey(bond), label = `${byId.get(bond.a).label} to ${byId.get(bond.b).label}, ${bondNames[bond.order]} bond`;
    const attributes = interactive ? ` data-bond="${esc(key)}" tabindex="0" role="button" aria-label="${esc(label)}" data-selected="${selected?.kind === 'bond' && selected.key === key}"` : '';
    html += `<g${attributes}>`;
    if (interactive) {
      html += `<rect class="lewis-bond-target" x="${inset}" y="-10" width="${Math.max(1, length - 2 * inset)}" height="20" transform="translate(${a.x} ${a.y}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})"/>`;
    }
    for (let line = 0; line < bond.order; line++) {
      const offset = (line - (bond.order - 1) / 2) * 5;
      html += `<line class="lewis-bond-line" x1="${a.x + ux * inset - uy * offset}" y1="${a.y + uy * inset + ux * offset}" x2="${b.x - ux * inset - uy * offset}" y2="${b.y - uy * inset + ux * offset}"/>`;
    }
    html += '</g>';
  }
  for (const atom of atoms) {
    const p = position(atom, width, height);
    const selectedAtom = (selected?.kind === 'atom' && selected.id === atom.id) || bondFrom === atom.id;
    const label = `${atom.label}, ${atom.lonePairs} lone pairs, formal charge ${sign(atom.charge)}`;
    const attributes = interactive ? ` data-atom="${esc(atom.id)}" tabindex="0" role="button" aria-label="${esc(label)}" data-selected="${selectedAtom}"` : '';
    html += `<g${attributes} transform="translate(${p.x} ${p.y})"><circle class="lewis-atom-halo" r="${atom.element.length > 1 ? 21 : 18}"/>
      <text class="lewis-atom-text" text-anchor="middle" dominant-baseline="central">${esc(atom.element)}</text>`;
    if (atom.charge) html += `<text class="lewis-charge-text" x="22" y="-22">${chargeLabel(atom.charge)}</text>`;
    for (const angle of pairAngles(atom, drawing, width, height)) {
      const r = angle * Math.PI / 180, x = Math.cos(r) * 30, y = Math.sin(r) * 30;
      const tx = -Math.sin(r) * 3.4, ty = Math.cos(r) * 3.4;
      html += `<circle class="lewis-pair-dot" cx="${x + tx}" cy="${y + ty}" r="2.2"/><circle class="lewis-pair-dot" cx="${x - tx}" cy="${y - ty}" r="2.2"/>`;
    }
    html += '</g>';
  }
  if (!atoms.length) html += `<text class="lewis-empty" x="${width / 2}" y="${height / 2}" text-anchor="middle">Add an atom to begin.</text>`;
  return html;
}

function drawingSvg(drawing, species) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 300" width="800" height="300" role="img">
    <title>Lewis drawing of ${esc(species.formula)}</title><metadata>${esc(JSON.stringify(drawing))}</metadata>
    <style>.lewis-atom-halo{fill:white}.lewis-atom-text{font:600 21px system-ui}.lewis-charge-text{font:600 13px system-ui}.lewis-bracket{stroke:#173142;fill:none;stroke-width:2}.lewis-bond-line{stroke:#173142;stroke-width:2.3}</style>
    <rect width="800" height="300" fill="white"/>${diagramMarkup(drawing, {width: 800, height: 300, interactive: false})}</svg>`;
}

const icons = {
  move: '<path d="M8 1v14M1 8h14M5 4l3-3 3 3M5 12l3 3 3-3M4 5L1 8l3 3M12 5l3 3-3 3"/>',
  undo: '<path d="M6 3L2 7l4 4M2 7h7a4 4 0 0 1 0 8"/>',
  redo: '<path d="M10 3l4 4-4 4M14 7H7a4 4 0 0 0 0 8"/>',
  reset: '<path d="M2 2v5h5M2 7a6 6 0 1 1 1 6"/>',
  delete: '<path d="M2 4h12M6 4V2h4v2M4 4l1 11h6l1-11M7 7v5M9 7v5"/>',
  svg: '<path d="M8 1v9M5 7l3 3 3-3M2 11v4h12v-4"/>'
};
function iconButton(action, label) {
  return `<button type="button" data-action="${action}" class="lewis-icon" title="${label}" aria-label="${label}">
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icons[action]}</svg></button>`;
}

function reviewMarkup(result) {
  if (!result) return `<ul class="lewis-check-list">${Object.values(LEWIS_CHECKS).map(label => `<li>${label}</li>`).join('')}</ul>`;
  if (!result.valid) return `<p>${esc(result.message)}</p>`;
  const firstMiss = result.criteria.find(item => !item.ok);
  const rows = result.atoms.map(atom =>
    `<tr><th scope="row">${esc(atom.label)}</th><td>${atom.electrons}</td><td>${sign(atom.calculatedCharge)}</td><td>${sign(atom.charge)}</td></tr>`).join('');
  return `<p class="lewis-outcome"><strong>${result.correct ? 'Structure complete' : 'Review your drawing'}</strong> · ${result.passed} of ${result.total} checks met</p>
    <ul class="lewis-check-list">${result.criteria.map(item => item.ok
      ? `<li class="lewis-pass"><span aria-label="Met">✓</span> ${esc(item.label)}</li>`
      : `<li class="lewis-revise"><details ${item === firstMiss ? 'open' : ''}><summary>Revise · ${esc(item.label)}</summary><p>${esc(item.feedback)}</p></details></li>`).join('')}</ul>
    <details class="lewis-atom-audit"><summary>Inspect the electron counts</summary>
      <table><caption class="sr-only">Electrons surrounding each atom and calculated versus entered formal charge</caption>
      <thead><tr><th>Atom</th><th>Around atom</th><th>Calculated charge</th><th>Entered charge</th></tr></thead><tbody>${rows}</tbody></table></details>`;
}

export function mountLewisPad(root, {species, value, checked = false, onChange, onCheck}) {
  const spec = LEWIS_SPECIES[species], saved = normalizeDrawing(value);
  let drawing = saved || blankDrawing();
  let result = checked && saved ? evaluateLewis(drawing, spec) : null, renderedResult;
  let selected = null, bondFrom = null, tool = 'move', order = 1;
  let drag = null, swallowClick = false;
  const undo = [], redo = [], controller = new AbortController();
  const listen = (node, name, handler) => node.addEventListener(name, handler, {signal: controller.signal});
  const charges = Array.from({length: 9}, (_, index) => index - 4).map(n => `<option value="${n}">${sign(n)}</option>`).join('');
  const elements = [...new Set(spec.graph.atoms.map(atom => atom.element))];
  root.className = 'lewis-pad';
  root.innerHTML = `<div class="lewis-toolbar"><div class="lewis-tools-scroll">
    <div class="lewis-control-group" role="group" aria-label="Add atoms"><span>Atoms</span>${elements.map(element =>
      `<button type="button" class="lewis-element direct-token" data-add="${element}" title="Add or drag ${element}" aria-label="Add ${element} atom">${element}</button>`).join('')}</div>
    <div class="lewis-control-group" role="group" aria-label="Drawing tools">${iconButton('move', 'Select or move')}
      ${[1,2,3].map(n => `<button type="button" data-order="${n}" title="${bondNames[n]} bond" aria-label="${bondNames[n]} bond">${['','—','=','≡'][n]}</button>`).join('')}</div>
    <div class="lewis-control-group" role="group" aria-label="Drawing history">${iconButton('undo', 'Undo')}${iconButton('redo', 'Redo')}${iconButton('reset', 'Clear drawing')}</div>
    <div class="lewis-inspector"><strong class="lewis-selected">Select an atom</strong><div class="lewis-pair-tools" role="group" aria-label="Lone pairs on selected atom"><span>Lone pairs</span>
      ${Array.from({length: 7}, (_, n) => `<button type="button" data-pairs="${n}" aria-label="${n} lone pairs">${n}</button>`).join('')}</div>
      <label>Formal charge <select data-charge data-choice="segment">${charges}</select></label>${iconButton('delete', 'Delete selected atom or bond')}</div></div>
    <div class="lewis-check-actions">${iconButton('svg', 'Download drawing as SVG')}<button type="button" class="check-button" data-action="check">Check drawing</button></div></div>
    <div class="lewis-workarea"><section class="lewis-drawing-pane" aria-label="Edit Lewis drawing">
      <p class="lewis-instructions">Add or drag atoms onto the board. Choose a bond order, then select two atoms to join them. Select an atom to edit its lone pairs and formal charge.</p>
      <div class="lewis-board-wrap"><svg class="lewis-board" role="group" aria-label="Lewis drawing of ${esc(spec.formula)}" aria-describedby="lewis-help"></svg></div>
      <div class="lewis-footer"><div class="lewis-ion-controls"><label><input type="checkbox" data-brackets> Ion brackets</label>
        <label>Overall charge <select data-net data-choice="segment">${charges}</select></label></div><output class="lewis-electrons"></output></div>
      <details class="lewis-help" id="lewis-help"><summary>Drawing and keyboard controls</summary>
        <p>In move mode, drag an atom or focus it and press an arrow key. Hold Shift for a larger keyboard step or Alt for free dragging. With a bond order selected, dropping a new atom onto an existing atom connects them.</p>
        <p>Tab reaches each bond and atom. Press Enter or Space to select it. The selected bond can take a new order when you activate it with a bond tool. Delete removes a focused item, and Escape ends a pending bond. Undo also restores a cleared drawing.</p>
        <p>Each case asks for one closed-shell Lewis structure with minimal formal charges. Equivalent atom orderings and drawing orientations receive the same checks.</p></details></section>
      <aside class="lewis-assessment" aria-label="Structure checks"><h2>Structure checks</h2><div class="lewis-result" aria-live="polite"></div></aside></div>
    <p class="lewis-status" role="status"></p>`;

  const q = selector => root.querySelector(selector), board = q('.lewis-board'), review = q('.lewis-result');
  // Presentation only: the existing controls keep their nodes and delegated events.
  const panel = q('.lewis-assessment');
  panel.classList.add('side-panel');
  const scroll = document.createElement('div');
  scroll.className = 'pad-scroll';
  q('.lewis-check-actions').prepend(q('[aria-label="Drawing history"]'));
  scroll.append(q('.lewis-tools-scroll'), q('.lewis-ion-controls'), ...panel.childNodes);
  panel.append(scroll, q('.lewis-check-actions'));
  q('.lewis-toolbar').remove();
  const announce = text => {q('.lewis-status').textContent = text;};
  const size = () => {
    const rect = board.getBoundingClientRect();
    return {width: rect.width || 650, height: rect.height || 260};
  };
  const selectedAtom = () => selected?.kind === 'atom' && drawing.atoms.find(atom => atom.id === selected.id);
  function paintBoard(focus) {
    const {width, height} = size();
    board.setAttribute('viewBox', `0 0 ${width} ${height}`);
    board.dataset.tool = tool;
    board.innerHTML = diagramMarkup(drawing, {width, height, selected, bondFrom});
    if (focus) {
      const node = focus.kind === 'atom' ? board.querySelector(`[data-atom="${focus.id}"]`) : board.querySelector(`[data-bond="${focus.key}"]`);
      node?.focus({preventScroll: true});
    }
  }
  function paint(focus) {
    const atom = selectedAtom();
    q('.lewis-selected').textContent = atom ? atomAudits(drawing).find(item => item.id === atom.id).label
      : selected?.kind === 'bond' ? 'Selected bond' : 'Select an atom';
    for (const button of root.querySelectorAll('[data-pairs]')) {
      button.disabled = !atom;
      button.setAttribute('aria-pressed', String(atom?.lonePairs === Number(button.dataset.pairs)));
    }
    q('[data-charge]').disabled = !atom;
    q('[data-charge]').value = atom?.charge || 0;
    q('[data-net]').value = drawing.ionCharge;
    q('[data-brackets]').checked = drawing.brackets;
    q('[data-action="delete"]').disabled = !selected;
    q('[data-action="undo"]').disabled = !undo.length;
    q('[data-action="redo"]').disabled = !redo.length;
    q('[data-action="check"]').disabled = q('[data-action="svg"]').disabled = !drawing.atoms.length;
    q('[data-action="move"]').setAttribute('aria-pressed', String(tool === 'move'));
    root.querySelectorAll('[data-order]').forEach(button =>
      button.setAttribute('aria-pressed', String(tool === 'bond' && order === Number(button.dataset.order))));
    q('.lewis-electrons').textContent = `${electronCount(drawing)} electrons placed`;
    if (renderedResult !== result) {review.innerHTML = reviewMarkup(result); renderedResult = result;}
    paintBoard(focus);
  }
  function record(before, focus) {
    if (JSON.stringify(drawing) !== before) {
      undo.push(before);
      if (undo.length > 60) undo.shift();
      redo.length = 0;
      result = null;
      onChange(copyDrawing(drawing));
    }
    paint(focus);
  }
  function edit(mutate, focus) {
    const before = JSON.stringify(drawing);
    mutate();
    record(before, focus);
  }
  function clearSelection() {selected = null; bondFrom = null;}
  function history(back) {
    const from = back ? undo : redo, to = back ? redo : undo;
    if (!from.length) return;
    to.push(JSON.stringify(drawing));
    drawing = JSON.parse(from.pop());
    clearSelection();
    result = null;
    onChange(copyDrawing(drawing));
    paint();
    announce(back ? 'Previous drawing restored.' : 'Change reapplied.');
  }
  function fittingPoint(x, y) {return {x: clamp(x, .05, .95), y: clamp(y, .12, .88)};}
  function spaceAt(point, width, height) {
    const p = position(point, width, height);
    return Math.min(Infinity, ...drawing.atoms.map(atom => {
      const a = position(atom, width, height);
      return Math.hypot(p.x - a.x, p.y - a.y);
    }));
  }
  function addAtom(element, point, attach) {
    if (drawing.atoms.length >= 40 || attach && drawing.bonds.length >= 80) {
      announce('This drawing is full. Remove an atom or a bond before adding another.');
      return;
    }
    const {width, height} = size();
    if (!point) {
      const candidates = [.50, .23, .77].flatMap(y => [.50, .23, .77, .12, .88, .37, .63].map(x => ({x, y})));
      point = candidates.find(p => spaceAt(p, width, height) > 76) || candidates.sort((a, b) => spaceAt(b, width, height) - spaceAt(a, width, height))[0];
    }
    const ids = new Set(drawing.atoms.map(atom => atom.id));
    let index = 1;
    while (ids.has(`a${index}`)) index++;
    const id = `a${index}`;
    edit(() => {
      drawing.atoms.push({id, element, ...point, lonePairs: 0, charge: 0});
      if (attach) drawing.bonds.push({a: attach, b: id, order});
      selected = {kind: 'atom', id}; bondFrom = null; tool = 'move';
    });
    announce(`${element} added and selected.`);
  }
  function chooseAtom(id) {
    selected = {kind: 'atom', id};
    if (tool === 'move') {paint(selected); return;}
    if (!bondFrom) {bondFrom = id; paint(selected); announce('Choose the other end of the bond.'); return;}
    if (bondFrom === id) {bondFrom = null; paint(selected); announce('Bond selection cleared.'); return;}
    const existing = drawing.bonds.find(bond => edgeKey(bond) === [bondFrom, id].sort().join(':'));
    if (!existing && drawing.bonds.length >= 80) {announce('Remove a bond before adding another.'); return;}
    edit(() => {
      if (existing) existing.order = order;
      else drawing.bonds.push({a: bondFrom, b: id, order});
      bondFrom = null;
    }, selected);
    announce(`${bondNames[order]} bond placed.`);
  }
  function chooseBond(key) {
    selected = {kind: 'bond', key};
    bondFrom = null;
    if (tool === 'bond') edit(() => {drawing.bonds.find(bond => edgeKey(bond) === key).order = order;}, selected);
    else paint(selected);
  }
  function removeSelected() {
    if (!selected) return;
    edit(() => {
      if (selected.kind === 'bond') drawing.bonds = drawing.bonds.filter(bond => edgeKey(bond) !== selected.key);
      else {
        drawing.atoms = drawing.atoms.filter(atom => atom.id !== selected.id);
        drawing.bonds = drawing.bonds.filter(bond => bond.a !== selected.id && bond.b !== selected.id);
      }
      clearSelection();
    });
    announce('Selection removed. Undo restores it.');
  }
  function useMove() {
    tool = 'move'; bondFrom = null; paint(); announce('Select an atom or bond to edit it.');
  }
  const actions = {
    move: useMove, delete: removeSelected, undo: () => history(true), redo: () => history(false),
    reset: () => {edit(() => {drawing = blankDrawing(); clearSelection(); tool = 'move';}); announce('Drawing cleared. Undo restores it.');},
    check: () => {
      result = evaluateLewis(drawing, spec);
      paint();
      onCheck(copyDrawing(drawing), result);
    },
    svg: () => {
      const url = URL.createObjectURL(new Blob([drawingSvg(drawing, spec)], {type: 'image/svg+xml;charset=utf-8'}));
      const link = document.createElement('a');
      link.href = url; link.download = `${species}-Lewis.svg`; link.hidden = true;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      announce('Drawing prepared for download.');
    }
  };
  listen(root, 'click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.add) addAtom(button.dataset.add);
    else if (button.dataset.order) {
      order = Number(button.dataset.order); tool = 'bond'; bondFrom = null;
      paint(); announce(`Choose two atoms or an existing bond for a ${bondNames[order]} bond.`);
    } else if (button.hasAttribute('data-pairs') && selectedAtom()) edit(() => {selectedAtom().lonePairs = Number(button.dataset.pairs);});
    else actions[button.dataset.action]?.();
  });
  listen(root, 'change', event => {
    if (event.target.matches('[data-charge]') && selectedAtom()) edit(() => {selectedAtom().charge = Number(event.target.value);});
    if (event.target.matches('[data-net]')) edit(() => {drawing.ionCharge = Number(event.target.value);});
    if (event.target.matches('[data-brackets]')) edit(() => {drawing.brackets = event.target.checked;});
  });
  listen(board, 'click', event => {
    if (swallowClick && event.detail !== 0) {swallowClick = false; return;}
    const node = event.target.closest('[data-atom],[data-bond]');
    if (node?.dataset.atom) chooseAtom(node.dataset.atom);
    else if (node?.dataset.bond) chooseBond(node.dataset.bond);
    else {clearSelection(); paint();}
  });
  listen(board, 'keydown', event => {
    const node = event.target.closest('[data-atom],[data-bond]');
    if (!node) return;
    const focused = node.dataset.atom ? {kind: 'atom', id: node.dataset.atom} : {kind: 'bond', key: node.dataset.bond};
    if (event.key === 'Escape') {event.preventDefault(); useMove(); paintBoard(focused); return;}
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (focused.kind === 'atom') chooseAtom(focused.id); else chooseBond(focused.key);
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault(); selected = focused; removeSelected(); q('[data-action="move"]').focus(); return;
    }
    const arrows = {ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
    if (focused.kind !== 'atom' || !Object.hasOwn(arrows, event.key)) return;
    event.preventDefault(); selected = focused;
    const atom = selectedAtom(), {width, height} = size(), p = position(atom, width, height);
    const [dx, dy] = arrows[event.key], step = event.shiftKey ? 20 : 5;
    edit(() => Object.assign(atom, fittingPoint((p.x + dx * step) / width, (p.y + dy * step) / height)), selected);
  });
  function boardPoint(event) {
    const rect = board.getBoundingClientRect();
    return fittingPoint((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  }
  function snapped(point) {
    return fittingPoint(Math.round(point.x * 40) / 40, Math.round(point.y * 20) / 20);
  }
  listen(board, 'pointerdown', event => {
    swallowClick = false;
    const id = event.target.closest('[data-atom]')?.dataset.atom;
    if (!event.isPrimary || event.button !== 0 || tool !== 'move' || !id) return;
    selected = {kind: 'atom', id}; bondFrom = null;
    drag = {pointerId: event.pointerId, x: event.clientX, y: event.clientY, before: JSON.stringify(drawing), moved: false};
    board.setPointerCapture(event.pointerId);
    paint();
  });
  listen(board, 'pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 3) return;
    drag.moved = true;
    const point = boardPoint(event);
    Object.assign(selectedAtom(), event.altKey ? point : snapped(point));
    paintBoard();
  });
  listen(board, 'pointerup', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const gesture = drag; drag = null; swallowClick = true;
    board.releasePointerCapture(event.pointerId);
    if (gesture.moved) record(gesture.before, selected); else paint(selected);
  });
  listen(board, 'pointercancel', () => {if (drag) {drawing = JSON.parse(drag.before); drag = null; paint();}});
  const disposeDrag = mountPointerDrag(root, {
    sources: '[data-add]', targets: '.lewis-board', read: node => ({element: node.dataset.add}),
    label: data => data.element, pick: data => addAtom(data.element),
    reject: () => announce('Drop the atom inside the drawing area.'),
    drop: (data, target, event) => {
      const {width, height} = size();
      let point = boardPoint(event), attach;
      if (tool === 'bond') {
        const nearby = drawing.atoms.map(atom => {
          const pos = position(atom, width, height);
          return {atom, pos, distance: Math.hypot(point.x * width - pos.x, point.y * height - pos.y)};
        }).sort((a, b) => a.distance - b.distance)[0];
        if (nearby && nearby.distance < 38) {
          attach = nearby.atom.id;
          const candidates = Array.from({length: 12}, (_, index) => {
            const angle = index * Math.PI / 6;
            return fittingPoint((nearby.pos.x + 82 * Math.cos(angle)) / width, (nearby.pos.y + 82 * Math.sin(angle)) / height);
          });
          point = candidates.sort((a, b) => spaceAt(b, width, height) - spaceAt(a, width, height))[0];
        }
      }
      addAtom(data.element, event.altKey || attach ? point : snapped(point), attach);
    }
  });
  const observer = new ResizeObserver(() => paintBoard());
  observer.observe(board);
  paint();
  return () => {disposeDrag(); controller.abort(); observer.disconnect(); root.replaceChildren();};
}
