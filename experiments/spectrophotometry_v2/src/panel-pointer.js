import {HandGestures} from './view-gestures.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const controlSelector = 'button,summary,input,select,textarea,a[href],label,#handPreview';
const blocked = el => el?.matches(':disabled,[aria-disabled="true"]') || el?.closest('[inert]');
const fire = (el, type) => el.dispatchEvent(new Event(type, {bubbles: true}));

function scrollParent(el) {
  for (let p = el; p && p !== document.body; p = p.parentElement) {
    const css = getComputedStyle(p);
    if ((p.scrollHeight > p.clientHeight + 2 && /auto|scroll/.test(css.overflowY)) ||
        (p.scrollWidth > p.clientWidth + 2 && /auto|scroll/.test(css.overflowX))) return p;
  }
  return null;
}

function controlAt(hit) {
  const el = hit?.closest(controlSelector);
  const control = el?.tagName === 'LABEL' ? el.control : el;
  return control && !blocked(control) ? control : null;
}

function adjustRange(input, clientX) {
  const rect = input.getBoundingClientRect();
  const inset = (parseFloat(getComputedStyle(input).getPropertyValue('--thumb-width')) || 16) / 2;
  let fraction = clamp((clientX - rect.left - inset) / Math.max(1, rect.width - 2 * inset), 0, 1);
  if (getComputedStyle(input).direction === 'rtl') fraction = 1 - fraction;
  const lo = Number(input.min || 0), hi = Number(input.max || 100);
  const previous = input.value;
  input.valueAsNumber = lo + fraction * (hi - lo); // The native range clamps and snaps to its step.
  if (input.value !== previous) fire(input, 'input');
}

function handFieldDialog(field, content) {
  const dialog = document.createElement('dialog');
  dialog.className = 'hand-choice visor-panel';
  dialog.setAttribute('aria-labelledby', 'handChoiceTitle');
  dialog.innerHTML = '<header><h2 id="handChoiceTitle"></h2><button type="button" aria-label="Close without applying">×</button></header>' + content;
  dialog.querySelector('h2').textContent = field.getAttribute('aria-label') || field.labels[0]?.textContent.trim() || 'Edit value';
  dialog.querySelector('header button').onclick = () => dialog.close();
  dialog.addEventListener('click', e => {
    if (e.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (document.activeElement === document.body && field.getClientRects().length && !blocked(field)) field.focus({preventScroll:true});
  }, {once:true});
  document.body.append(dialog);
  return dialog;
}

// The native option popup and OS keyboard are outside camera hit testing.
function chooseOption(select) {
  const dialog = handFieldDialog(select,
    '<div class="choices"></div><footer><button type="button">Previous</button><span></span><button type="button">Next</button></footer>');
  const options = Array.from(select.options).filter(o => !o.hidden);
  const size = innerHeight < 450 ? 3 : 5;
  let page = Math.floor(Math.max(0, options.indexOf(select.selectedOptions[0])) / size);
  const [prev, next] = dialog.querySelectorAll('footer button'), footer = dialog.querySelector('footer');
  function draw() {
    const items = options.slice(page * size, (page + 1) * size).map(option => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = option.text;
      b.disabled = option.disabled || !!option.closest('optgroup:disabled');
      b.setAttribute('aria-pressed', String(option.selected));
      b.onclick = () => {
        const changed = select.selectedIndex !== option.index;
        select.selectedIndex = option.index;
        dialog.close();
        if (changed) { fire(select, 'input'); fire(select, 'change'); }
      };
      return b;
    });
    dialog.querySelector('.choices').replaceChildren(...items);
    const pages = Math.ceil(options.length / size);
    footer.hidden = pages <= 1;
    footer.querySelector('span').textContent = (page + 1) + ' / ' + pages;
    prev.disabled = page === 0;
    next.disabled = page >= pages - 1;
  }
  prev.onclick = () => { page--; draw(); };
  next.onclick = () => { page++; draw(); };
  draw();
  dialog.showModal();
}

function enterNumber(input) {
  const dialog = handFieldDialog(input, '<div class="number-line"><span></span><output aria-live="polite"></output></div>' +
    '<div class="digit-keys"></div><footer><button type="button">Clear</button><button type="button">Apply value</button></footer>');
  const [clear, apply] = dialog.querySelectorAll('footer button');
  const probe = input.cloneNode(false); // Reuse the field's native min, max and step validation.
  let draft = input.value, replace = true;
  dialog.querySelector('.number-line span').textContent = input.max ? input.min + '–' + input.max : input.min ? 'Minimum ' + input.min : '';
  function draw() {
    probe.value = draft;
    apply.disabled = !Number.isFinite(probe.valueAsNumber) || !probe.validity.valid;
    dialog.querySelector('output').textContent = draft || '—';
  }
  for (const key of ['7','8','9','4','5','6','1','2','3','.','0','⌫']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = key;
    if (key === '⌫') button.setAttribute('aria-label', 'Delete last digit');
    button.disabled = key === '.' && Number.isInteger(Number(input.step || 1));
    button.onclick = () => {
      if (key === '⌫') draft = draft.slice(0,-1);
      else {
        if (replace) draft = '';
        if (key !== '.' || !draft.includes('.')) draft += key === '.' && !draft ? '0.' : key;
      }
      replace = false;
      draw();
    };
    dialog.querySelector('.digit-keys').append(button);
  }
  clear.onclick = () => { draft = ''; replace = false; draw(); };
  apply.onclick = () => {
    const value = String(probe.valueAsNumber), changed = input.value !== value;
    input.value = value;
    dialog.close();
    if (changed) { fire(input,'input'); fire(input,'change'); }
  };
  draw();
  dialog.showModal();
}

export class PanelPointer {
  constructor(pickBenchControl, activateBenchControl) {
    this.cursor = document.getElementById('panelPointer');
    this.pickBenchControl = pickBenchControl;
    this.activateBenchControl = activateBenchControl;
    // Keep UI identity through changes to camera framing, bench views and working-tool state.
    this.tracker = new HandGestures();
    this.cancel();
  }

  highlight(el, down) {
    if (this.hover !== el) this.hover?.removeAttribute('data-hand-hover');
    this.hover = el;
    if (el) el.dataset.handHover = down ? 'pressed' : 'aim';
  }

  get targetName() {
    const el = this.hover;
    if (!el || this.cursor.hidden) return '';
    return el.getAttribute('aria-label') || el.labels?.[0]?.textContent.trim() ||
      el.textContent.trim() || el.title;
  }

  cancel() {
    this.tracker.reset();
    this.owner = null;
    this.aim = null;
    this.benchTarget = null;
    this.press = null;
    this.captured = false;
    this.ready = false;
    this.cursor.hidden = true;
    this.highlight(null, false);
  }

  releaseLayer() {
    this.cancel();
    document.querySelector('dialog.hand-choice[open]')?.close();
    document.body.append(this.cursor);
  }

  activate(el, x, y) {
    if (!el.isConnected || blocked(el)) return;
    el.focus?.({preventScroll: true});
    const init = {bubbles: true, cancelable: true, clientX: x, clientY: y, pointerType: 'mouse', isPrimary: true, button: 0};
    el.dispatchEvent(new PointerEvent('pointerdown', {...init, buttons: 1}));
    el.dispatchEvent(new PointerEvent('pointerup', {...init, buttons: 0}));
    if (el instanceof HTMLSelectElement) chooseOption(el);
    else if (el instanceof HTMLInputElement && el.type === 'number' && !el.readOnly) enterNumber(el);
    else el.dispatchEvent(new MouseEvent('click', init));
  }

  // Camera images use the calibrated reach rectangle. Landmark-only replays use
  // normalized viewport coordinates. Neither depends on the webcam picture size.
  update(packet, {aspect, mirrored, reach, preference, canvas, benchEnabled}) {
    const stamp = packet.stamp;
    const events = this.tracker.update(packet, stamp, aspect, mirrored);
    const allowed = e => e.points && (preference === 'Auto' || e.label === preference);
    const prior = events.find(e => e.id === this.owner);
    const event = prior && allowed(prior) ? prior : events.find(allowed);
    if (!event || event.id !== this.owner) {
      this.press = null;
      this.aim = this.benchTarget = null;
      this.captured = false;
      this.ready = false;
      this.cursor.hidden = true;
      this.highlight(null, false);
      this.owner = event?.id;
    }
    if (!event) return null;
    const bounds = this.press?.reach || reach;
    const open = event.pinch > .53;
    // At release use this exposure's index. A smoothed cursor can still be on
    // the other side of a button boundary after the hand has reopened.
    const tip = this.press && open ? event.indexTip : event.points[8];
    const x = clamp((tip.x - bounds.left) / bounds.width, 0, 1) * (innerWidth - 1);
    const y = clamp((tip.y - bounds.top) / bounds.height, 0, 1) * (innerHeight - 1);
    const hit = document.elementFromPoint(x, y);
    const modal = document.querySelector('dialog.hand-choice[open]') || document.querySelector('dialog[open]');
    const el = controlAt(hit);
    const outsideMenu = hit === canvas && document.querySelector('.dock-entry[open]');
    const panel = hit && hit !== canvas && hit.closest('#spatialHud,#spatialNav,.visor-panel,.bench-dock');
    const overUI = !!(modal || panel || el);
    const grip = event.curled[0] && event.closure >= .65;
    const pinched = event.pinch < .32 && !grip;
    const pointing = event.pointing;
    const pressed = this.press;
    // Use the same hit geometry as the mouse. A palm passing over a key while
    // reaching for glassware keeps its ordinary grasp semantics.
    const pickBench = benchEnabled && hit === canvas && !outsideMenu &&
      (pointing || pressed?.region || (!open && this.aim?.region));
    const region = pickBench ? this.pickBenchControl(x, y) : null;

    if (pressed) {
      if (pressed.modal !== modal || (pressed.region && !benchEnabled) ||
          (pressed.el && (!pressed.el.isConnected || blocked(pressed.el))) || grip) {
        this.press = null;
      } else if (open) {
        this.press = null;
        if (pressed.confirmed) {
          if (pressed.range) {
            if (pressed.initial !== pressed.el.value) fire(pressed.el, 'change');
          } else if (pressed.el && !pressed.scrolling && el === pressed.el) {
            this.activate(el, x, y);
          } else if (pressed.region && region === pressed.region) {
            this.activateBenchControl(region);
          } else if (pressed.menu && hit === canvas) {
            pressed.menu.open = false;
          } else if (pressed.backdrop && hit === modal) {
            modal.dispatchEvent(new MouseEvent('click', {bubbles: true, clientX: x, clientY: y}));
          }
        }
      } else {
        if (pinched && stamp - pressed.since >= 35) pressed.confirmed = true;
        if (pressed.confirmed && pressed.range) {
          this.adjusting = true;
          try { adjustRange(pressed.el, x); } finally { this.adjusting = false; }
        } else if (pressed.confirmed && pressed.scroll) {
          const dx = pressed.x - x, dy = pressed.y - y;
          if (Math.hypot(dx, dy) > 14) pressed.scrolling = true;
          if (pressed.scrolling) pressed.scroll.scrollTo(pressed.left + dx, pressed.top + dy);
        }
      }
    } else if (pinched && this.ready) {
      this.ready = false;
      // Capture the last open-finger aim. The index commonly bends toward the
      // neighboring button as the thumb closes. Only reopening on the original
      // control completes its click.
      const aim = this.aim;
      const sameTarget = aim && aim.el === el && aim.region === region;
      const nearAim = aim && Math.hypot(x - aim.x, y - aim.y) <= 18;
      if (aim?.modal === modal && (sameTarget || nearAim) && (overUI || outsideMenu || region || aim.region)) {
        const scroll = scrollParent(hit);
        const box = modal?.getBoundingClientRect();
        this.press = {el:aim.el, region:aim.region, modal, reach, x, y, since: stamp, range:aim.el?.type === 'range', initial:aim.el?.value,
          scroll, left: scroll?.scrollLeft, top: scroll?.scrollTop, menu: outsideMenu,
          backdrop: hit === modal && box && (x < box.left || x > box.right || y < box.top || y > box.bottom)};
      }
    }
    if (open && !grip) {
      this.ready = true;
      this.aim = {el, region, x, y, modal};
    }
    if (grip) { this.ready = false; this.aim = null; }
    this.captured = !!(this.press || pressed);
    const consume = overUI || !!region || this.captured;
    // Actions can synchronously dismiss dialogs, switch modes or turn off the camera.
    if (!document.body.classList.contains('hand-console')) { this.cancel(); return event; }
    const layer = document.querySelector('dialog.hand-choice[open]') || document.querySelector('dialog[open]') || document.body;
    if (this.cursor.parentNode !== layer) layer.append(this.cursor);
    this.benchTarget = this.press?.region || region;
    this.cursor.hidden = !consume && !(benchEnabled && pointing);
    if (!this.cursor.hidden) {
      this.cursor.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)';
      this.cursor.dataset.down = String(!!this.press);
      this.cursor.dataset.aim = el || this.benchTarget || this.press ? 'target' : 'free';
    }
    const hovered = this.press ? (this.press.el === el ? el : null) : el;
    this.highlight(hovered?.isConnected ? hovered : null, !!this.press);
    return consume ? event : null;
  }
}
