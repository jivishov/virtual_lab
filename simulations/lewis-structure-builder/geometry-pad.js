import {escapeHTML, mountPointerDrag} from './direct-controls.js';
import {DOMAIN_TEMPLATES, GEOMETRY_NAMES, HYBRID_NAMES} from './geometry-tasks.js';
import {geometrySites, initialGeometry, initialRotation} from './geometry-chemistry.js';
import {changeConstruction, restoreConstruction, checkedConstruction} from './construction-state.js';
import {diagramMarkup} from './lewis-pad.js';

const pieceName = piece => piece === 'lone-pair' ? 'Central lone pair' : piece || 'Empty';
const bondName = ['', 'single', 'double', 'triple'];
const siteIds = 'abcd';
const unit = 1 / Math.sqrt(3);
const vectors = {
  linear: [[-1, 0, 0], [1, 0, 0]],
  'trigonal-planar': [[1, 0, 0], [-.5, Math.sqrt(3) / 2, 0], [-.5, -Math.sqrt(3) / 2, 0]],
  tetrahedral: [[unit, unit, unit], [unit, -unit, -unit], [-unit, unit, -unit], [-unit, -unit, unit]]
};
function optionList(options, placeholder = 'Choose') {
  return `<option value="">${placeholder}</option>` + Object.entries(options).map(([key, label]) =>
    `<option value="${escapeHTML(key)}">${escapeHTML(label)}</option>`).join('');
}
function inputField(key, label, options) {
  return `<label>${escapeHTML(label)}<select data-field="${key}" data-choice="${['domainCount', 'polarity'].includes(key) ? 'segment' : 'chips'}">${optionList(options)}</select></label>`;
}

function project(arrangement, rotation) {
  const yaw = rotation.yaw * Math.PI / 180, pitch = rotation.pitch * Math.PI / 180;
  return (vectors[arrangement] || []).map(([x, y, z], index) => {
    const side = x * Math.cos(yaw) + z * Math.sin(yaw);
    const depth = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const up = y * Math.cos(pitch) - depth * Math.sin(pitch);
    return {id: siteIds[index], x: 150 + side * 100, y: 125 - up * 100,
      depth: y * Math.sin(pitch) + depth * Math.cos(pitch)};
  });
}

function connector(point, piece, task) {
  const dx = point.x - 150, dy = point.y - 125, length = Math.hypot(dx, dy);
  if (length < 39) return '';
  const ux = dx / length, uy = dy / length;
  const x1 = 150 + ux * 19, y1 = 125 + uy * 19, x2 = point.x - ux * 19, y2 = point.y - uy * 19;
  if (!piece || piece === 'lone-pair') {
    return `<path class="geometry-guide ${piece ? 'lone-pair' : ''}" d="M${x1},${y1} L${x2},${y2}"/>`;
  }
  const order = task.bondOrders[piece];
  if (order === 1 && point.depth > .25) {
    return `<path class="geometry-wedge" d="M${x1},${y1} L${x2 - uy * 5},${y2 + ux * 5} L${x2 + uy * 5},${y2 - ux * 5} Z"/>`;
  }
  return Array.from({length: order}, (_, index) => {
    const offset = (index - (order - 1) / 2) * 5;
    return `<line class="geometry-bond ${point.depth < -.25 ? 'behind' : ''}" x1="${x1 - uy * offset}" y1="${y1 + ux * offset}" x2="${x2 - uy * offset}" y2="${y2 + ux * offset}"/>`;
  }).join('');
}

function siteMarker(point, piece, selected) {
  const {x, y, id} = point;
  const lone = piece === 'lone-pair', name = id.toUpperCase();
  const shape = lone ? `<ellipse cx="${x}" cy="${y}" rx="21" ry="17"/>` : `<circle cx="${x}" cy="${y}" r="18"/>`;
  return `<g data-site="${id}" tabindex="0" role="button" aria-label="Site ${name}, ${escapeHTML(pieceName(piece))}" aria-pressed="${selected === id}" class="geometry-site ${lone ? 'lone-pair' : ''} ${piece ? '' : 'empty'}">
    ${shape}<text x="${x}" y="${y + 5}" text-anchor="middle">${lone ? '••' : escapeHTML(piece || '?')}</text>
    <text class="geometry-site-caption" x="${x}" y="${y + 31}" text-anchor="middle">${name}${lone ? ' · LP' : ''}</text></g>`;
}

function referenceText(task) {
  const {atoms, bonds} = task.reference;
  const center = atoms.find(atom => atom.id === 'center');
  const pairs = count => `${count} lone pair${count === 1 ? '' : 's'}`;
  const groups = new Map();
  for (const bond of bonds) {
    const atom = atoms.find(item => item.id === (bond.a === center.id ? bond.b : bond.a));
    const text = `${atom.element} (${bondName[bond.order]} bond, ${pairs(atom.lonePairs)})`;
    groups.set(text, (groups.get(text) || 0) + 1);
  }
  return `Central ${center.element} has ${pairs(center.lonePairs)}. Attached atoms include ` +
    [...groups].map(([label, count]) => `${count} × ${label}`).join(' and ') + '.';
}

function resultMarkup(result) {
  if (!result) return '';
  return `<p class="geometry-outcome">${escapeHTML(result.message)}</p><ul class="geometry-criteria">` +
    result.criteria.map(item => `<li data-state="${item.status}"><strong>${escapeHTML(item.label)}</strong>
      <span>${item.status === 'met' ? 'Met' : item.status === 'missing' ? 'Unanswered' : 'Revise'}</span>
      ${item.status === 'met' ? '' : `<p>${escapeHTML(item.message)}</p>`}</li>`).join('') + '</ul>';
}

export function mountGeometryPad(root, {task, value, result = null, onChange, onCheck}) {
  let response = structuredClone(value);
  const undo = [], redo = [];
  let selected = 'a', chosen = null, siteArrangement, orbit = null;
  const controller = new AbortController();
  const listen = (node, event, handler) => node.addEventListener(event, handler, {signal: controller.signal});
  const query = selector => root.querySelector(selector);
  const arrangementNames = Object.fromEntries(Object.entries(DOMAIN_TEMPLATES).map(([key, item]) => [key, item.label]));
  const electronNames = Object.fromEntries(Object.keys(DOMAIN_TEMPLATES).map(key => [key, GEOMETRY_NAMES[key]]));
  const numbers = Object.fromEntries(Array.from({length: 9}, (_, index) => [index, String(index)]));

  root.className = 'geometry-editor';
  root.innerHTML = `<div class="geometry-toolbar"><strong>${escapeHTML(task.formula)} domain model</strong>
    <div class="geometry-history"><button type="button" data-action="undo">Undo</button><button type="button" data-action="redo">Redo</button>
      <button type="button" data-action="reset">Clear model</button></div></div>
    <div class="geometry-workarea"><section class="geometry-build" aria-label="Build the domain model">
      <details class="geometry-reference"><summary>Lewis reference for ${escapeHTML(task.formula)}</summary>
        <svg viewBox="0 0 360 260" aria-hidden="true">${diagramMarkup(task.reference, {width: 360, height: 260, interactive: false})}</svg>
        <p>${escapeHTML(referenceText(task))}</p></details>
      <div class="geometry-template-controls">${inputField('domainCount', 'Central electron domains', numbers)}
        <label>Domain template<select data-field="arrangement" data-choice="cards">${optionList(arrangementNames)}</select></label></div>
      <p class="geometry-note">Each template has its own sites. Undo restores the previous template and its pieces.</p>
      <div class="geometry-palette" role="group" aria-label="Site tools">${task.palette.map(piece =>
        `<button type="button" class="direct-token" data-piece="${piece}" aria-pressed="false">${escapeHTML(pieceName(piece))}</button>`).join('')}
        <button type="button" data-action="move" aria-pressed="true">Select site</button>
        <button type="button" data-action="clear-site">Empty selected site</button></div>
      <p class="geometry-note">Pick a piece, then select a site. Drag a piece onto a site to place it, or drag between sites to swap their contents.</p>
      <svg class="geometry-board" viewBox="0 0 300 267" role="group" tabindex="0" aria-label="Rotatable domain construction" aria-describedby="geometry-rotation-help"></svg>
      <div class="geometry-view-controls" role="group" aria-label="Viewing angle"><button type="button" data-action="left">Rotate left</button>
        <button type="button" data-action="right">Rotate right</button><button type="button" data-action="up">Tilt up</button>
        <button type="button" data-action="down">Tilt down</button><button type="button" data-action="home">Reset view</button></div>
      <p class="geometry-note" id="geometry-rotation-help">Drag the background or use the arrow keys on the model to rotate it. A wedge points toward you and a dashed bond recedes. The model holds ideal domain directions as you turn it.</p>
      <details class="geometry-assignments"><summary>Assign sites by letter</summary><div data-assignments></div></details>
    </section>
    <section class="geometry-answers" aria-label="Interpret your construction">
      <h2>Interpret the model</h2><div class="geometry-classifications">
        ${inputField('electronGeometry', 'Electron-domain geometry', electronNames)}
        ${inputField('molecularGeometry', 'Molecular shape', GEOMETRY_NAMES)}
        ${inputField('angle', task.anglePrompt, task.angleChoices)}
        ${task.hybridization ? inputField('hybridization', 'Central hybridization in a simple orbital model', HYBRID_NAMES) : ''}
        ${inputField('polarity', 'Net molecular polarity', {polar: 'Polar', nonpolar: 'Nonpolar'})}</div>
      <button type="button" class="check-button" data-action="check">Check model</button>
      <div class="geometry-result" aria-live="polite"></div></section></div>
    <p class="geometry-status" role="status"></p>`;
  const board = query('.geometry-board'), assignments = query('[data-assignments]'), review = query('.geometry-result');
  // Keep construction, classification, and history together beside the model.
  const panel = query('.geometry-answers');
  panel.classList.add('side-panel');
  const scroll = document.createElement('div');
  scroll.className = 'pad-scroll';
  const template = query('.geometry-template-controls');
  const templateNote = template.nextElementSibling;
  const palette = query('.geometry-palette');
  const placementNote = palette.nextElementSibling;
  const check = query('[data-action="check"]');
  check.remove();
  scroll.append(template, templateNote, palette, placementNote, query('.geometry-assignments'), ...panel.childNodes);
  const actionBar = document.createElement('div');
  actionBar.className = 'pad-actions';
  actionBar.append(query('.geometry-history'), check);
  panel.append(scroll, actionBar);
  const announce = text => {query('.geometry-status').textContent = text;};
  const snapshot = () => ({answer: structuredClone(response.answer), attempted: response.attempted});
  const snapshotResult = () => result ? structuredClone(result) : null;
  const save = () => onChange(structuredClone(response), snapshotResult());

  function draw(focusId) {
    const {arrangement, rotation, sites} = response.answer;
    if (!arrangement) {
      board.innerHTML = '<text class="geometry-empty" x="150" y="100" text-anchor="middle">Choose a domain template to begin.</text>';
      return;
    }
    const points = project(arrangement, rotation);
    const sitesById = new Map(sites.map(site => [site.id, site.occupant]));
    const connectors = points.map(point => connector(point, sitesById.get(point.id), task)).join('');
    const center = `<g aria-hidden="true"><circle class="geometry-center" cx="150" cy="125" r="19"/>
      <text class="geometry-center-label" x="150" y="131" text-anchor="middle">${escapeHTML(task.center)}</text></g>`;
    const markers = points.map(point => ({depth: point.depth, html: siteMarker(point, sitesById.get(point.id), selected)}));
    markers.push({depth: 0, html: center});
    board.innerHTML = connectors + markers.sort((a, b) => a.depth - b.depth).map(marker => marker.html).join('');
    if (focusId) board.querySelector(`[data-site="${focusId}"]`)?.focus({preventScroll: true});
  }

  function refresh() {
    const answer = response.answer;
    root.querySelectorAll('[data-field]').forEach(control => {control.value = answer[control.dataset.field] ?? '';});
    if (siteArrangement !== answer.arrangement) {
      siteArrangement = answer.arrangement;
      const choices = Object.fromEntries(task.palette.map(piece => [piece, pieceName(piece)]));
      assignments.innerHTML = answer.sites.map(site =>
        `<label>Site ${site.id.toUpperCase()}<select data-choice="chips" data-assignment="${site.id}" data-choice-empty>${optionList(choices, 'Empty')}</select></label>`).join('') ||
        '<p>Choose a domain template to create sites.</p>';
    }
    for (const site of answer.sites) query(`[data-assignment="${site.id}"]`).value = site.occupant || '';
    query('[data-action="undo"]').disabled = !undo.length;
    query('[data-action="redo"]').disabled = !redo.length;
    query('[data-action="check"]').disabled = !response.attempted;
    query('[data-action="clear-site"]').disabled = !answer.sites.find(site => site.id === selected)?.occupant;
    review.innerHTML = resultMarkup(result);
    draw();
  }

  function change(mutator, {reset = false} = {}) {
    const answer = structuredClone(response.answer);
    mutator(answer);
    if (JSON.stringify(answer) === JSON.stringify(response.answer) && (!reset || !response.attempted)) return;
    undo.push(snapshot());
    if (undo.length > 60) undo.shift();
    redo.length = 0;
    response = changeConstruction(response, answer, !reset);
    result = null;
    save();
    refresh();
  }
  function history(isUndo) {
    const from = isUndo ? undo : redo, to = isUndo ? redo : undo;
    if (!from.length) return;
    to.push(snapshot());
    response = restoreConstruction(response, from.pop(), isUndo);
    result = null;
    save();
    refresh();
    announce(isUndo ? 'Previous construction restored.' : 'Change reapplied.');
  }
  function choose(piece) {
    chosen = piece;
    root.querySelectorAll('[data-piece]').forEach(button =>
      button.setAttribute('aria-pressed', String(chosen === button.dataset.piece)));
    query('[data-action="move"]').setAttribute('aria-pressed', String(chosen === null));
  }
  function place(siteId) {
    selected = siteId;
    if (chosen) {
      change(answer => {answer.sites.find(site => site.id === selected).occupant = chosen;});
      announce(`Site ${selected.toUpperCase()} holds ${pieceName(chosen)}.`);
    }
    refresh();
  }
  function setRotation(yaw, pitch) {
    response.answer.rotation = {yaw: (yaw % 360 + 360) % 360, pitch: Math.max(-60, Math.min(60, pitch))};
    draw();
  }
  function rotate(yaw, pitch) {
    const current = response.answer.rotation;
    setRotation(current.yaw + yaw, current.pitch + pitch);
    save();
  }
  function clearSite() {
    const site = response.answer.sites.find(site => site.id === selected);
    if (!site?.occupant) return;
    change(answer => {answer.sites.find(site => site.id === selected).occupant = null;});
    announce(`Site ${selected.toUpperCase()} is empty.`);
  }
  const actions = {
    undo: () => history(true), redo: () => history(false), move: () => choose(null), 'clear-site': clearSite,
    reset: () => {
      selected = 'a';
      choose(null);
      change(answer => Object.assign(answer, initialGeometry()), {reset: true});
      announce('Model cleared. Undo restores your work.');
    },
    left: () => rotate(-20, 0), right: () => rotate(20, 0), up: () => rotate(0, 15), down: () => rotate(0, -15),
    home: () => {const {yaw, pitch} = initialRotation(); setRotation(yaw, pitch); save();},
    check: () => {
      if (!response.attempted) return;
      result = checkedConstruction(response, task);
      onCheck(structuredClone(response), snapshotResult());
      review.innerHTML = resultMarkup(result);
    }
  };

  listen(root, 'change', event => {
    const el = event.target;
    if (el.dataset.assignment) {
      selected = el.dataset.assignment;
      change(answer => {answer.sites.find(site => site.id === selected).occupant = el.value || null;});
    } else if (el.dataset.field) {
      const key = el.dataset.field;
      change(answer => {
        answer[key] = el.value === '' ? null : key === 'domainCount' ? Number(el.value) : el.value;
        if (key === 'arrangement') {
          answer.sites = geometrySites(answer.arrangement);
          selected = 'a';
        }
      });
    }
  });
  listen(root, 'click', event => {
    const button = event.target.closest('button');
    if (button?.dataset.piece) choose(button.dataset.piece);
    else if (button && !button.disabled) actions[button.dataset.action]?.();
    else {
      const site = event.target.closest('[data-site]');
      if (site) place(site.dataset.site);
    }
  });
  listen(board, 'keydown', event => {
    const id = event.target.closest('[data-site]')?.dataset.site;
    if (id) selected = id;
    const directions = {ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, 15], ArrowDown: [0, -15]};
    if (Object.hasOwn(directions, event.key)) {event.preventDefault(); rotate(...directions[event.key]);}
    else if (id && (event.key === 'Enter' || event.key === ' ')) {event.preventDefault(); place(id);}
    else if (id && (event.key === 'Delete' || event.key === 'Backspace')) {event.preventDefault(); clearSite();}
    else return;
    draw(id);
  });
  const disposeDrag = mountPointerDrag(root, {
    sources: '[data-piece],[data-site]', targets: '[data-site]',
    read: node => node.dataset.piece ? {piece: node.dataset.piece}
      : {site: node.dataset.site, piece: response.answer.sites.find(site => site.id === node.dataset.site)?.occupant},
    accept: data => Boolean(data.piece), label: data => pieceName(data.piece),
    pick: data => data.site ? place(data.site) : choose(data.piece),
    reject: () => announce('Place the piece on a lettered site in the model.'),
    drop: (data, target) => {
      selected = target.dataset.site;
      change(answer => {
        const dest = answer.sites.find(site => site.id === selected);
        if (data.site) answer.sites.find(site => site.id === data.site).occupant = dest.occupant;
        dest.occupant = data.piece;
      });
      announce(`Site ${selected.toUpperCase()} holds ${pieceName(data.piece)}.`);
    }
  });
  listen(board, 'pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest('[data-site]') || !response.answer.arrangement) return;
    orbit = {pointerId: event.pointerId, x: event.clientX, y: event.clientY, ...response.answer.rotation};
    board.setPointerCapture(event.pointerId);
  });
  listen(board, 'pointermove', event => {
    if (!orbit || orbit.pointerId !== event.pointerId) return;
    setRotation(orbit.yaw + (event.clientX - orbit.x) * .5, orbit.pitch + (orbit.y - event.clientY) * .5);
  });
  listen(board, 'pointerup', event => {
    if (!orbit || orbit.pointerId !== event.pointerId) return;
    orbit = null;
    board.releasePointerCapture(event.pointerId);
    save();
  });
  listen(board, 'pointercancel', () => {if (orbit) {setRotation(orbit.yaw, orbit.pitch); orbit = null;}});
  refresh();
  return () => {disposeDrag(); controller.abort(); root.replaceChildren();};
}
