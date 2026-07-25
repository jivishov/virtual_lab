/**
 * sim.js — Procedure state machine, flow physics, error sources, scoring.
 *
 * Design rule for this file: nothing is scripted. The student's recorded
 * numbers drive their result, the true state of the glassware drives the
 * chemistry, and the two are only compared at the debrief. If they misread a
 * meniscus, they get a wrong answer — same as in the real lab.
 */

import * as THREE from 'three';
import {
  Solution, NAOH_NOMINAL_M, PHENOLPHTHALEIN, solutionRGB, solutionOpacity,
  VISIBLE_PINK, equivalenceVolume, stats,
} from './chem.js';
import { DROP_ML, SCALE_ML } from './apparatus.js';
import { PARK, STATION, TILE_Y, BENCH_Y } from './lab.js';

export const ALIQUOT_ML = 25.00;
export const TRIALS_REQUIRED = 3;      // 1 scouting + 2 for precision

/**
 * Stopcock opening below which the flow breaks into discrete drops instead of
 * a stream. At this setting the rate is ~0.15 mL/s, about three drops a
 * second, which is what a trickle looks like on the bench.
 */
export const DRIP_OPEN = 0.28;

/** Actions that put the student in contact with reagents. */
const CHEM_ACTIONS = new Set([
  'rinse:burette', 'fill:burette', 'rinse:pipette', 'pipette:fill',
  'pipette:deliver', 'add:indicator', 'rinse:walls', 'empty:flask', 'stopcock',
]);

const ALWAYS_ALLOWED = new Set(['swirl', 'toggle:probe', 'stage:flask', 'stage:waste']);

class Emitter {
  constructor() { this._h = {}; }
  on(ev, fn) { (this._h[ev] ||= []).push(fn); return this; }
  emit(ev, payload) { (this._h[ev] || []).forEach((f) => f(payload)); }
}

export class Sim extends Emitter {
  constructor({ stage, lab, burette, drops, plume, ripples, sfx }) {
    super();
    this.stage = stage;
    this.lab = lab;
    this.burette = burette;
    this.drops = drops;
    this.plume = plume;
    this.ripples = ripples;
    this.sfx = sfx;

    this.flask = new Solution();
    this.tweens = [];
    this.pending = [];          // stream volume in transit
    this.curve = [];            // [volume, pH] for the live chart
    this.paused = true;

    this._pickUnknown();
    this._buildSteps();
    this.reset();
  }

  // ---------------------------------------------------------------- setup --
  _pickUnknown() {
    const ca = 0.085 + Math.random() * 0.050;
    this.unknown = {
      id: `HCl-${String(Math.floor(Math.random() * 90) + 10)}`,
      ca: Math.round(ca * 10000) / 10000,
    };
  }

  reset() {
    this.stepIndex = 0;
    this.clock = 0;
    this.swirl = 0;
    this.swirlTotal = 0;
    this.station = 'none';
    this.spillML = 0;
    this.probeIn = false;
    this.indicatorDrops = 0;
    this.buretteConditioned = 0;
    this.pipetteConditioned = false;
    this.pipetteState = 'empty';
    this._sinceCharge = 0;
    this.trials = [];
    this.trial = null;
    this.answer = null;
    this.violations = [];
    this.notes = new Set();
    this.flask.reset();
    this.burette.reading = SCALE_ML;
    this.burette.setBubble(false);
    this.stopcockLocked = true;
    this.finished = false;
  }

  // ---------------------------------------------------------------- steps --
  _buildSteps() {
    const V = () => this.flask.volumeML;
    this.steps = [
      {
        id: 'brief', title: 'Mission briefing',
        brief: 'Determine the molarity of the unknown HCl by titration against standardised 0.1000 M NaOH.',
        hint: 'Read the briefing card, then begin.',
        allow: [], done: () => this.notes.has('briefed'),
      },
      {
        id: 'ppe', title: 'Personal protective equipment',
        brief: 'Put on splash goggles, nitrile gloves and a lab coat before you touch any reagent.',
        hint: 'Click the goggles, the glove box and the lab coat.',
        allow: ['wear:goggles', 'wear:gloves', 'wear:coat'],
        done: () => this.ppe.goggles && this.ppe.gloves && this.ppe.coat,
      },
      {
        id: 'inspect', title: 'Inspect the burette',
        brief: 'Check the stopcock turns freely and the tip is intact. The barrel is clean but wet with rinse water.',
        hint: 'Click the burette barrel to inspect it.',
        allow: ['inspect:burette'], done: () => this.notes.has('inspected'),
      },
      {
        id: 'condition', title: 'Condition the burette',
        brief: 'That water film would dilute your titrant. Rinse the burette twice with the NaOH itself and drain to waste.',
        hint: 'Slide the waste beaker under the tip, then rinse with titrant — twice. You may skip it, and find out why you should not have.',
        allow: ['stage:waste', 'rinse:burette', 'skip:step'],
        skippable: true,
        skipNote: 'Skipping the conditioning rinses. The barrel is still wet with water, which will dilute the titrant.',
        done: () => this.buretteConditioned >= 2 || this.notes.has('skipped:condition'),
      },
      {
        id: 'charge', title: 'Charge the burette',
        brief: 'Fill above the 0.00 mL graduation using the funnel, then remove the funnel.',
        hint: 'Keep the waste beaker under the tip, then click the funnel to charge.',
        allow: ['fill:burette', 'stage:waste'],
        done: () => this.burette.reading < -0.05,
      },
      {
        id: 'purge', title: 'Purge the tip',
        brief: 'Expel the air bubble below the stopcock and bring the meniscus onto the scale, near 0.00 mL.',
        hint: 'With the waste beaker underneath, open the stopcock wide for a moment, then trim to just under 0.00.',
        allow: ['stage:waste', 'stopcock', 'skip:step'],
        skippable: true,
        skipNote: 'Leaving the air in the tip. You still have to bring the meniscus onto the scale before you can read it.',
        // the meniscus must reach the scale either way — you cannot read a
        // level that sits above the 0.00 mark
        done: () => (!this.burette.hasBubble || this.notes.has('skipped:purge'))
          && this.burette.reading >= 0 && this.burette.reading <= 3
          && this.station !== 'none',
      },
      {
        id: 'initial', title: 'Record the initial reading',
        brief: 'Read the bottom of the meniscus to the nearest 0.01 mL, eye level with the surface.',
        hint: 'Press R (or use the READ button) to take the reading.',
        allow: ['read:initial', 'stage:flask'], done: () => this.trial !== null,
      },
      {
        id: 'aliquot', title: 'Pipette the aliquot',
        brief: `Condition the pipette with the unknown, then deliver ${ALIQUOT_ML.toFixed(2)} mL of HCl into the flask.`,
        hint: 'Rinse the pipette with sample first — residual water dilutes your aliquot.',
        allow: ['rinse:pipette', 'pipette:fill', 'pipette:deliver', 'stage:flask'],
        done: () => this.flask.nH > 0,
      },
      {
        id: 'indicator', title: 'Add indicator',
        brief: 'Two or three drops of phenolphthalein. No more — the indicator consumes titrant too.',
        hint: 'Click the phenolphthalein bottle once per drop.',
        allow: ['add:indicator', 'stage:flask', 'rinse:walls'],
        done: () => this.indicatorDrops >= 2,
      },
      {
        id: 'titrate', title: this._titrateTitle.bind(this),
        brief: 'Deliver titrant while swirling. Slow to drop-by-drop as the pink flash starts to persist, and stop at the first permanent faint pink.',
        hint: 'Hold SPACE for fast flow, S for a trickle, D for one drop. W swirls. Rinse the walls before you call it.',
        allow: ['stopcock', 'swirl', 'rinse:walls', 'read:final', 'stage:flask', 'add:indicator'],
        done: () => false,          // ends when the student records the reading
      },
      {
        id: 'dump', title: 'Reset for the next trial',
        brief: 'Discard the titrated solution and rinse the flask with deionised water.',
        hint: 'Click the flask to empty it into the waste beaker, then rinse it.',
        allow: ['empty:flask', 'rinse:walls', 'stage:waste', 'stage:flask'],
        done: () => V() < 1.0 && this.notes.has('dumped'),
      },
      {
        id: 'calculate', title: 'Calculate the result',
        brief: 'Work out the molarity of the unknown from your concordant titres and submit it.',
        hint: 'n(NaOH) = c·V, and HCl + NaOH react 1:1.',
        allow: ['submit:answer'], done: () => this.answer !== null,
      },
      { id: 'debrief', title: 'Debrief', brief: 'Flight review.', hint: '', allow: [], done: () => false },
    ];
    this._index = {};
    this.steps.forEach((s, i) => { this._index[s.id] = i; });
  }

  _titrateTitle() {
    if (this.trials.length >= TRIALS_REQUIRED) return 'Titrations complete';
    const n = this.trials.length + 1;
    return n === 1 ? 'Trial 1 — scouting titration' : `Trial ${n} — precision titration`;
  }

  get step() { return this.steps[this.stepIndex]; }
  get stepTitle() {
    const t = this.step.title;
    return typeof t === 'function' ? t() : t;
  }
  get ppe() { return (this._ppe ||= { goggles: false, gloves: false, coat: false }); }

  get isRoughTrial() { return this.trials.length === 0; }

  /** Titrant molarity actually in the barrel (conditioning matters). */
  get cbEffective() { return this._cbEff ?? NAOH_NOMINAL_M; }

  begin() {
    this.notes.add('briefed');
    this.paused = false;
    this._advance();
    this.emit('step', this.step);
  }

  _advance() {
    let guard = 0;
    while (guard++ < 12 && this.step.done()) {
      // The trial loop: dumping the flask sends you back for another charge.
      if (this.step.id === 'dump') {
        if (this.trials.length < TRIALS_REQUIRED) {
          this._resetForNextTrial();
          this._goto('charge');
        } else {
          this._goto('calculate');
        }
        return;
      }
      if (this.stepIndex >= this.steps.length - 1) break;
      this.stepIndex++;
      this.emit('step', this.step);
    }
    this._lockStopcockIfNeeded();
    this.emit('state', this);
  }

  /**
   * Leaving a step that permitted flow shuts the tap, the way you would close
   * it before reading the scale.
   */
  _lockStopcockIfNeeded() {
    this.stopcockLocked = !this._allows('stopcock');
    if (this.stopcockLocked && this.burette.open > 0) {
      this.burette.setStopcockOpen(0);
      this.emit('closeStopcock');
    }
  }

  _resetForNextTrial() {
    this.notes.delete('dumped');
    this.pipetteState = 'empty';
    this.indicatorDrops = 0;
    this.curve = [];
  }

  _goto(id) {
    this.stepIndex = this._index[id];
    this._lockStopcockIfNeeded();
    this.emit('step', this.step);
    this.emit('state', this);
  }

  _allows(action) {
    if (ALWAYS_ALLOWED.has(action)) return true;
    return this.step.allow.includes(action);
  }

  // -------------------------------------------------------------- actions --
  /** Single entry point for every student action. Returns a result object. */
  attempt(action, payload) {
    if (this.finished && action !== 'restart') return this._deny('The session is over — review your debrief.');

    if (!this._allows(action)) {
      return this._deny(`Not part of "${this.stepTitle}". ${this.step.hint}`);
    }
    if (CHEM_ACTIONS.has(action) && !(this.ppe.goggles && this.ppe.gloves)) {
      this._violation('Handled reagents without goggles and gloves.');
      return this._deny('Goggles and gloves first. Always.');
    }

    const fn = this[`_do_${action.replace(':', '_')}`];
    if (!fn) return this._deny('Nothing to do there.');
    const res = fn.call(this, payload) || { ok: true };
    if (res.ok !== false) this._advance();
    return res;
  }

  _deny(message) {
    this.emit('deny', message);
    return { ok: false, message };
  }

  _violation(text) {
    if (!this.violations.includes(text)) {
      this.violations.push(text);
      this.emit('violation', text);
      this.sfx?.alarm();
    }
  }

  _do_wear_goggles() { this.ppe.goggles = true; this.lab.goggles.visible = false; this.sfx?.click(); this.emit('ppe', this.ppe); return { ok: true, message: 'Goggles on.' }; }
  _do_wear_gloves() { this.ppe.gloves = true; this.sfx?.click(); this.emit('ppe', this.ppe); return { ok: true, message: 'Gloves on.' }; }
  _do_wear_coat() { this.ppe.coat = true; this.lab.coat.visible = false; this.sfx?.click(); this.emit('ppe', this.ppe); return { ok: true, message: 'Lab coat on.' }; }

  /**
   * Deviate from the checklist on purpose. A real checklist can be ignored;
   * what it cannot do is hide the consequence, so the skip is recorded and the
   * resulting systematic error is left to propagate on its own.
   */
  _do_skip_step() {
    if (!this.step.skippable) return this._deny('This step cannot be skipped.');
    this.notes.add(`skipped:${this.step.id}`);
    this.emit('note', this.step.skipNote);
    return { ok: true };
  }

  _do_inspect_burette() {
    this.notes.add('inspected');
    this.sfx?.click();
    return {
      ok: true,
      message: 'Stopcock turns freely, tip intact. The barrel is wet with deionised water from washing.',
    };
  }

  _do_stage_waste() { return this._stage('waste'); }
  _do_stage_flask() { return this._stage('flask'); }

  _stage(which) {
    if (this.station === which) return { ok: true, message: 'Already in position.' };
    const other = which === 'flask' ? 'waste' : 'flask';
    const moveTo = (vessel, dest, y) => {
      this.tweens.push({
        obj: vessel.group, from: vessel.group.position.clone(),
        to: new THREE.Vector3(dest.x, y, dest.z), t: 0, dur: 0.55,
        onUpdate: () => vessel.refreshClip(),
      });
    };
    // park whatever is currently at the station
    if (this.station === 'flask') moveTo(this.lab.flask, PARK.flask, TILE_Y);
    if (this.station === 'waste') moveTo(this.lab.waste, PARK.waste, BENCH_Y);
    const v = which === 'flask' ? this.lab.flask : this.lab.waste;
    moveTo(v, new THREE.Vector3(STATION.x, 0, STATION.z), which === 'flask' ? TILE_Y : BENCH_Y);
    this.station = which;
    this.sfx?.clink();
    return { ok: true, message: `${which === 'flask' ? 'Flask' : 'Waste beaker'} under the tip.` };
  }

  _do_rinse_burette() {
    if (this.station !== 'waste') return this._deny('Put the waste beaker under the tip first.');
    this.buretteConditioned++;
    this.lab.waste.setVolume(this.lab.waste.volumeML + 6);
    this.sfx?.pour(0.5);
    const n = this.buretteConditioned;
    return {
      ok: true,
      message: n >= 2
        ? 'Second rinse drained. The barrel is now wetted with titrant, not water.'
        : 'Rinsed with ~6 mL titrant and drained. Once more.',
    };
  }

  _do_fill_burette() {
    if (this.station === 'flask') return this._deny('Move the flask away before charging the burette.');
    // Conditioning decides whether the residual film is water or titrant.
    const residueML = this.buretteConditioned >= 2 ? 0 : this.buretteConditioned === 1 ? 0.12 : 0.35;
    const chargeML = 51.2;
    this._cbEff = NAOH_NOMINAL_M * (chargeML / (chargeML + residueML));
    if (residueML > 0) this.notes.add('dilutedTitrant');

    this.burette.reading = -1.0;
    // The first charge traps air below the stopcock; later top-ups do not,
    // because the tip is already full of liquid.
    if (!this.notes.has('charged')) {
      this.burette.setBubble(true);
      this._bubbleReleaseAt = 2.5 + Math.random() * 5.0;
    }
    this.notes.add('charged');
    this._sinceCharge = 0;
    this._animateFunnel();
    this.sfx?.pour(0.8);
    return {
      ok: true,
      message: residueML > 0
        ? 'Charged to about −1.0 mL. Note: an unconditioned barrel dilutes the titrant.'
        : 'Charged to about −1.0 mL. There is air trapped below the stopcock.',
    };
  }

  _animateFunnel() {
    const f = this.lab.funnel;
    const home = f.userData.home || (f.userData.home = f.position.clone());
    const topY = this.burette.group.position.y + 0.585;
    this.tweens.push({
      obj: f, from: f.position.clone(),
      to: new THREE.Vector3(this.burette.group.position.x, topY, this.burette.group.position.z),
      t: 0, dur: 0.5,
      onDone: () => this.tweens.push({
        obj: f, from: f.position.clone(), to: home.clone(), t: 0, dur: 0.6, delay: 0.7,
      }),
    });
  }

  _do_read_initial(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return this._deny('Enter a reading in mL.');
    this.trial = {
      n: this.trials.length + 1,
      rough: this.isRoughTrial,
      initial: v,
      initialTrue: this.burette.reading,
      delivered: 0,
      swirlTime: 0,
      wallsRinsed: false,
      dropwiseFinish: true,
      maxFlowLastML: 0,
      pinkAtEnd: 0,
      overshot: false,
      bubbleReleased: false,
      cbEff: this.cbEffective,
    };
    this.curve = [];
    this.sfx?.click();
    return { ok: true, message: `Initial reading logged as ${v.toFixed(2)} mL.` };
  }

  _do_rinse_pipette() {
    this.pipetteConditioned = true;
    this.lab.waste.setVolume(this.lab.waste.volumeML + 4);
    this.sfx?.pour(0.35);
    return { ok: true, message: 'Pipette rinsed with the unknown and drained. Interior now wetted with sample.' };
  }

  _do_pipette_fill() {
    if (this.pipetteState === 'full') return { ok: true, message: 'Already filled to the mark.' };
    this.pipetteState = 'full';
    this._animatePipette(this.lab.hclBeaker.group.position, 0.115, () => {
      this.lab.pipLiquid.visible = true;
      this.lab.hclBeaker.setVolume(Math.max(0, this.lab.hclBeaker.volumeML - ALIQUOT_ML));
    });
    this.sfx?.pour(0.3);
    return { ok: true, message: 'Drawn up past the mark and trimmed to 25.00 mL, meniscus on the line.' };
  }

  _do_pipette_deliver() {
    if (this.pipetteState !== 'full') return this._deny('Fill the pipette to the mark first.');
    if (this.station !== 'flask') this._stage('flask');
    this.pipetteState = 'empty';
    this._animatePipette(
      new THREE.Vector3(STATION.x, 0, STATION.z), 0.175,
      () => {
        const water = this.pipetteConditioned ? 0 : 0.25;
        this.flask.add(ALIQUOT_ML - water, { cH: this.unknown.ca });
        if (water > 0) {
          this.flask.add(water, {});
          this.notes.add('dilutedAliquot');
        }
        this.lab.pipLiquid.visible = false;
        this._syncFlask();
        this.sfx?.pour(0.5);
        this.emit('state', this);
        this._advance();
      },
    );
    return {
      ok: true,
      message: this.pipetteConditioned
        ? 'Delivered, tip touched to the wall to release the last drop.'
        : 'Delivered — but the pipette was wet with water, so that aliquot was slightly dilute.',
    };
  }

  _animatePipette(destXZ, hoverY, onArrive) {
    const p = this.lab.pipette;
    if (!p.userData.home) {
      p.userData.home = p.position.clone();
      p.userData.homeRot = p.rotation.clone();
    }
    const up = new THREE.Vector3(destXZ.x, BENCH_Y + hoverY + 0.18, destXZ.z);
    p.rotation.z = 0;
    this.tweens.push({
      obj: p, from: p.position.clone(), to: up, t: 0, dur: 0.6,
      onDone: () => {
        onArrive?.();
        this.tweens.push({
          obj: p, from: p.position.clone(), to: p.userData.home.clone(),
          t: 0, dur: 0.7, delay: 0.45,
          onDone: () => { p.rotation.copy(p.userData.homeRot); },
        });
      },
    });
  }

  _do_add_indicator() {
    if (this.station !== 'flask') this._stage('flask');
    if (this.flask.volumeML < 1) return this._deny('Add the aliquot first.');
    this.indicatorDrops++;
    this.flask.add(PHENOLPHTHALEIN.dropML, { indicatorM: PHENOLPHTHALEIN.stockM });
    this._syncFlask();
    this.sfx?.drip();
    if (this.indicatorDrops > 4) {
      this.notes.add('tooMuchIndicator');
      return { ok: true, message: `${this.indicatorDrops} drops — that is more indicator than the method calls for.` };
    }
    return { ok: true, message: `${this.indicatorDrops} drop${this.indicatorDrops > 1 ? 's' : ''} of phenolphthalein.` };
  }

  _do_swirl() {
    this.swirl = Math.min(1, this.swirl + 0.55);
    this.sfx?.swirl();
    return { ok: true, quiet: true };
  }

  _do_rinse_walls() {
    if (this.station !== 'flask') return this._deny('Bring the flask to the station first.');
    this.flask.add(3.0, {});             // water: volume, but no moles
    if (this.trial) this.trial.wallsRinsed = true;
    if (this.flask.nH === 0 && this.flask.nOH === 0) this.notes.add('flaskRinsed');
    this._syncFlask();
    this.sfx?.pour(0.4);
    return { ok: true, message: 'Walls washed down with deionised water — volume changes, moles do not.' };
  }

  _do_empty_flask() {
    if (this.flask.volumeML < 0.5) return { ok: true, message: 'Already empty.' };
    this.lab.waste.setVolume(Math.min(this.lab.waste.capacityML, this.lab.waste.volumeML + this.flask.volumeML));
    this.flask.reset();
    this.indicatorDrops = 0;
    this.plume.clear();
    this.curve = [];
    this.notes.add('dumped');
    this._syncFlask();
    this.sfx?.pour(0.6);
    return { ok: true, message: 'Titrated solution discarded to waste.' };
  }

  _do_read_final(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return this._deny('Enter a reading in mL.');
    if (!this.trial) return this._deny('No trial in progress.');
    const t = this.trial;
    t.final = v;
    t.finalTrue = this.burette.reading;
    t.titre = v - t.initial;
    t.titreTrue = t.finalTrue - t.initialTrue;
    t.pinkAtEnd = this.flask.pink;
    t.pHAtEnd = this.flask.pH;
    t.veq = this._veqNow();
    // how close they actually stopped to equivalence, in mL (+ = past it)
    t.endpointError = t.delivered - t.veq;
    t.molarity = (NAOH_NOMINAL_M * t.titre) / ALIQUOT_ML;
    t.curve = this.curve.slice();
    t.readingError = Math.abs(t.initial - t.initialTrue) + Math.abs(t.final - t.finalTrue);
    this.trials.push(t);
    this.trial = null;
    this.sfx?.chime();
    this.emit('trial', t);

    if (this.trials.length >= TRIALS_REQUIRED) {
      this._goto('calculate');
    } else {
      this.notes.delete('dumped');
      this._goto('dump');
      this._afterDump = true;
    }
    return { ok: true, message: `Trial ${t.n}: titre ${t.titre.toFixed(2)} mL.` };
  }

  _do_submit_answer(value) {
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) return this._deny('Enter a molarity in mol/L.');
    this.answer = v;
    this.finished = true;
    this.report = this.buildReport();
    this._goto('debrief');
    this.emit('report', this.report);
    return { ok: true };
  }

  _do_toggle_probe() {
    this.probeIn = !this.probeIn;
    const p = this.lab.probe;
    const home = p.userData.home || (p.userData.home = p.position.clone());
    const dest = this.probeIn
      ? new THREE.Vector3(STATION.x + 0.006, BENCH_Y + 0.055, STATION.z + 0.004)
      : home.clone();
    this.tweens.push({ obj: p, from: p.position.clone(), to: dest, t: 0, dur: 0.5 });
    if (this.probeIn) this.notes.add('usedProbe');
    return { ok: true, message: this.probeIn ? 'pH electrode in the flask.' : 'Electrode back in its holder.' };
  }

  // ------------------------------------------------------ stopcock control --
  /** Called by input handlers; f is 0..1. */
  setStopcock(f) {
    if (this.stopcockLocked && f > 0) {
      this.burette.setStopcockOpen(0);
      // input runs every frame, so only complain about once a second
      if (this.clock - (this._lastLockWarn ?? -9) > 1.2) {
        this._lastLockWarn = this.clock;
        this._deny(`Stopcock stays shut during "${this.stepTitle}".`);
      }
      return;
    }
    this.burette.setStopcockOpen(f);
  }

  /** Release exactly one drop (the endgame technique). */
  releaseDrop(fraction = 1) {
    if (!this._allows('stopcock')) return this._deny('Not now.');
    if (!this.burette.hasLiquid) return this._deny('Burette is empty — recharge it.');
    const ml = DROP_ML * fraction;
    this.burette.reading += ml;
    this._accountOut(ml);
    this._emitDrop(ml);
    if (fraction < 1) this.notes.add('halfDrop');
    return { ok: true, quiet: true };
  }

  // ------------------------------------------------------------- physics ---
  update(dt) {
    if (this.paused) dt = 0;
    this.clock += dt;
    this._updateTweens(dt);

    // --- swirl decays; a real swirl lasts a couple of seconds -------------
    if (this.swirl > 0) {
      this.swirl = Math.max(0, this.swirl - dt * 0.75);
      this.swirlTotal += dt * this.swirl;
      if (this.trial) this.trial.swirlTime += dt * this.swirl;
    }
    this._animateSwirl(dt);

    // --- flow out of the burette -----------------------------------------
    const flow = this.burette.flowRate;
    if (flow > 0 && dt > 0) {
      const out = Math.min(flow * dt, Math.max(0, SCALE_ML - this.burette.reading));
      this.burette.reading += out;

      // A wide-open stopcock flushes trapped air out almost at once; a trickle
      // lets it cling until it eventually works loose, which is precisely why
      // the method says to open it wide over the waste beaker first.
      if (this.burette.hasBubble) {
        this._sinceCharge = (this._sinceCharge || 0) + out;
        const threshold = this.burette.open > 0.5 ? 0.6 : this._bubbleReleaseAt;
        if (this._sinceCharge > threshold) this._expelBubble();
      }

      if (this.burette.open < DRIP_OPEN) {
        // trickle: liquid gathers into a pendant drop before it falls
        this.burette.setPendant(this.burette.pendantML + out);
        while (this.burette.pendantML >= DROP_ML) {
          this.burette.setPendant(this.burette.pendantML - DROP_ML);
          this._emitDrop(DROP_ML);
          this._accountOut(DROP_ML);
        }
      } else {
        this.pending.push({ ml: out, at: this.clock + 0.11 });
        this._accountOut(out);
      }
      this.sfx?.pour(Math.min(1, flow / 2.4));
    } else {
      this.sfx?.pour(0);
    }

    // (bubble expulsion is handled inside the flow block, via _expelBubble)

    // --- receive stream volume -------------------------------------------
    for (let i = this.pending.length - 1; i >= 0; i--) {
      if (this.clock >= this.pending[i].at) {
        this._receive(this.pending[i].ml, false);
        this.pending.splice(i, 1);
      }
    }

    this.drops.update(dt);
    this.plume.update(dt, this.swirl);
    this.ripples.update(dt);

    const targetY = this._receiverSurfaceY();
    this.burette.updateStream(this.burette.open < DRIP_OPEN ? 0 : flow, targetY, this.clock);

    // running dry mid-trial wrecks that titre; say so rather than fail silently
    if (this.trial && !this.burette.hasLiquid && !this.notes.has('ranDry')) {
      this.notes.add('ranDry');
      this.emit('note', 'The burette is empty. This titre cannot be completed — record it, then discard the trial in your working.');
    }
    this._syncProbe();
    this._syncFlaskColor();

    // Some steps complete through physics rather than a click — the tip purge
    // finishing, say — so the checklist has to be re-evaluated here too.
    if (!this.paused && !this.finished && this.step.done()) this._advance();

    if (dt > 0) this.emit('tick', this);
  }

  /**
   * The trapped air leaves through the tip. Liquid from the barrel takes its
   * place, so the burette reading advances by the bubble's volume while none of
   * that volume reaches whatever is under the tip.
   *
   * Before the initial reading that is harmless — it is exactly what purging
   * is. Once a titration is under way it is a systematic error, and the same
   * event produces both outcomes depending only on when it happens.
   */
  _expelBubble() {
    this.burette.setBubble(false);
    this.burette.reading += 0.22;
    if (this.trial) {
      this.trial.bubbleReleased = true;
      this.notes.add('bubbleReleased');
      this.emit('note', 'The trapped air just escaped through the tip — your burette reading moved without any titrant reaching the flask.');
    } else {
      this.notes.add('purged');
      this.emit('note', 'Tip purged — no air below the stopcock.');
    }
  }

  _accountOut(ml) {
    if (this.trial) this.trial.delivered += ml;
    // technique is judged over the final millilitre, where it matters
    if (this.trial && this._nearEndpoint()) {
      const rate = this.burette.flowRate;
      this.trial.maxFlowLastML = Math.max(this.trial.maxFlowLastML, rate);
      if (rate > 0.35) this.trial.dropwiseFinish = false;
    }
    if (this.station === 'none' && ml > 0) {
      this.spillML += ml;
      if (this.spillML > 0.4) this._violation('Ran titrant onto the bench with nothing under the tip.');
    }
  }

  /**
   * Stoichiometric equivalence volume for whatever is actually in the flask
   * right now, in mL. Uses the real acid content and the real titrant strength,
   * so pipette and burette conditioning errors are already baked in.
   */
  _veqNow() {
    return (this.flask.nH / this.cbEffective) * 1000;
  }

  /** Are we within about 1 mL of where the colour will break? */
  _nearEndpoint() {
    if (!this.flask.hasIndicator || !this.trial) return false;
    return this.trial.delivered > this._veqNow() - 1.0;
  }

  _emitDrop(ml) {
    const from = this.burette.tipWorld;
    this.drops.spawn(from, ml, this._receiverSurfaceY(), (v) => this._receive(v, true));
    this.sfx?.drip();
  }

  _receiverSurfaceY() {
    if (this.station === 'flask') {
      return Math.max(this.lab.flask.surfaceWorldY, TILE_Y + 0.002);
    }
    if (this.station === 'waste') {
      return Math.max(this.lab.waste.surfaceWorldY, BENCH_Y + 0.002);
    }
    return BENCH_Y;                     // the bench top: a spill
  }

  _receive(ml, isDrop) {
    if (ml <= 0) return;
    if (this.station === 'flask') {
      const before = this.flask.pink;
      this.flask.add(ml, { cOH: this.cbEffective });
      this._syncFlask();
      if (this.flask.hasIndicator) {
        this.plume.hit(this.lab.flask.surfaceLocalY, isDrop ? 0.55 : 0.9 * Math.min(1, ml * 6));
      }
      if (isDrop) this.ripples.hit(this.lab.flask.surfaceLocalY, 0.022);

      // Overshoot is a volume error, not a colour: one drop past equivalence
      // legitimately gives a strong pink in a strong-acid/strong-base titration.
      // Being five drops past does not.
      const after = this.flask.pink;
      if (this.trial && this.trial.delivered > this._veqNow() + 0.25 && !this.trial.overshot) {
        this.trial.overshot = true;
        this.notes.add('overshoot');
        this.emit('note', 'Well past the endpoint — that titre is too high to use. Approach the colour change a drop at a time.');
      } else if (before < VISIBLE_PINK && after > VISIBLE_PINK && this.trial) {
        this.trial.firstPinkAt = this.trial.delivered;
      }
      // live curve
      const v = this.trial ? this.trial.delivered : 0;
      const last = this.curve[this.curve.length - 1];
      if (!last || v - last[0] > 0.04) this.curve.push([v, this.flask.pH]);
    } else if (this.station === 'waste') {
      this.lab.waste.setVolume(Math.min(this.lab.waste.capacityML, this.lab.waste.volumeML + ml));
    } else {
      this.emit('spill', this.spillML);
    }
  }

  _syncFlask() {
    this.lab.flask.setVolume(this.flask.volumeML);
  }

  _syncFlaskColor() {
    const pink = this.flask.pink;
    this.lab.flask.setLiquidRGB(solutionRGB(pink), solutionOpacity(pink), 0.2 * pink);
  }

  _syncProbe() {
    if (!this.lab.phScreen) return;
    const txt = this.probeIn && this.flask.volumeML > 1
      ? `pH ${this.flask.pH.toFixed(2)}` : 'pH  ----';
    if (this._screenTxt !== txt) {
      this._screenTxt = txt;
      const c = this.lab.phScreen.material.map.image;
      const g = c.getContext('2d');
      g.fillStyle = '#0b1c14';
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#7dffb0';
      g.font = '700 46px ui-monospace, monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(txt, c.width / 2, c.height / 2);
      this.lab.phScreen.material.map.needsUpdate = true;
    }
  }

  _animateSwirl(dt) {
    const g = this.lab.flask.group;
    if (this.station !== 'flask') return;
    if (this.tweens.some((tw) => tw.obj === g)) return;   // don't fight a move
    if (this.swirl > 0.01) {
      this._swirlPhase = (this._swirlPhase || 0) + dt * 11;
      const a = 0.0045 * this.swirl;
      g.position.x = STATION.x + Math.cos(this._swirlPhase) * a;
      g.position.z = STATION.z + Math.sin(this._swirlPhase) * a;
      this.lab.flask.surface.rotation.z = this._swirlPhase * 0.5;
    } else if (Math.abs(g.position.x - STATION.x) > 1e-5) {
      g.position.x += (STATION.x - g.position.x) * Math.min(1, dt * 8);
      g.position.z += (STATION.z - g.position.z) * Math.min(1, dt * 8);
    }
  }

  _updateTweens(dt) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      if (tw.delay > 0) { tw.delay -= dt; continue; }
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const k = tw.t < 0.5 ? 2 * tw.t * tw.t : 1 - Math.pow(-2 * tw.t + 2, 2) / 2;
      tw.obj.position.lerpVectors(tw.from, tw.to, k);
      tw.onUpdate?.();
      if (tw.t >= 1) {
        this.tweens.splice(i, 1);
        tw.onDone?.();
      }
    }
  }

  // -------------------------------------------------------------- scoring --
  buildReport() {
    const fine = this.trials.filter((t) => !t.rough);
    const st = stats(fine.map((t) => t.molarity));
    const trueCa = this.unknown.ca;
    const errPct = ((this.answer - trueCa) / trueCa) * 100;

    const veqTrue = equivalenceVolume({ ca: trueCa, va: ALIQUOT_ML, cb: NAOH_NOMINAL_M });

    const technique = [
      {
        id: 'ppe', label: 'PPE on before handling reagents',
        pass: !this.violations.some((v) => v.includes('goggles')),
        why: 'Goggles and gloves go on before the first bottle is opened.',
      },
      {
        id: 'condition', label: 'Burette conditioned with titrant (×2)',
        pass: this.buretteConditioned >= 2,
        why: 'A water-wet barrel dilutes the titrant, so every titre comes out high and the calculated molarity comes out high with it.',
      },
      {
        id: 'purge', label: 'Air purged from below the stopcock',
        pass: !this.notes.has('bubbleReleased'),
        why: 'A bubble that escapes mid-run adds to the burette reading without adding titrant to the flask.',
      },
      {
        id: 'pipette', label: 'Pipette conditioned with the unknown',
        pass: this.pipetteConditioned,
        why: 'Water left in the pipette dilutes the aliquot, so you titrate less acid than you think.',
      },
      {
        id: 'indicator', label: '2–3 drops of indicator only',
        pass: !this.notes.has('tooMuchIndicator'),
        why: 'Phenolphthalein is itself a weak acid; a large excess consumes measurable titrant.',
      },
      {
        id: 'swirl', label: 'Swirled continuously while titrating',
        pass: fine.length > 0 && fine.every((t) => t.swirlTime > 2.5),
        why: 'Without mixing you are reading a local pink flash, not the state of the bulk solution.',
      },
      {
        id: 'dropwise', label: 'Approached the endpoint dropwise',
        pass: fine.every((t) => t.dropwiseFinish),
        why: 'The last millilitre decides the result; deliver it a drop at a time.',
      },
      {
        id: 'walls', label: 'Rinsed the flask walls before the endpoint',
        pass: fine.every((t) => t.wallsRinsed),
        why: 'Splashes on the wall have not reacted yet. Wash them down before you call the endpoint.',
      },
      {
        id: 'endpoint', label: 'Stopped within a drop of equivalence',
        pass: fine.length > 0 && fine.every(
          (t) => t.endpointError >= -0.02 && t.endpointError <= 0.10 && !t.overshot,
        ),
        why: 'One drop is 0.05 mL, and in a strong-acid/strong-base titration one drop spans the whole colour change. Stop at the first drop that leaves a colour behind after swirling.',
      },
      {
        id: 'readings', label: 'Meniscus read to ±0.03 mL',
        pass: this.trials.every((t) => t.readingError <= 0.06),
        why: 'Read the bottom of the meniscus at eye level, estimating the last digit.',
      },
      {
        id: 'concordant', label: 'Concordant titres (RSD < 0.5 %)',
        pass: st.n >= 2 && st.rsd < 0.5,
        why: 'Concordance is your only evidence that the titres are reliable.',
      },
    ];

    const techniquePassed = technique.filter((t) => t.pass).length;
    const techniqueScore = (techniquePassed / technique.length) * 100;
    const accuracyScore = Math.max(0, 100 - Math.abs(errPct) * 20);
    const precisionScore = st.n >= 2 ? Math.max(0, 100 - st.rsd * 50) : 0;
    const safetyScore = Math.max(0, 100 - this.violations.length * 25);
    const overall = accuracyScore * 0.35 + precisionScore * 0.2
      + techniqueScore * 0.35 + safetyScore * 0.1;

    const grade = overall >= 92 ? 'A' : overall >= 84 ? 'B' : overall >= 74 ? 'C'
      : overall >= 64 ? 'D' : 'F';

    return {
      unknown: this.unknown,
      answer: this.answer,
      trueCa,
      errPct,
      trials: this.trials,
      fine,
      stats: st,
      veqTrue,
      technique,
      violations: this.violations,
      scores: {
        accuracy: accuracyScore,
        precision: precisionScore,
        technique: techniqueScore,
        safety: safetyScore,
        overall,
      },
      grade,
      elapsed: this.clock,
      usedProbe: this.notes.has('usedProbe'),
      notes: [...this.notes],
    };
  }
}
