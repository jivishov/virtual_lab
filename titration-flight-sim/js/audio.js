/**
 * audio.js — Synthesised bench sounds. No audio files, so nothing to load and
 * nothing to fetch: everything is generated with WebAudio on first gesture.
 */

export class SFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this._pourGain = null;
  }

  /** Must be called from a user gesture the first time. */
  resume() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this._buildPour();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.enabled = !m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  _noiseBuffer(seconds = 1) {
    const n = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _buildPour() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(2);
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.9;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(bp).connect(g).connect(this.master);
    src.start();
    this._pourGain = g;
    this._pourFilter = bp;
  }

  /** Continuous flow noise, level 0..1. */
  pour(level) {
    if (!this.ctx || !this._pourGain) return;
    const t = this.ctx.currentTime;
    this._pourGain.gain.setTargetAtTime(Math.min(0.25, level * 0.22), t, 0.05);
    this._pourFilter.frequency.setTargetAtTime(700 + level * 1500, t, 0.08);
  }

  _blip({ freq = 880, dur = 0.06, type = 'square', gain = 0.12, slide = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  click() { this._blip({ freq: 1400, dur: 0.035, gain: 0.07 }); }

  /** A drop hitting the surface: short pitched plink. */
  drip() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    const f = 1500 + Math.random() * 600;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.08);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.12);
  }

  clink() {
    this._blip({ freq: 2100, dur: 0.09, type: 'triangle', gain: 0.06, slide: -400 });
    this._blip({ freq: 3150, dur: 0.06, type: 'sine', gain: 0.03 });
  }

  swirl() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.4);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.linearRampToValueAtTime(1100, t + 0.28);
    bp.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.36);
  }

  chime() {
    [784, 988, 1319].forEach((f, i) => {
      setTimeout(() => this._blip({ freq: f, dur: 0.22, type: 'sine', gain: 0.07 }), i * 70);
    });
  }

  alarm() {
    [0, 1].forEach((i) => {
      setTimeout(() => this._blip({ freq: i ? 380 : 520, dur: 0.14, type: 'square', gain: 0.09 }), i * 150);
    });
  }
}
