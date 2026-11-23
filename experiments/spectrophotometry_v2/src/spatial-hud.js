import {SAMPLES, DRINK_SAMPLES, fitCalibration, instrumentDisplay} from './model.js';

const byId = id => document.getElementById(id);
const svgNS = 'http://www.w3.org/2000/svg';
const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
function plotMark(tag, attributes, title) {
  const mark = document.createElementNS(svgNS, tag);
  for (const [name, value] of Object.entries(attributes)) mark.setAttribute(name, value);
  const description = document.createElementNS(svgNS, 'title');
  description.textContent = title;
  mark.append(description);
  return mark;
}

export class SpatialHud {
  constructor(locateTarget) {
    this.shell = byId('spatialHud');
    this.nav = byId('spatialNav');
    this.wings = [byId('opticsWing'), byId('dataWing')];
    this.gestureHints = document.querySelectorAll('.flight-aim-tip,.flight-input span:last-child');
    this.compact = matchMedia('(max-width:767px), (max-width:960px) and (max-height:800px), (max-height:620px)');
    const footer = byId('benchFooter');
    const fitWings = new ResizeObserver(() => {
      if (!this.active || !this.compact.matches) return;
      const controlsTop = Math.min(this.nav.getBoundingClientRect().top, footer.querySelector('.bench-dock').getBoundingClientRect().top);
      this.shell.style.setProperty('--wing-room', Math.max(44, controlsTop - this.shell.getBoundingClientRect().bottom - 10) + 'px');
    });
    for (const el of [this.shell, footer, this.nav, byId('labCanvas')]) fitWings.observe(el);
    this.metric = 'absorbance';
    this.active = false;
    // Move the actual controls so focus, pressed state and event handlers have a single owner.
    this.mounts = [
      ['#hudProcedure', 'spatialGuide'], ['#immersiveProtocol', 'spatialGuide'],
      ['.camera-tools', 'spatialSession'], ['#immersiveNotebook', 'spatialNotebook'],
      ['.station-views', 'spatialViews'], ['#liveHandModes', 'spatialModes'], ['#wavelengthScale', 'spatialWavelength'],
      ['#helpButton', 'spatialHelpSlot']
    ].map(([selector, id]) => {
      const control = document.querySelector(selector);
      const home = document.createComment(selector);
      control.before(home);
      return {control, home, slot: byId(id)};
    });
    this.compact.addEventListener('change', () => { if (this.active) this.foldToFit(); });
    for (const wing of this.wings) wing.addEventListener('toggle', () => {
      if (wing.open && this.compact.matches) this.wings.find(other => other !== wing).open = false;
    });
    for (const button of this.shell.querySelectorAll('[data-locate-grip]')) {
      button.onclick = () => {
        locateTarget(button.dataset.locateGrip + '-grip');
        if (this.compact.matches) byId('opticsWing').open = false;
      };
    }
    for (const button of this.shell.querySelectorAll('[data-plot]')) {
      button.onclick = () => {
        this.metric = button.dataset.plot;
        if (this.state) this.drawPlot(this.state);
      };
    }
    byId('immersiveNotebook').setAttribute('aria-haspopup', 'dialog');
  }

  foldToFit() {
    this.shell.classList.toggle('compact', this.compact.matches);
    this.wings.forEach(wing => { wing.open = !this.compact.matches; });
  }

  enable(active) {
    if (this.active === active) return;
    this.active = active;
    const focus = document.activeElement;
    byId('immersiveProtocol').textContent = active ? 'Protocol' : 'Procedure';
    this.shell.hidden = this.nav.hidden = !active;
    for (const {control, slot, home} of this.mounts) {
      if (active) slot.append(control);
      else home.after(control);
    }
    if (active) {
      this.foldToFit();
      this.plotStep = null;
    }
    if (focus !== document.body && focus.getClientRects().length) focus.focus({preventScroll: true});
  }

  update(state, hands, panelOpen) {
    if (!this.active) return;
    this.shell.classList.toggle('panels-open', panelOpen);
    const tracked = hands.camera.modelReady && performance.now() - hands.lastSeen < 450;
    const link = tracked ? 'Tracking' : hands.camera.modelReady ? 'Show your hand' : 'Starting tracker';
    this.nav.dataset.tracked = String(tracked);
    setText(byId('handLinkState'), link);
    const gestureHint = hands.held || hands.interaction.owner === 'hand' ? 'Release for panels' : 'Pinch to click';
    for (const hint of this.gestureHints) setText(hint, gestureHint);
    this.updateOptics(state);
    if (this.state !== state || this.plotStep !== state.step || this.fitted !== state.analysis.fitted) this.drawPlot(state);
    this.state = state;
  }

  updateOptics(state) {
    const {reading, caption} = instrumentDisplay(state);
    const {inserted, source} = state.cuvette;
    const sample = !inserted ? '' : SAMPLES.find(s => s.id === source)?.name ||
      DRINK_SAMPLES.find(([id]) => id === (source === 'unknownBottle' ? 'unknown' : source))?.[1] || 'Cuvette seated';
    const status = sample ? sample + ' · ' + caption : caption;
    if (this.opticsStatus === status && this.opticsReading === reading && this.wavelength === state.wavelength) return;
    const wing = this.wings[0];
    wing.dataset.open = String(!!state.lidOpen);
    wing.dataset.seated = String(inserted);
    wing.dataset.measured = String(!!reading);
    // Hue indicates the selected visible band. Only an acquired reading drives the detector.
    const hue = Math.max(0, 9 + (630 - state.wavelength) * 1.14);
    wing.style.setProperty('--beam-color', `hsl(${hue} 86% 64%)`);
    wing.style.setProperty('--transmitted', String(reading ? reading.percentT / 100 : 0));
    setText(byId('opticsSignal'), reading ? reading.percentT.toFixed(1) : '—');
    setText(byId('opticsAbsorbance'), reading ? reading.absorbance.toFixed(4) : '—');
    setText(byId('opticsState'), status);
    byId('hudOpticalPath').setAttribute('aria-label', `${state.wavelength} nm optical path. ${status}. ` +
      (reading ? `Measured transmittance ${reading.percentT.toFixed(1)} percent.` : 'Awaiting a measurement.'));
    this.opticsStatus = status;
    this.opticsReading = reading;
    this.wavelength = state.wavelength;
  }

  drawPlot(state) {
    this.plotStep = state.step;
    this.fitted = state.analysis.fitted;
    const absorbance = this.metric === 'absorbance';
    const points = SAMPLES.map(sample => state.results[sample.id]).filter(Boolean);
    const drinks = DRINK_SAMPLES.map(([id]) => state.results[id]);
    const levels = [...points, ...drinks.filter(Boolean)].map(sample => sample.absorbance);
    const max = absorbance ? Math.ceil(Math.max(.4, ...levels) * 10) / 10 : 100;
    const x = c => 31 + 180 * c / 2.5, y = v => 64 - 56 * v / max;
    const marks = document.createDocumentFragment();
    if (state.analysis.fitted) {
      const fit = fitCalibration(state);
      const segments = absorbance ? 1 : 24;
      let path = '';
      for (let i = 0; i <= segments; i++) {
        const c = fit.maxConcentration * i / segments, a = fit.slope * c;
        path += (i ? 'L' : 'M') + x(c) + ' ' + y(absorbance ? a : 100 * 10 ** -a);
      }
      marks.append(plotMark('path', {d:path, class:'measured-fit'}, absorbance ? 'Fitted absorbance' : 'Fitted percent transmittance'));
    }
    const legend = byId('hudUnknowns');
    const descriptions = [];
    for (const [i, reading] of drinks.entries()) {
      const row = legend.children[i];
      row.hidden = !reading;
      if (!reading) continue;
      const value = absorbance ? reading.absorbance.toFixed(4) + ' A' : reading.percentT.toFixed(1) + ' %T';
      const description = DRINK_SAMPLES[i][1] + ' ' + value;
      setText(row.querySelector('dd'), value);
      descriptions.push(description);
      // The observed signal has a y coordinate. Its concentration is the learner's unknown.
      marks.append(plotMark('path', {d:'M31 ' + y(reading[this.metric]) + 'H211', class:'drink-signal' + (i ? ' diluted' : '')}, description));
    }
    legend.hidden = !descriptions.length;
    for (const p of points) {
      marks.append(plotMark('circle', {cx:x(p.concentration), cy:y(p[this.metric]), r:3.2},
        p.concentration + ' µM, ' + (absorbance ? p.absorbance.toFixed(4) + ' A' : p.percentT.toFixed(1) + ' %T')));
    }
    byId('hudPlotMarks').replaceChildren(marks);
    byId('plotEmpty').style.display = points.length ? 'none' : '';
    const unit = absorbance ? 'Absorbance' : 'Transmittance (%)';
    setText(byId('hudPlotUnit'), unit);
    setText(byId('plotYHigh'), String(max));
    setText(byId('plotYMid'), String(max / 2));
    setText(byId('hudStandards'), points.length + ' / ' + SAMPLES.length);
    byId('hudPlot').setAttribute('aria-label', [unit + ' against Blue #1 concentration', points.length + ' of 6 standards recorded', ...descriptions].join('. ') + '.');
    for (const b of this.shell.querySelectorAll('[data-plot]')) b.setAttribute('aria-pressed', String(b.dataset.plot === this.metric));
  }
}
