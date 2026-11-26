import { Run, operation, samples, steps } from './model.js?v=2';
import { CopperScene } from './scene.js?v=2';
import { BenchControls } from './controls.js?v=2';
import { cameraControls } from './camera.js';
import { drawBook, exportCSV } from './notebook.js?v=2';
import {
  getCurrentLang,
  setLanguage,
  initLanguage,
  word,
  label,
  instruction,
  legacy,
  phase,
} from './language.js?v=2';

const $ = (id) => document.getElementById(id),
  canvas = $('bench');
const gear = [
  'balance',
  'brass',
  'beaker',
  'flask',
  'pipette',
  'acid',
  'water',
  'std1',
  'std2',
  'std4',
  'waste',
  'rack',
  'spec',
];
let run = new Run(),
  selected = null,
  renderer,
  scene,
  controls,
  tickCamera,
  dirty = true,
  noticeTimer,
  ready = false,
  holdObservation = false;
const state = () => run.state,
  op = () => operation(state()),
  invalidate = () => {
    dirty = true;
  };
function show(panel) {
  controls?.cancel();
  if (!panel.open) panel.showModal();
}
function helpText() {
  const action = op();
  if (!action) return word('completed');
  if (selected && action.to) return word('selectTarget') + ' ' + label(action.to) + '.';
  if (action.action === 'waitReaction') return word('wait');
  if (action.from === 'notebook') return word('openNotebook');
  return word(action.to ? 'hintPair' : 'hintSingle');
}
function notice(text, error = false) {
  clearTimeout(noticeTimer);
  $('tip').textContent = text;
  $('tip').classList.toggle('error', error);
  noticeTimer = setTimeout(() => {
    $('tip').textContent = helpText();
    $('tip').classList.remove('error');
  }, 3200);
}
function gearButtons() {
  const s = state(),
    action = op(),
    target = selected ? action?.to : action?.from;
  const ids = [
    ...gear.filter((id) => id !== 'pipette' || (s.pipette && !s.cleanup[2])),
    ...samples.filter((k) => s.cuvettes[k]),
    'lid', 'chamber', 'zero', 'read',
    'notebook',
  ];
  $('pickPrompt').textContent = helpText();
  $('gearList').replaceChildren(
    ...ids.map((id) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label(id);
      b.dataset.gear = id;
      b.dataset.expected = id === target;
      b.setAttribute('aria-pressed', String(id === selected));
      b.onclick = () => {
        $('equipmentPanel').close();
        tap(id);
      };
      return b;
    })
  );
}
function renderUI() {
  const s = state(),
    idx = s.index,
    step = steps[idx];
  $('direction').textContent = step ? instruction(idx) : word('completed');
  $('progress').textContent = Math.min(idx + 1, steps.length) + ' / ' + steps.length;
  $('progressTrack').setAttribute('aria-valuemax', steps.length);
  $('progressTrack').setAttribute('aria-valuenow', idx);
  $('progressTrack').firstElementChild.style.width = (100 * idx) / steps.length + '%';
  $('phase').textContent = phase(idx);
  $('undo').disabled = !run.history.length;
  clearTimeout(noticeTimer);
  $('tip').textContent = helpText();
  $('tip').classList.remove('error');
  $('bookStatus').classList.remove('error');
  $('bookStatus').textContent = !step ? word('completed') : '';
  for (const [i, li] of [...$('stepList').children].entries()) {
    if (i === idx) li.setAttribute('aria-current', 'step');
    else li.removeAttribute('aria-current');
  }
  gearButtons();
  drawBook(s);
  invalidate();
}
function showLanguage() {
  document.documentElement.lang = getCurrentLang();
  $('language').value = getCurrentLang();
  document.querySelectorAll('[data-word]').forEach((el) => {
    el.textContent = word(el.dataset.word);
  });
  $('fallback').textContent = word('version2d');
  document.title = word('title') + ' · 3D Virtual Lab';
  $('stepList').replaceChildren(
    ...steps.map((step, i) => {
      const li = document.createElement('li');
      li.textContent = instruction(i);
      return li;
    })
  );
  renderUI();
}
function wrong() {
  notice(legacy('messages.invalidInteraction'), true);
}
function perform(input) {
  const old = steps[state().index],
    result = run.perform(input);
  if (!result.ok) {
    const message = result.key === 'messages.incorrect' ? word('formRetry') : legacy(result.key);
    notice(message, true);
    if ($('notebookPanel').open) {
      $('bookStatus').textContent = message;
      $('bookStatus').classList.add('error');
    }
    scene.sync(state());
    invalidate();
    return false;
  }
  holdObservation = false;
  selected = null;
  scene.sync(state(), { operation: input });
  renderUI();
  if ($('followStep').checked) focusCurrent();
  if (old.action === 'weighBrass')
    notice(legacy('messages.brassMassRecorded', { mass: state().mass.toFixed(3) }));
  if (old.action === 'measure')
    notice(legacy('messages.absorbanceReading', { reading: state().reading.toFixed(3) }));
  if (old.action === 'calibrateSpec') notice(legacy('messages.specCalibrated'));
  if (old.action === 'cleaningChecklist') {
    $('bookStatus').textContent = legacy('messages.cleanupComplete');
    $('answer').focus();
  }
  return true;
}
function tap(id) {
  if (id === 'notebook') {
    show($('notebookPanel'));
    return;
  }
  const action = op();
  if (!action) return;
  if (!action.to) {
    if (id !== action.from) {
      wrong();
      return;
    }
    perform({ from: id });
    return;
  }
  if (selected === action.from && id === action.to) {
    perform(action);
    return;
  }
  if (id === action.from) {
    selected = selected === id ? null : id;
    renderUI();
    return;
  }
  wrong();
}
function frame(view) {
  if (!ready) return;
  controls.cancel();
  scene.frame(view);
  for (const b of document.querySelectorAll('[data-view]'))
    b.setAttribute('aria-pressed', String(b.dataset.view === view));
  invalidate();
}
function focusCurrent() {
  const action = op();
  const ids = action ? [action.from, action.to].filter(Boolean) : null;
  frame(ids || 'bench');
}
function freeView() {
  $('followStep').checked = false;
  scene.view = null;
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
}
function updateMarker() {
  const action = op(),
    id = selected ? action?.to : action?.from,
    mark = $('marker');
  if (!id || !$('guideTargets').checked || document.querySelector('dialog[open]')) {
    mark.hidden = true;
    return;
  }
  const point = scene.point(id);
  if (!point) {
    mark.hidden = true;
    return;
  }
  const p = renderer.project(point);
  const allowed =
    p.z < 1 &&
    p.z > -1 &&
    p.x > 8 &&
    p.y > 8 &&
    p.x < canvas.clientWidth - 8 &&
    p.y < canvas.clientHeight - 8;
  mark.hidden = !allowed;
  if (allowed) {
    mark.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)';
    mark.firstElementChild.textContent = label(id);
  }
}
function update(now) {
  if (
    !holdObservation &&
    steps[state().index]?.action === 'waitReaction' &&
    Date.now() >= state().reactionEnd
  )
    perform({ from: 'beaker' });
  const moving = scene.tick(now),
    cameraChanged = tickCamera(now);
  if (dirty || moving || cameraChanged) {
    renderer.render();
    updateMarker();
    dirty = false;
  }
  requestAnimationFrame(update);
}
function bind() {
  for (const button of document.querySelectorAll('[data-close]'))
    button.onclick = () => button.closest('dialog').close();
  for (const panel of document.querySelectorAll('dialog')) {
    panel.addEventListener('close', invalidate);
    panel.addEventListener('click', (e) => {
      if (e.target === panel) {
        const r = panel.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
          panel.close();
      }
    });
  }
  $('equipmentBtn').onclick = () => {
    gearButtons();
    show($('equipmentPanel'));
  };
  $('notebookBtn').onclick = $('wingNotebook').onclick = () => show($('notebookPanel'));
  $('settingsBtn').onclick = () => show($('settingsPanel'));
  $('protocolBtn').onclick = () => {
    show($('protocolPanel'));
    $('stepList').querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest' });
  };
  for (const b of document.querySelectorAll('[data-view]'))
    b.onclick = () => {
      freeView();
      frame(b.dataset.view);
    };
  $('focusBtn').onclick = focusCurrent;
  $('followStep').onchange = () => {
    if ($('followStep').checked) focusCurrent();
  };
  $('guideTargets').onchange = invalidate;
  $('language').onchange = async (e) => {
    await setLanguage(e.target.value);
    showLanguage();
  };
  $('finish').onchange = async (e) => {
    const select = e.target;
    select.disabled = true;
    try {
      await scene.appearance.select(select.value);
      scene.paintInstrument(state());
      invalidate();
    } catch (error) {
      select.value = scene.appearance.active;
      notice(error.message, true);
    } finally {
      select.disabled = false;
    }
  };
  $('quality').onchange = (e) => {
    renderer.setQuality(e.target.value);
    invalidate();
  };
  $('undo').onclick = () => {
    if (!run.undo()) return;
    holdObservation = steps[state().index]?.action === 'waitReaction';
    selected = null;
    $('answer').value = '';
    scene.sync(state(), { animate: false });
    renderUI();
    if ($('followStep').checked) focusCurrent();
    $('settingsPanel').close();
  };
  $('reset').onclick = () => {
    $('settingsPanel').close();
    show($('resetPanel'));
  };
  $('confirmReset').onclick = () => {
    run = new Run();
    selected = null;
    holdObservation = false;
    $('answer').value = '';
    $('hints').open = false;
    scene.sync(state(), { animate: false });
    $('resetPanel').close();
    if ($('followStep').checked) focusCurrent();
    else frame('bench');
    renderUI();
  };
  $('checks').onchange = (e) => {
    if (op()?.action === 'cleaningChecklist' && e.target.matches('input[data-index]'))
      state().cleanup[Number(e.target.dataset.index)] = e.target.checked;
    scene.sync(state(), { animate: false });
    invalidate();
  };
  $('completeCleanup').onclick = () => perform({ from: 'notebook' });
  $('calcForm').onsubmit = (e) => {
    e.preventDefault();
    perform({ from: 'notebook', answer: $('answer').value });
  };
  $('download').onclick = () => exportCSV(state());
  window.addEventListener('resize', () => {
    renderer.resize();
    if (scene.view) scene.frame(scene.view);
    invalidate();
  });
  for (const el of document.querySelectorAll('.flight-wing')) el.addEventListener('toggle', invalidate);
  document.addEventListener('keydown', (e) => {
    if (
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      document.querySelector('dialog[open]') ||
      e.target.matches('input,select,textarea')
    )
      return;
    if (e.key.toLowerCase() === 'e') $('equipmentBtn').click();
    if (e.key.toLowerCase() === 'n') $('notebookBtn').click();
  });
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    $('loading').hidden = false;
    $('loadError').hidden = $('fallback').hidden = false;
    $('loadError').textContent = 'Graphics context lost. Reload the page to reopen the 3D bench.';
  });
  canvas.addEventListener('webglcontextrestored', () => location.reload());
}
async function boot() {
  try {
    await initLanguage();
    showLanguage();
    renderer = new globalThis.E3D.Renderer(
      canvas,
      'balanced',
      new URL('../../spectrophotometry_v2/assets/', import.meta.url)
    );
    scene = new CopperScene(renderer);
    await scene.load();
    scene.reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
    renderer.resize();
    scene.sync(state(), { animate: false });
    controls = new BenchControls(canvas, scene, {
      state,
      operation: op,
      selected: () => selected,
      clear: () => {
        selected = null;
        renderUI();
      },
      dirty: invalidate,
      tap,
      perform,
      wrong,
      frame,
      freeView,
    });
    tickCamera = cameraControls(renderer, controls, invalidate);
    bind();
    ready = true;
    if (matchMedia('(max-width:719px), (max-height:530px)').matches)
      document.querySelectorAll('.flight-wing').forEach((el) => (el.open = false));
    $('followStep').checked = matchMedia('(max-width:719px)').matches;
    if ($('followStep').checked) focusCurrent();
    else frame('bench');
    $('loading').hidden = true;
    document.body.dataset.ready = 'true';
    requestAnimationFrame(update);
  } catch (error) {
    console.error(error);
    $('loading').hidden = false;
    $('loadError').hidden = $('fallback').hidden = false;
    $('loading').querySelector('strong').textContent = word('title');
    $('loadError').textContent = error.message;
  }
}
boot();
