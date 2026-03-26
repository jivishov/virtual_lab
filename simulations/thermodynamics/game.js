// ══════════════════════════════════════════
//  HEAT SIGNAL — Thermodynamics Escape Lab
//  Game Logic & Puzzle Engine
// ══════════════════════════════════════════

// ── Game State ──
const state = {
  currentRoom: -1,
  completed: [false, false, false, false],
  puzzlesDone: {
    r0p1: false, r0p2: false,
    r1p1: false, r1p2: false,
    r2p1: false, r2p2: false,
    r3p1: false, r3p2: false
  }
};

// Room accent colours (must match style.css)
const ROOM_ACCENTS = [
  { cls: '',       accent: '#FF6B00', rgb: '255,107,0'   }, // 0 — orange
  { cls: 'room-1', accent: '#A8FF3E', rgb: '168,255,62'  }, // 1 — lime
  { cls: 'room-2', accent: '#FF2D78', rgb: '255,45,120'  }, // 2 — magenta
  { cls: 'room-3', accent: '#00E5FF', rgb: '0,229,255'   }  // 3 — cyan
];

// ── Screen management ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('active');
  // Force animation replay
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = '';
  window.scrollTo({ top: 0, behavior: 'instant' });
  updateAccentColor(id);
}

function updateAccentColor(screenId) {
  const body = document.body;
  // Strip all room classes
  body.classList.remove('room-1', 'room-2', 'room-3', 'finale');

  if (screenId.startsWith('room0') || screenId === 'room0-door') {
    // default accent is room 0
  } else if (screenId.startsWith('room1') || screenId === 'room1-door') {
    body.classList.add('room-1');
  } else if (screenId.startsWith('room2') || screenId === 'room2-door') {
    body.classList.add('room-2');
  } else if (screenId.startsWith('room3') || screenId === 'room3-door') {
    body.classList.add('room-3');
  } else if (screenId === 'finale') {
    body.classList.add('finale');
  }
}

// ── Progress strip ──
function updateProgress() {
  for (let i = 0; i < 4; i++) {
    const node = document.getElementById('pn' + i);
    node.classList.remove('active', 'done');

    if (state.completed[i]) {
      node.classList.add('done');
      node.textContent = '✓';
      if (i < 3) document.getElementById('pl' + i).classList.add('done');
    } else if (i === state.currentRoom) {
      node.classList.add('active');
      node.textContent = i;
    } else {
      node.textContent = i;
    }
  }
}

// ── Start ──
function startGame() {
  state.currentRoom = 0;
  updateProgress();
  showScreen('room0-door');
}

// ── Glitch on wrong answers ──
function triggerGlitch() {
  const overlay = document.getElementById('glitchOverlay');
  overlay.classList.remove('active');
  overlay.offsetHeight; // reflow
  overlay.classList.add('active');
  setTimeout(() => overlay.classList.remove('active'), 500);
}

// ── Feedback banner ──
function showFeedback(id, correct, msg) {
  const fb = document.getElementById(id);
  fb.className = 'feedback show ' + (correct ? 'correct' : 'wrong');
  fb.textContent = msg;
  if (!correct) triggerGlitch();
}

// ── Unlock transition ──
function showUnlock(label, numDisplay, callback) {
  const ov  = document.getElementById('unlockOverlay');
  const num = document.getElementById('unlockNum');
  const txt = document.getElementById('unlockText');

  num.textContent = numDisplay;
  txt.textContent = label;

  // Force animation replay on the number
  num.style.animation = 'none';
  num.offsetHeight;
  num.style.animation = '';

  ov.classList.add('show');
  setTimeout(() => {
    ov.classList.remove('show');
    callback();
  }, 1900);
}

// ── Room completion ──
function completeRoom(n) {
  state.completed[n] = true;
  updateProgress();

  if (n < 3) {
    const next = n + 1;
    state.currentRoom = next;
    updateProgress();
    showUnlock('UNLOCKED', String(n), () => showScreen('room' + next + '-door'));
  } else {
    showUnlock('ESCAPED', '✓', () => {
      document.getElementById('progressStrip').style.display = 'none';
      document.body.classList.add('finale');
      showScreen('finale');
    });
  }
}

// ══════════════════════════════════
//  DRAG & DROP — Generic helpers
// ══════════════════════════════════
let draggedEl = null;

function initDragDrop(itemsContainerId, zoneIds) {
  const container = document.getElementById(itemsContainerId);
  if (!container) return;

  container.querySelectorAll('.drag-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      draggedEl = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedEl = null;
    });

    // Click-to-select fallback
    item.addEventListener('click', () => {
      if (item.dataset.selected === 'true') {
        item.dataset.selected = 'false';
        item.style.outline = '';
      } else {
        // Deselect all
        document.querySelectorAll('.drag-item[data-selected="true"]').forEach(i => {
          i.dataset.selected = 'false';
          i.style.outline = '';
        });
        item.dataset.selected = 'true';
        item.style.outline = '1px solid var(--accent)';
      }
    });
  });

  zoneIds.forEach(zid => {
    const zone = document.getElementById(zid);
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (draggedEl) { zone.appendChild(draggedEl); draggedEl.classList.add('in-zone'); }
    });
    // Click-to-drop
    zone.addEventListener('click', () => {
      const sel = document.querySelector('.drag-item[data-selected="true"]');
      if (sel) {
        zone.appendChild(sel);
        sel.classList.add('in-zone');
        sel.dataset.selected = 'false';
        sel.style.outline = '';
      }
    });
  });
}

// ── Energy slot drag ──
function initEnergySlots() {
  document.querySelectorAll('.energy-chip').forEach(chip => {
    chip.addEventListener('dragstart', e => {
      draggedEl = chip;
      chip.style.opacity = '0.35';
    });
    chip.addEventListener('dragend', () => {
      chip.style.opacity = '1';
      draggedEl = null;
    });
  });

  document.querySelectorAll('.energy-slot').forEach(slot => {
    slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('dragover'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('dragover'));
    slot.addEventListener('drop', e => {
      e.preventDefault();
      slot.classList.remove('dragover');
      if (draggedEl && draggedEl.classList.contains('energy-chip')) {
        const existing = slot.querySelector('.energy-chip');
        if (existing) document.getElementById('r1p1-chips').appendChild(existing);
        slot.appendChild(draggedEl);
        slot.classList.add('filled');
        checkEnergySlot(slot, draggedEl);
      }
    });
  });
}

function checkEnergySlot(slot, chip) {
  const val     = chip.dataset.val;
  const correct = slot.dataset.correct;
  if (val === correct) {
    showFeedback('r1p1-fb', true,
      'Correct! 500 J of heat in minus 200 J of work out = 300 J increase in internal energy. Energy is conserved!');
    state.puzzlesDone.r1p1 = true;
    document.getElementById('r1p2').classList.remove('hidden');
  } else {
    showFeedback('r1p1-fb', false,
      'Not quite. Remember: \u0394U = Q \u2212 W. The gas absorbed 500 J and did 200 J of work. What\u2019s left?');
    setTimeout(() => {
      document.getElementById('r1p1-chips').appendChild(chip);
      slot.classList.remove('filled');
    }, 1200);
  }
}

// ── Order list drag ──
function initOrderList(listId) {
  const list = document.getElementById(listId);
  let dragItem = null;

  list.querySelectorAll('.order-item').forEach(item => {
    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart', e => {
      dragItem = item;
      item.style.opacity = '0.35';
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.style.opacity = '1';
      dragItem = null;
      updateOrderNums(listId);
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      if (dragItem && dragItem !== item) {
        const rect = item.getBoundingClientRect();
        const mid  = rect.top + rect.height / 2;
        if (e.clientY < mid) list.insertBefore(dragItem, item);
        else list.insertBefore(dragItem, item.nextSibling);
      }
    });

    // Click to swap
    item.addEventListener('click', () => {
      if (item.dataset.selected === 'true') {
        item.dataset.selected = 'false';
        item.style.outline = '';
      } else {
        const prev = list.querySelector('[data-selected="true"]');
        if (prev && prev !== item) {
          // Swap positions
          const nextOfItem = item.nextSibling;
          const nextOfPrev = prev.nextSibling;
          if (nextOfItem === prev)      list.insertBefore(prev, item);
          else if (nextOfPrev === item) list.insertBefore(item, prev);
          else { list.insertBefore(prev, nextOfItem); list.insertBefore(item, nextOfPrev); }
          prev.dataset.selected = 'false';
          prev.style.outline = '';
          updateOrderNums(listId);
        } else {
          if (prev) { prev.dataset.selected = 'false'; prev.style.outline = ''; }
          item.dataset.selected = 'true';
          item.style.outline = '1px solid var(--accent)';
        }
      }
    });
  });
}

function updateOrderNums(listId) {
  document.getElementById(listId).querySelectorAll('.order-item').forEach((item, i) => {
    item.querySelector('.order-num').textContent = i + 1;
  });
}

// ── Multiple choice ──
function checkMC(opt, puzzleId) {
  const parent = opt.parentElement;
  if (parent.dataset.locked === 'true') return;
  const correct = opt.dataset.correct === 'true';

  if (correct) {
    parent.dataset.locked = 'true';
    opt.classList.add('correct');
    parent.querySelectorAll('.mc-option').forEach(o => {
      if (o !== opt) o.style.opacity = '0.35';
      o.style.pointerEvents = 'none';
    });
    if (puzzleId === 'r0p2') {
      showFeedback('r0p2-fb', true,
        'Exactly! The thermometer reaches the same temperature as the water (thermal equilibrium). By the Zeroth Law, they must share the same temperature — which is what the reading tells you.');
      state.puzzlesDone.r0p2 = true;
      document.getElementById('r0-next-btn').classList.remove('hidden');
    } else if (puzzleId === 'r3p2') {
      showFeedback('r3p2-fb', true,
        'Correct! Each successive cooling step removes a smaller amount of heat, making it impossible to reach exactly 0 K in any finite process. This is the essence of the Third Law.');
      state.puzzlesDone.r3p2 = true;
      document.getElementById('r3-next-btn').classList.remove('hidden');
    }
  } else {
    opt.classList.add('wrong');
    setTimeout(() => opt.classList.remove('wrong'), 500);
    if (puzzleId === 'r0p2')
      showFeedback('r0p2-fb', false,
        'Not quite — think about what "thermal equilibrium" means and how the Zeroth Law connects two objects through a third.');
    else if (puzzleId === 'r3p2')
      showFeedback('r3p2-fb', false,
        'Not quite. Think about what happens to the cooling rate as you get closer and closer to 0 K.');
  }
}

// ══════════════════════════════════
//  ROOM 0 — Zeroth Law
// ══════════════════════════════════
function checkR0P1() {
  const g1 = [...document.getElementById('r0-group1').querySelectorAll('.drag-item')]
    .map(i => i.dataset.id).sort().join('');
  const g2 = [...document.getElementById('r0-group2').querySelectorAll('.drag-item')]
    .map(i => i.dataset.id).sort().join('');

  const correct = (g1 === 'ABD' && g2 === 'CE') || (g1 === 'CE' && g2 === 'ABD');

  if (correct) {
    showFeedback('r0p1-fb', true,
      'Perfect! A, B, and D are all in thermal equilibrium (same temperature). C and E share a different temperature. The Zeroth Law lets you build these chains without direct contact!');
    state.puzzlesDone.r0p1 = true;
    document.getElementById('r0p2').classList.remove('hidden');
  } else {
    const placed = document.querySelectorAll('#r0-group1 .drag-item, #r0-group2 .drag-item').length;
    if (placed < 5)
      showFeedback('r0p1-fb', false,
        'Drag all 5 objects into the two groups first. Use the clues: A=B, B=D, C=E, and A≠C.');
    else
      showFeedback('r0p1-fb', false,
        'Not quite. Re-read the clues: A=B means A and B are the same temperature. B=D links D to that group. C=E is a separate group. A≠C means the groups are at different temperatures.');
  }
}

// ══════════════════════════════════
//  ROOM 1 — First Law
// ══════════════════════════════════
const r1p2Data = [
  { text: 'A pot of water is heated on a stove (absorbs heat, no work done).', answer: 'increase' },
  { text: 'A gas expands in a piston, pushing it outward while losing heat to surroundings.', answer: 'decrease' },
  { text: 'You rub your hands together vigorously (friction adds heat).', answer: 'increase' },
  { text: 'A compressed gas is released into a vacuum (expands freely, no heat exchange).', answer: 'same' }
];
const r1p2Answers = {};

function buildR1P2() {
  const el = document.getElementById('r1p2-scenarios');
  if (el.children.length > 0) return;
  r1p2Data.forEach((d, i) => {
    el.innerHTML += `
      <div class="tf-item" id="r1p2-s${i}">
        <div class="tf-text">${d.text}</div>
        <div class="tf-buttons">
          <button class="tf-btn" onclick="selectR1P2(${i},'increase',this)">INCREASE</button>
          <button class="tf-btn" onclick="selectR1P2(${i},'decrease',this)">DECREASE</button>
          <button class="tf-btn" onclick="selectR1P2(${i},'same',this)">NO CHANGE</button>
        </div>
      </div>`;
  });
}

function selectR1P2(i, choice, btn) {
  r1p2Answers[i] = choice;
  document.getElementById('r1p2-s' + i).querySelectorAll('.tf-btn')
    .forEach(b => b.className = 'tf-btn');
  btn.classList.add('selected-true');
}

function checkR1P2() {
  if (Object.keys(r1p2Answers).length < r1p2Data.length) {
    showFeedback('r1p2-fb', false, 'Select an answer for every scenario before checking.');
    return;
  }
  let allCorrect = true;
  r1p2Data.forEach((d, i) => {
    const item = document.getElementById('r1p2-s' + i);
    item.classList.remove('answered-correct', 'answered-wrong');
    if (r1p2Answers[i] === d.answer) {
      item.classList.add('answered-correct');
    } else {
      item.classList.add('answered-wrong');
      allCorrect = false;
    }
  });
  if (allCorrect) {
    showFeedback('r1p2-fb', true,
      'All correct! Every energy transfer balances out — heat in, work out, internal energy changes accordingly. First Law verified.');
    state.puzzlesDone.r1p2 = true;
    document.getElementById('r1-next-btn').classList.remove('hidden');
  } else {
    showFeedback('r1p2-fb', false,
      'Some answers are off. Remember ΔU = Q − W. Heat IN with no work → increase. Work done AND heat lost → decrease. No heat exchange, no work → no change.');
  }
}

// ══════════════════════════════════
//  ROOM 2 — Second Law
// ══════════════════════════════════
const r2p1Data = [
  { text: 'Hot coffee cooling down in a cold room',              group: 'natural'   },
  { text: 'A cold room spontaneously heating a cup of coffee',   group: 'impossible'},
  { text: 'Ice melting on a warm countertop',                    group: 'natural'   },
  { text: 'A broken egg reassembling itself',                    group: 'impossible'},
  { text: 'Perfume spreading through a room after opening',      group: 'natural'   }
];

function buildR2P1() {
  const el = document.getElementById('r2p1-items');
  if (el.children.length > 0) return;
  const shuffled = [...r2p1Data].sort(() => Math.random() - 0.5);
  shuffled.forEach((d, i) => {
    el.innerHTML += `<div class="drag-item" draggable="true" data-id="${i}" data-group="${d.group}">${d.text}</div>`;
  });
}

function checkR2P1() {
  const natItems = [...document.getElementById('r2-natural').querySelectorAll('.drag-item')];
  const impItems = [...document.getElementById('r2-impossible').querySelectorAll('.drag-item')];
  if (natItems.length + impItems.length < r2p1Data.length) {
    showFeedback('r2p1-fb', false, 'Drag all scenarios into one of the two zones before checking.');
    return;
  }
  const allCorrect =
    natItems.every(i => i.dataset.group === 'natural') &&
    impItems.every(i => i.dataset.group === 'impossible');

  if (allCorrect) {
    showFeedback('r2p1-fb', true,
      'Correct! Processes that spread energy and increase disorder (coffee cooling, ice melting, perfume spreading) happen naturally. Processes that concentrate energy or reverse disorder violate the Second Law — they need external work.');
    state.puzzlesDone.r2p1 = true;
    document.getElementById('r2p2').classList.remove('hidden');
    buildR2P2();
  } else {
    showFeedback('r2p1-fb', false,
      'Not quite. Ask: does this process spread energy and increase disorder? If yes → natural. If it magically creates order from chaos → needs external work.');
  }
}

const r2p2Data = [
  { text: 'Ice cube (solid, rigid crystal structure)', order: 1, emoji: '❄️' },
  { text: 'Liquid water (molecules slide freely)',      order: 2, emoji: '💧' },
  { text: 'Steam (gas, molecules fly around)',          order: 3, emoji: '☁️' },
  { text: 'Steam dispersed throughout a large room',   order: 4, emoji: '🌫️' }
];

function buildR2P2() {
  const el = document.getElementById('r2-order-list');
  if (el.children.length > 0) return;
  const shuffled = [...r2p2Data].sort(() => Math.random() - 0.5);
  shuffled.forEach((d, i) => {
    el.innerHTML += `<div class="order-item" data-order="${d.order}">
      <div class="order-num">${i + 1}</div>
      <span>${d.emoji} ${d.text}</span>
    </div>`;
  });
  initOrderList('r2-order-list');
}

function checkR2P2() {
  const items = [...document.getElementById('r2-order-list').querySelectorAll('.order-item')];
  const correct = items.every((item, i) => parseInt(item.dataset.order) === i + 1);
  if (correct) {
    showFeedback('r2p2-fb', true,
      'Perfect order! From ice (low entropy, highly ordered) to dispersed steam (max disorder). The Second Law drives natural processes toward higher entropy.');
    state.puzzlesDone.r2p2 = true;
    document.getElementById('r2-next-btn').classList.remove('hidden');
  } else {
    showFeedback('r2p2-fb', false,
      'Not in the right order. Think: which state has the most rigid, ordered structure? Which has molecules spread out the most? Drag or click two items to swap.');
  }
  updateOrderNums('r2-order-list');
}

// ══════════════════════════════════
//  ROOM 3 — Third Law
// ══════════════════════════════════
const r3p1Data = [
  {
    text: 'At absolute zero (0 K), all molecular motion stops completely.',
    answer: false,
    explain: 'False. Quantum mechanics tells us particles retain zero-point energy at 0 K — they never fully stop. But at 0 K a perfect crystal has minimum possible entropy.'
  },
  {
    text: 'The entropy of a perfect crystal at absolute zero is exactly zero.',
    answer: true,
    explain: 'True! This is the formal statement of the Third Law. A perfect crystal at 0 K has only one possible microstate, so S = k·ln(1) = 0.'
  },
  {
    text: 'It is theoretically possible to cool an object to exactly 0 K in a finite number of steps.',
    answer: false,
    explain: 'False. The Third Law implies reaching absolute zero would require infinitely many cooling steps. Each step removes less heat than the last.'
  },
  {
    text: 'Absolute zero is −273.15°C (or 0 Kelvin).',
    answer: true,
    explain: 'True! 0 K = −273.15°C — the lowest possible temperature, where a system\'s entropy reaches its minimum.'
  }
];
const r3p1Answers = {};

function buildR3P1() {
  const el = document.getElementById('r3p1-items');
  if (el.children.length > 0) return;
  r3p1Data.forEach((d, i) => {
    el.innerHTML += `
      <div class="tf-item" id="r3p1-s${i}">
        <div class="tf-text">${d.text}</div>
        <div class="tf-buttons">
          <button class="tf-btn" onclick="selectR3TF(${i},true,this)">TRUE</button>
          <button class="tf-btn" onclick="selectR3TF(${i},false,this)">FALSE</button>
        </div>
      </div>`;
  });
}

function selectR3TF(i, val, btn) {
  r3p1Answers[i] = val;
  document.getElementById('r3p1-s' + i).querySelectorAll('.tf-btn')
    .forEach(b => b.className = 'tf-btn');
  btn.classList.add(val ? 'selected-true' : 'selected-false');
}

function checkR3P1() {
  if (Object.keys(r3p1Answers).length < r3p1Data.length) {
    showFeedback('r3p1-fb', false, 'Answer all four statements before checking.');
    return;
  }
  let allCorrect = true;
  const hints = [];
  r3p1Data.forEach((d, i) => {
    const item = document.getElementById('r3p1-s' + i);
    item.classList.remove('answered-correct', 'answered-wrong');
    if (r3p1Answers[i] === d.answer) {
      item.classList.add('answered-correct');
    } else {
      item.classList.add('answered-wrong');
      allCorrect = false;
      hints.push(d.explain);
    }
  });
  if (allCorrect) {
    showFeedback('r3p1-fb', true,
      'All correct! You understand the Third Law and what absolute zero really means.');
    state.puzzlesDone.r3p1 = true;
    document.getElementById('r3p2').classList.remove('hidden');
  } else {
    showFeedback('r3p1-fb', false, hints[0] + ' Fix your answers and try again.');
  }
}

// Temperature slider
function updateTemp() {
  const val = parseInt(document.getElementById('tempSlider').value);
  document.getElementById('tempDisplay').textContent = val + ' K';

  const entropyPct = Math.round((val / 300) * 100);
  document.getElementById('entropyFill').style.width = entropyPct + '%';
  document.getElementById('entropyVal').textContent = entropyPct + '%';

  const msg = document.getElementById('tempMessage');
  if (val <= 1) {
    msg.textContent = 'SO CLOSE TO 0 K... BUT YOU CAN\'T QUITE REACH IT.';
    msg.style.color = 'var(--accent)';
    document.getElementById('r3p2-question').classList.remove('hidden');
  } else if (val < 10) {
    msg.textContent = 'NEARLY THERE — ENTROPY ALMOST ZERO, BUT NOT QUITE.';
    msg.style.color = 'var(--accent)';
  } else if (val < 60) {
    msg.textContent = 'VERY COLD. MOLECULAR MOTION IS SLOWING DRAMATICALLY.';
    msg.style.color = '#888';
  } else if (val < 150) {
    msg.textContent = 'GETTING COLDER. ENTROPY DECREASING AS ORDER INCREASES.';
    msg.style.color = '#555';
  } else {
    msg.textContent = 'DRAG LEFT TO COOL...';
    msg.style.color = '#444';
  }
}

// ── Finale ──
function updateCert() {
  const name = document.getElementById('certName').value.trim();
  document.getElementById('certDisplay').textContent = name || '';
}

// ── Reset ──
function resetGame() {
  state.currentRoom = -1;
  state.completed = [false, false, false, false];
  Object.keys(state.puzzlesDone).forEach(k => state.puzzlesDone[k] = false);

  // Progress strip
  for (let i = 0; i < 4; i++) {
    const node = document.getElementById('pn' + i);
    node.classList.remove('active', 'done');
    node.textContent = i;
    if (i < 3) document.getElementById('pl' + i).classList.remove('done');
  }
  document.getElementById('pn0').classList.add('active');
  document.getElementById('progressStrip').style.display = '';

  // Body class
  document.body.className = '';

  // Feedback
  document.querySelectorAll('.feedback').forEach(f => {
    f.className = 'feedback';
    f.textContent = '';
  });

  // Hidden sections
  ['r0p2', 'r1p2', 'r2p2', 'r3p2'].forEach(id =>
    document.getElementById(id).classList.add('hidden'));
  ['r0-next-btn', 'r1-next-btn', 'r2-next-btn', 'r3-next-btn'].forEach(id =>
    document.getElementById(id).classList.add('hidden'));

  // Drag zones
  resetDragItems('r0p1-items', ['r0-group1', 'r0-group2']);
  resetDragItems('r2p1-items', ['r2-natural', 'r2-impossible']);

  // Energy slot
  const slot = document.getElementById('r1-slot1');
  const chipInSlot = slot.querySelector('.energy-chip');
  if (chipInSlot) document.getElementById('r1p1-chips').appendChild(chipInSlot);
  slot.classList.remove('filled');

  // R1P2 selections
  document.querySelectorAll('[id^="r1p2-s"]').forEach(el => {
    el.classList.remove('answered-correct', 'answered-wrong');
    el.querySelectorAll('.tf-btn').forEach(b => b.className = 'tf-btn');
  });
  Object.keys(r1p2Answers).forEach(k => delete r1p2Answers[k]);

  // R3P1 selections
  document.querySelectorAll('[id^="r3p1-s"]').forEach(el => {
    el.classList.remove('answered-correct', 'answered-wrong');
    el.querySelectorAll('.tf-btn').forEach(b => b.className = 'tf-btn');
  });
  Object.keys(r3p1Answers).forEach(k => delete r3p1Answers[k]);

  // Slider
  document.getElementById('tempSlider').value = 300;
  updateTemp();
  document.getElementById('r3p2-question').classList.add('hidden');
  document.querySelectorAll('#r3p2-question .mc-option').forEach(o => {
    o.className = 'mc-option';
    o.style.opacity = '';
    o.style.pointerEvents = '';
  });
  document.getElementById('r3p2-question').dataset.locked = '';

  // R2P2 order list
  document.getElementById('r2-order-list').innerHTML = '';

  // MC locks
  ['r0p2-opts', 'r3p2-question'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.dataset.locked = '';
      el.querySelectorAll('.mc-option').forEach(o => {
        o.className = 'mc-option';
        o.style.opacity = '';
        o.style.pointerEvents = '';
      });
    }
  });

  // Certificate
  document.getElementById('certName').value = '';
  document.getElementById('certDisplay').textContent = '';

  showScreen('intro');
}

function resetDragItems(sourceId, zoneIds) {
  const source = document.getElementById(sourceId);
  zoneIds.forEach(zid => {
    document.getElementById(zid).querySelectorAll('.drag-item').forEach(item => {
      item.classList.remove('in-zone');
      source.appendChild(item);
    });
  });
}

// ── Init on load ──
document.addEventListener('DOMContentLoaded', () => {
  buildR1P2();
  buildR2P1();
  buildR3P1();
  initDragDrop('r0p1-items', ['r0-group1', 'r0-group2']);
  initEnergySlots();
  // R2P1 drag needs items to exist in DOM first
  setTimeout(() => initDragDrop('r2p1-items', ['r2-natural', 'r2-impossible']), 50);
});
