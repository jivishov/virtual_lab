import {mountLewisPad} from './lewis-pad.js';
import {LEWIS_SPECIES, normalizeDrawing} from './lewis-chemistry.js';
import {mountGeometryPad} from './geometry-pad.js';
import {GEOMETRY_TASKS} from './geometry-tasks.js';
import {newConstruction, normalizeConstruction, restoreResult} from './construction-state.js';

const root = document.getElementById('editor');
const select = document.getElementById('species');
const status = document.getElementById('storage');
const caseControls = document.querySelector('.companion-controls');
const casePrompt = document.getElementById('case-prompt');
function placeCaseControls() {
  root.querySelector('.pad-scroll').prepend(caseControls, casePrompt);
}
const remembered = {lewis: null, geometry: null};
let mode, dispose;

function readItem(key) {
  try {
    const text = localStorage.getItem(key);
    if (text === null) return {record: null};
    try {return {record: JSON.parse(text)};}
    catch {return {record: null, warning: 'The previous save could not be read.'};}
  } catch {
    return {record: null, warning: 'Browser storage is unavailable for this page.'};
  }
}

function showExample() {
  // Keep the original case controls alive while the pad replaces its presentation.
  root.before(caseControls, casePrompt);
  dispose?.();
  const id = select.value;
  remembered[mode] = id;
  const lewis = mode === 'lewis';
  const task = lewis ? LEWIS_SPECIES[id] : GEOMETRY_TASKS[id];
  const key = 'virtuallab:chemistry-collection:structure:' + id;
  const {record, warning} = readItem(key);
  document.getElementById('case-prompt').textContent = task.prompt;
  status.textContent = warning || 'Your edits are saved in this browser for each practice case.';
  function save(value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      status.textContent = `Saved in this browser for ${task.formula}.`;
    } catch {
      status.textContent = 'Browser storage is unavailable. Keep this page open to continue working.';
    }
  }
  if (lewis) {
    // A bare drawing is also readable from an earlier save format.
    const drawing = normalizeDrawing(record?.drawing ?? record);
    if (record && !drawing) status.textContent = 'The saved drawing could not be read. You can start a fresh drawing here.';
    dispose = mountLewisPad(root, {
      species: id, value: drawing, checked: record?.checked === true,
      onChange: drawing => save({drawing, checked: false}),
      onCheck: drawing => save({drawing, checked: true})
    });
    placeCaseControls();
    return;
  }
  const restored = normalizeConstruction(record?.construction ?? record, task);
  if (record && !restored) status.textContent = 'The saved model could not be read. You can start a fresh model here.';
  const construction = restored || newConstruction(task);
  const persist = (construction, result) => {
    let checked = null;
    if (result) {
      const {version, taskId, taskVersion, evaluatorVersion, answerRevision, checkedAt} = result;
      checked = {version, taskId, taskVersion, evaluatorVersion, answerRevision, checkedAt};
    }
    save({construction, checked});
  };
  dispose = mountGeometryPad(root, {
    task, value: construction, result: restoreResult(construction, record?.checked, task), onChange: persist, onCheck: persist
  });
  placeCaseControls();
}

function openTool() {
  const next = location.hash === '#geometry' ? 'geometry' : 'lewis';
  if (next === mode) return;
  const previous = mode ? remembered[mode]?.replace(/^geometry-/, '') : null;
  mode = next;
  const title = mode === 'lewis' ? 'Lewis structure pad' : 'Rotatable geometry pad';
  document.title = `${title} · VirtualLab`;
  document.getElementById('tool-title').textContent = title;
  document.querySelectorAll('.companion-modes a').forEach(link => {
    if (link.hash === '#' + mode) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const entries = mode === 'lewis' ? LEWIS_SPECIES : GEOMETRY_TASKS;
  select.replaceChildren();
  for (const [id, item] of Object.entries(entries)) {
    const option = new Option(item.formula, id);
    option.dataset.sub = item.name;
    option.title = `${item.formula} · ${item.name}`;
    select.add(option);
  }
  const shared = previous && (mode === 'lewis' ? previous : 'geometry-' + previous);
  if (shared && Object.hasOwn(entries, shared)) select.value = shared;
  else if (remembered[mode]) select.value = remembered[mode];
  showExample();
}

document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  document.getElementById('main').focus();
});
select.addEventListener('change', showExample);
window.addEventListener('hashchange', openTool);
openTool();
