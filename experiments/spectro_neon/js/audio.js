// audio.js - Subtle Procedural Web Audio API Laboratory Soundscape (Zero External Files)
// Synthesizes gentle tactile feedback for pipetting, cuvette seating, Spec 20D+ beeps, scans & milestones.

let audioCtx = null;
let muted = false;

function ensureContext() {
    if (muted) return null;
    try {
        if (!audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            audioCtx = new Ctx();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        return audioCtx;
    } catch {
        return null;
    }
}

export function setSoundMuted(isMuted) {
    muted = Boolean(isMuted);
}

export function isSoundMuted() {
    return muted;
}

export function toggleSound() {
    muted = !muted;
    if (!muted) {
        playTone(660, 880, 0.08, 'sine', 0.045);
    }
    return !muted;
}

function playTone(freqStart, freqEnd, duration, type = 'sine', peakGain = 0.055, delay = 0) {
    const ctx = ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
}

export function playLabSound(eventType) {
    if (muted) return;
    switch (eventType) {
        case 'fillPipette':
            playTone(340, 580, 0.14, 'sine', 0.042);
            playTone(520, 740, 0.09, 'sine', 0.028, 0.08);
            break;
        case 'dispensePipette':
            playTone(640, 410, 0.13, 'sine', 0.042);
            playTone(460, 320, 0.08, 'sine', 0.025, 0.07);
            break;
        case 'insertCuvette':
            playTone(220, 140, 0.06, 'triangle', 0.055);
            playTone(440, 520, 0.05, 'sine', 0.03, 0.04);
            break;
        case 'removeCuvette':
            playTone(320, 440, 0.06, 'triangle', 0.035);
            break;
        case 'emptyCuvette':
            playTone(480, 260, 0.18, 'sine', 0.036);
            playTone(390, 210, 0.14, 'sine', 0.024, 0.09);
            break;
        case 'buttonPress':
            playTone(920, 860, 0.045, 'triangle', 0.035);
            break;
        case 'zeroSpec':
            playTone(880, 880, 0.08, 'sine', 0.045, 0.0);
            playTone(1318.5, 1318.5, 0.11, 'sine', 0.048, 0.10);
            break;
        case 'measure':
            playTone(1046.5, 1046.5, 0.075, 'sine', 0.045, 0.0);
            playTone(1568.0, 1568.0, 0.12, 'sine', 0.046, 0.085);
            break;
        case 'error':
            playTone(210, 185, 0.11, 'sawtooth', 0.026, 0.0);
            playTone(185, 165, 0.13, 'sawtooth', 0.022, 0.12);
            break;
        case 'themeSwitch':
            playTone(540, 720, 0.055, 'sine', 0.025);
            break;
        case 'guideArc':
            playTone(587.3, 880, 0.12, 'sine', 0.028);
            break;
        case 'scanPeak':
            // Crystalline lock-on harmonic when spectrum auto-scan finds λmax = 630 nm
            playTone(880, 1174.66, 0.12, 'sine', 0.042, 0.0);
            playTone(1318.5, 1760, 0.18, 'sine', 0.038, 0.09);
            break;
        case 'morph':
            playTone(420, 620, 0.14, 'sine', 0.024);
            break;
        case 'milestone':
            playTone(523.25, 523.25, 0.16, 'sine', 0.045, 0.0);
            playTone(659.25, 659.25, 0.18, 'sine', 0.045, 0.09);
            playTone(783.99, 783.99, 0.24, 'sine', 0.05, 0.18);
            playTone(1046.5, 1046.5, 0.30, 'sine', 0.042, 0.27);
            break;
        default:
            break;
    }
}
