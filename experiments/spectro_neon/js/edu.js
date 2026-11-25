// edu.js - Scaffolded Spectrophotometry Educational Studio, Quantum Photon Optics & Spatial FX Engine
// Powers: 5-Phase Stepper, Milestone Toasts + CTAs, Precision Streak, Spatial 3D Laser Guide & FX Overlay,
// Smart Auto-Appearing 630nm X-Ray PiP, Quantum Photon-Collision Cutaway, Auto-Scan 400-700nm Spectrum,
// Complementary Color Wheel + Eye-vs-Spec Vial, Unknown Solver, AP Concept Check & Printable Lab Report.
import { getState, findObjectById } from './state.js';
import * as config from './config.js';
import instructions from './instructions.js';
import { getGraphSnapshotDataUrl } from './graph.js?v=11';
import { playLabSound } from './audio.js?v=9';

const BLUE1_MOLAR_MASS = 792.85; // g/mol (Brilliant Blue FCF)

let els = {};
let opticsCanvas = null;
let opticsCtx = null;
let pipCanvas = null;
let pipCtx = null;
let spectrumCanvas = null;
let spectrumCtx = null;
let fxCanvas = null;
let fxCtx = null;
let getScreenPointFn = null;

let opticsRafId = null;
let fxRafId = null;
let scanRafId = null;
let opticsTabActive = false;

// Smart PiP visibility: null = auto (show whenever cuvette has liquid), true/false = explicit user toggle
let pipUserOverride = null;
let pipCurrentlyShown = false;

// Optical physics mode: 'live' mirrors the 3D bench cuvette/Spec 20D+; 'sandbox' unlocks sliders, presets & scan
let opticsMode = 'live';
let sandboxConc = 1.386;
let sandboxWavelength = 630;
let isScanning = false;
let applyOpticsModeRef = null;

// Milestone & Precision Streak tracking
let highestMilestoneStep = 0;
let milestoneTimer = null;
let milestoneCtaAction = null;
let lastPhaseId = 'prep';
let precisionStreak = 0;
let lastMeasuredBadgeCount = 0;

// Animated dye particles shared by full cutaway & PiP X-Ray HUD
const dyeParticles = Array.from({ length: 44 }, (_, idx) => ({
    u: ((idx * 37) % 100) / 100,
    v: ((idx * 61 + 13) % 100) / 100,
    phase: idx * 0.73,
    speed: 0.42 + (idx % 5) * 0.14,
}));

// Deterministic photon lanes for Quantum Photon-Collision visualizer
const photonLanes = Array.from({ length: 14 }, (_, idx) => ({
    offset: idx / 14,
    yFrac: (((idx * 29) % 11) - 5) / 5.5, // spread vertically across beam
    absorbDepth: 0.14 + (((idx * 43 + 17) % 72) / 100), // normalized depth inside cuvette
    rank: ((idx * 7 + 3) % 14) / 14, // decides whether absorbed based on T
}));

// Spatial 2D FX queues (projected over 3D viewport)
let activeGuideArc = null; // { fromId, toId, startMs, durationMs }
const fxRipples = [];      // { x, y, color, startMs, durationMs, maxR }
const fxFloats = [];       // { x, y, text, accent, startMs, durationMs }
const fxSparks = [];       // { x, y, vx, vy, color, size, bornMs, lifeMs }

// Interactive AP Chemistry Concept Check Bank
const QUIZ_BANK = [
    {
        id: 'q_lambda',
        question: '1. Why is the Spectronic 20D+ set to λ = 630 nm (red-orange light) when measuring FD&C Blue #1?',
        options: [
            'Blue #1 emits 630 nm fluorescence when illuminated.',
            'Blue #1 transmits blue light (~470 nm) and maximally absorbs its complementary color at 630 nm (λmax).',
            'Glass cuvettes only transmit light at 630 nm.',
            'Water absorbs strongly at 630 nm, amplifying the signal.',
        ],
        correct: 1,
        explanation:
            'A solution appears blue because it transmits blue wavelengths (~450–490 nm) while absorbing complementary orange-red light around λmax = 630 nm. Measuring at λmax maximizes sensitivity and Beer-Lambert linearity.',
    },
    {
        id: 'q_rinse',
        question: '2. If a student skips rinsing the cuvette after measuring a concentrated standard (10/0) and pours a dilute sample (2/8) in, how is the reading affected?',
        options: [
            'Measured absorbance is artificially HIGH due to residual Blue #1 dye carryover.',
            'Measured absorbance is artificially LOW because water dilutes the sample.',
            'Transmittance increases above 100%T.',
            'There is no effect because the cuvette was emptied into waste.',
        ],
        correct: 0,
        explanation:
            'Leftover droplets of concentrated Blue #1 cling to the inner walls and increase the next dilute sample’s concentration, causing falsely high Absorbance (and low %T). Rinsing with distilled H₂O prevents cross-contamination.',
    },
    {
        id: 'q_beer',
        question: '3. According to Beer-Lambert Law (A = ε·b·c), what happens if you double the molar concentration c of Blue #1 in the same 1.0 cm cuvette?',
        options: [
            'Transmittance (%T) doubles.',
            'Absorbance (A) stays constant while λmax shifts.',
            'Absorbance (A) doubles, while Transmittance (%T) decreases exponentially.',
            'Absorbance (A) increases by a factor of 10.',
        ],
        correct: 2,
        explanation:
            'Absorbance A = ε·b·c is directly proportional to concentration c (doubling c doubles A), whereas T = 10^(−A) decreases exponentially. Toggle A vs. %T on the Calibration Curve to watch this morph live!',
    },
    {
        id: 'q_unknown',
        question: '4. An Unknown Drink reads 39.0 %T (A = 0.4089) on a calibration curve with slope m = 0.1358 Abs/µM. What is its Blue #1 concentration?',
        options: [
            '0.056 µM',
            '2.310 µM',
            '3.011 µM',
            '5.290 µM',
        ],
        correct: 2,
        explanation:
            'Rearranging A = m·c gives c = A / m = 0.4089 / 0.1358 ≈ 3.011 µM (~2.39 mg/L of Brilliant Blue FCF). Because the unknown is more concentrated than the 2.310 µM stock, it absorbs more 630 nm light (39.0 %T < 49.0 %T).',
    },
];

const quizAnswers = new Map();

// ---------------------------------------------------------------------------
// 5-Phase Experiment Architecture, Milestones & Step Science Coaching
// ---------------------------------------------------------------------------

const PHASES = [
    { id: 'prep',        label: 'Dilutions', start: 0,  end: 19, preset: 'reagents', tooltip: 'Steps 1–20: Prepare 6 serial dilutions (10/0 to 0/10 Blank)' },
    { id: 'zero',        label: 'Blank',     start: 20, end: 27, preset: 'spec20',   tooltip: 'Steps 21–28: Calibrate Spec 20D+ to 100.0 %T with Blank & rinse' },
    { id: 'standards',   label: 'Standards', start: 28, end: 75, preset: 'rack',     tooltip: 'Steps 29–76: Measure all 6 Beer-Lambert standards & rinse between runs' },
    { id: 'calibration', label: 'Curve',     start: 76, end: 76, preset: 'overview', tooltip: 'Step 77: Review linear calibration curve & slope m = 0.1358 Abs/µM' },
    { id: 'unknown',     label: 'Unknown',   start: 77, end: 83, preset: 'spec20',   tooltip: 'Steps 78–83: Measure Unknown Drink & decode concentration' },
];

const MILESTONES = [
    {
        step: 20,
        title: 'Phase 1 Complete — 6 Serial Dilutions Ready!',
        detail: 'All 6 Beer-Lambert standards (2.310 → 0.000 µM) prepared with zero cross-contamination.',
        ctaLabel: 'Focus Spec 20D+ →',
        ctaType: 'preset:spec20',
    },
    {
        step: 28,
        title: 'Phase 2 Complete — Spec 20D+ Zeroed at 100.0 %T!',
        detail: 'Optical baseline I₀ locked with Distilled H₂O blank and cuvette rinsed spotless.',
        ctaLabel: 'Explore Photon Lab →',
        ctaType: 'tab:optics',
    },
    {
        step: 76,
        title: 'Phase 3 Complete — Calibration Curve Locked!',
        detail: 'All 6 standards plotted cleanly (slope m ≈ 0.1358 Abs/µM). Ready to decode Unknown Drink!',
        ctaLabel: 'Inspect Curve →',
        ctaType: 'tab:data',
    },
    {
        step: 83,
        title: 'Unknown Drink Decoded — 3.011 µM (2.39 mg/L Blue #1)!',
        detail: 'Authentic blue sports-drink concentration verified by Beer-Lambert Law.',
        ctaLabel: 'Open Lab Report →',
        ctaType: 'report',
    },
];

function isLightTheme() {
    return document.documentElement?.dataset?.theme === 'light';
}

export function getRecommendedPresetForStep(stepIdx) {
    const instr = instructions[stepIdx];
    if (!instr) return 'overview';
    const hl = instr.highlight || [];
    const usesPipette = hl.some((id) => id.startsWith('pipette_'));
    const usesBottle = hl.includes('stockBottle') || hl.includes('waterBottle') || hl.includes('unknownBottle');
    const usesTubeOrCuv = hl.some((id) => id.startsWith('tube_') || id === 'cuvette');

    if (hl.includes('btn_zero') || hl.includes('btn_measure')) return 'spec20';
    if (usesPipette && usesBottle) return 'reagents';
    // Cross-bench transfers (left pipette stand -> center rack/cuvette, or cuvette -> spec20/waste) need overview so BOTH ends stay on-screen!
    if (usesPipette && usesTubeOrCuv) return 'overview';
    if (hl.includes('spec20') && hl.includes('cuvette')) return 'overview';
    if (hl.includes('spec20')) return 'spec20';
    if (usesBottle) return 'reagents';
    if (hl.some((id) => id.startsWith('tube_'))) return 'rack';
    return 'overview';
}

export function performCurrentStepDemo(interactionActions) {
    const state = getState();
    const instr = instructions[state.currentStep];
    if (!instr || !instr.action || !interactionActions) return false;

    // Clear any prior guidance arc so it never lingers onto the newly completed step
    activeGuideArc = null;

    switch (instr.action) {
        case 'fillPipette':
            return Boolean(interactionActions.tryFillPipette(instr.pipette, instr.source));
        case 'dispensePipette': {
            const pip = findObjectById(instr.pipette);
            const vol = instr.volume ?? (pip ? pip.currentVolume : 0);
            return Boolean(interactionActions.tryDispensePipette(instr.pipette, instr.destination, vol));
        }
        case 'insertCuvette':
            return Boolean(interactionActions.tryInsertCuvette(instr.cuvette || 'cuvette', instr.destination || 'spec20'));
        case 'zeroSpec':
            return Boolean(interactionActions.tryZeroSpec());
        case 'measure':
            return Boolean(interactionActions.tryMeasure());
        case 'emptyCuvette':
            return Boolean(interactionActions.tryEmptyCuvette(instr.cuvette || 'cuvette', instr.destination || 'wasteBeaker', true));
        default:
            return false;
    }
}

// ---------------------------------------------------------------------------
// Precision Streak Tracker (Amusing, Gentle Positive Reinforcement)
// ---------------------------------------------------------------------------

export function recordStepOutcome(success, currentStep = null) {
    if (success) {
        precisionStreak += 1;
        if (Number.isFinite(currentStep)) {
            precisionStreak = Math.min(precisionStreak, Math.max(0, currentStep));
        }
    } else {
        precisionStreak = 0;
    }
    syncPrecisionPill();
}

export function onUndoStep(currentStep = null) {
    precisionStreak = Math.max(0, precisionStreak - 1);
    if (Number.isFinite(currentStep)) {
        precisionStreak = Math.min(precisionStreak, Math.max(0, currentStep));
    }
    syncPrecisionPill();
}

export function resetPrecisionStreak() {
    precisionStreak = 0;
    syncPrecisionPill();
}

function syncPrecisionPill() {
    if (!els.precisionPill || !els.precisionPillText) return;
    if (precisionStreak >= 3) {
        els.precisionPill.classList.remove('precision-pill--hidden');
        els.precisionPillText.textContent = `Streak ${precisionStreak}`;
        els.precisionPill.classList.remove('precision-pill--pop');
        void els.precisionPill.offsetWidth;
        els.precisionPill.classList.add('precision-pill--pop');
    } else {
        els.precisionPill.classList.add('precision-pill--hidden');
    }
}

// ---------------------------------------------------------------------------
// Spatial 2D FX Overlay Engine (#fx-canvas projected over 3D Viewport!)
// ---------------------------------------------------------------------------

function ensureFxLoop() {
    const hasWork =
        activeGuideArc !== null ||
        fxRipples.length > 0 ||
        fxFloats.length > 0 ||
        fxSparks.length > 0;
    if (hasWork && fxRafId === null) {
        drawFxFrame(performance.now());
        const tick = (now) => {
            drawFxFrame(now);
            const stillBusy =
                activeGuideArc !== null ||
                fxRipples.length > 0 ||
                fxFloats.length > 0 ||
                fxSparks.length > 0;
            if (stillBusy) {
                fxRafId = requestAnimationFrame(tick);
            } else {
                fxRafId = null;
                clearFxCanvas();
            }
        };
        fxRafId = requestAnimationFrame(tick);
    }
}

function clearFxCanvas() {
    if (!fxCanvas || !fxCtx) return;
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
}

export function handleFxResize() {
    if (!fxCanvas || !fxCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = fxCanvas.clientWidth || 0;
    const H = fxCanvas.clientHeight || 0;
    if (W < 40 || H < 40) return;
    const tw = Math.round(W * dpr);
    const th = Math.round(H * dpr);
    if (fxCanvas.width !== tw || fxCanvas.height !== th) {
        fxCanvas.width = tw;
        fxCanvas.height = th;
    }
    const hasWork =
        activeGuideArc !== null ||
        fxRipples.length > 0 ||
        fxFloats.length > 0 ||
        fxSparks.length > 0;
    if (hasWork) {
        drawFxFrame(performance.now());
    } else {
        clearFxCanvas();
    }
}

function projectToFxCanvas(interactId, clampToView = false) {
    if (!fxCanvas || typeof getScreenPointFn !== 'function' || !interactId) return null;
    const raw = getScreenPointFn(interactId);
    if (!raw || !Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return null;
    const rect = fxCanvas.getBoundingClientRect();
    let x = raw.x - rect.left;
    let y = raw.y - rect.top;
    if (clampToView) {
        x = Math.max(22, Math.min(rect.width - 22, x));
        y = Math.max(56, Math.min(rect.height - 28, y));
        return { x, y };
    }
    if (x < -40 || x > rect.width + 40 || y < -40 || y > rect.height + 40) return null;
    return { x, y };
}

export function triggerStepGuideArc(withSound = true) {
    if (!fxCanvas || typeof getScreenPointFn !== 'function') return;
    const state = getState();
    const instr = instructions[state.currentStep];
    if (!instr || !instr.action) return;

    let fromId = null;
    let toId = null;
    if (instr.action === 'fillPipette') {
        fromId = instr.pipette;
        toId = instr.source;
    } else if (instr.action === 'dispensePipette') {
        fromId = instr.pipette;
        toId = instr.destination;
    } else if (instr.action === 'insertCuvette') {
        fromId = instr.cuvette || 'cuvette';
        toId = instr.destination || 'spec20';
    } else if (instr.action === 'emptyCuvette') {
        fromId = instr.cuvette || 'cuvette';
        toId = instr.destination || 'wasteBeaker';
    } else if (instr.action === 'zeroSpec') {
        fromId = 'btn_zero';
        toId = 'btn_zero';
    } else if (instr.action === 'measure') {
        fromId = 'btn_measure';
        toId = 'btn_measure';
    }

    if (!fromId) return;
    activeGuideArc = {
        fromId,
        toId,
        forStep: state.currentStep,
        startMs: performance.now(),
        durationMs: 2600,
    };
    if (withSound) playLabSound('guideArc');
    ensureFxLoop();
}

function pushFxFloat(entry) {
    // Replace any existing floating telemetry badge near the same horizontal region so two badges NEVER collide!
    for (let i = fxFloats.length - 1; i >= 0; i--) {
        if (Math.abs(fxFloats[i].x - entry.x) < 150) {
            fxFloats.splice(i, 1);
        }
    }
    fxFloats.push(entry);
}

export function triggerActionEffectFx(type, payload = {}) {
    if (!fxCanvas || typeof getScreenPointFn !== 'function') return;
    const now = performance.now();

    if (type === 'measure') {
        const pt = projectToFxCanvas('spec20');
        if (pt) {
            fxRipples.push({ x: pt.x, y: pt.y - 12, color: '#f97316', startMs: now, durationMs: 950, maxR: 88 });
            fxRipples.push({ x: pt.x, y: pt.y - 12, color: '#38bdf8', startMs: now + 110, durationMs: 900, maxR: 64 });
            const pctStr = Number.isFinite(payload.percentT) ? `${payload.percentT.toFixed(1)} %T` : '';
            const absStr = Number.isFinite(payload.absorbance) ? `A = ${payload.absorbance.toFixed(4)}` : '';
            pushFxFloat({
                x: pt.x,
                y: pt.y - 42,
                text: `${pctStr} · ${absStr}`,
                accent: '#f97316',
                startMs: now,
                durationMs: 2100,
            });
            ensureFxLoop();
        }
    } else if (type === 'zeroSpec') {
        const pt = projectToFxCanvas('spec20');
        if (pt) {
            fxRipples.push({ x: pt.x, y: pt.y - 10, color: '#22c55e', startMs: now, durationMs: 950, maxR: 84 });
            pushFxFloat({
                x: pt.x,
                y: pt.y - 40,
                text: 'ZEROED · 100.0 %T',
                accent: '#22c55e',
                startMs: now,
                durationMs: 1900,
            });
            ensureFxLoop();
        }
    } else if (type === 'dispensePipette' && payload.destId && payload.destId.startsWith('tube_')) {
        const tubeObj = findObjectById(payload.destId);
        if (tubeObj && tubeObj.currentVolume >= 9.95) {
            const pt = projectToFxCanvas(payload.destId);
            if (pt) {
                const concTxt = tubeObj.concentration < 0.005 ? 'Blank 0.000 µM' : `${tubeObj.concentration.toFixed(3)} µM`;
                fxRipples.push({ x: pt.x, y: pt.y - 8, color: '#38bdf8', startMs: now, durationMs: 750, maxR: 46 });
                pushFxFloat({
                    x: pt.x,
                    y: pt.y - 34,
                    text: concTxt,
                    accent: '#0ea5e9',
                    startMs: now,
                    durationMs: 1800,
                });
                ensureFxLoop();
            }
        }
    }
}

export function triggerSpectralBurst() {
    if (!fxCanvas) return;
    const W = fxCanvas.clientWidth || 900;
    const H = fxCanvas.clientHeight || 520;
    const now = performance.now();
    const palette = ['#38bdf8', '#2563eb', '#22d3ee', '#f97316', '#4ade80', '#a855f7'];
    for (let i = 0; i < 42; i++) {
        const fromLeft = i % 2 === 0;
        const startX = fromLeft ? W * (0.18 + Math.random() * 0.25) : W * (0.57 + Math.random() * 0.25);
        const startY = H * (0.35 + Math.random() * 0.25);
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.45;
        const speed = 70 + Math.random() * 145;
        fxSparks.push({
            x: startX,
            y: startY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 35,
            color: palette[i % palette.length],
            size: 2.5 + Math.random() * 3.0,
            bornMs: now + Math.random() * 140,
            lifeMs: 1350 + Math.random() * 750,
        });
    }
    ensureFxLoop();
}

function drawFxFrame(now) {
    if (!fxCanvas || !fxCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = fxCanvas.clientWidth || 900;
    const H = fxCanvas.clientHeight || 520;
    if (W < 40 || H < 40) return;

    const tw = Math.round(W * dpr);
    const th = Math.round(H * dpr);
    if (fxCanvas.width !== tw || fxCanvas.height !== th) {
        fxCanvas.width = tw;
        fxCanvas.height = th;
    }

    const ctx = fxCtx;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // 1. Guided Spatial Laser Arc (auto-clears immediately once the user advances past forStep!)
    if (activeGuideArc && typeof getScreenPointFn === 'function') {
        const curStep = getState().currentStep;
        const elapsed = Math.max(0, now - activeGuideArc.startMs);
        if (elapsed >= activeGuideArc.durationMs || curStep !== activeGuideArc.forStep || curStep >= instructions.length - 1) {
            activeGuideArc = null;
        } else {
            const p = elapsed / activeGuideArc.durationMs;
            const alpha = p < 0.12 ? Math.max(0.25, p / 0.12) : p > 0.78 ? Math.max(0, (1 - p) / 0.22) : 1;
            const ptA = projectToFxCanvas(activeGuideArc.fromId, true);
            const ptB = projectToFxCanvas(activeGuideArc.toId, true);

            if (ptA && ptB) {
                if (activeGuideArc.fromId === activeGuideArc.toId) {
                    // Single-target beacon ring (Spec 20D+ ZERO / MEASURE)
                    const pulseR = 22 + 16 * Math.sin(elapsed * 0.008) ** 2;
                    ctx.strokeStyle = `rgba(249, 115, 22, ${0.88 * alpha})`;
                    ctx.lineWidth = 2.6;
                    ctx.beginPath();
                    ctx.arc(ptA.x, ptA.y, pulseR, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.fillStyle = `rgba(249, 115, 22, ${0.16 * alpha})`;
                    ctx.beginPath();
                    ctx.arc(ptA.x, ptA.y, pulseR, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    const mx = (ptA.x + ptB.x) / 2;
                    const dist = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
                    const lift = Math.min(130, Math.max(48, dist * 0.34));
                    const my = Math.min(ptA.y, ptB.y) - lift;

                    // Soft glow arc
                    ctx.strokeStyle = `rgba(56, 189, 248, ${0.26 * alpha})`;
                    ctx.lineWidth = 8;
                    ctx.beginPath();
                    ctx.moveTo(ptA.x, ptA.y);
                    ctx.quadraticCurveTo(mx, my, ptB.x, ptB.y);
                    ctx.stroke();

                    // Crisp animated dashed guide
                    ctx.strokeStyle = `rgba(14, 165, 233, ${0.95 * alpha})`;
                    ctx.lineWidth = 2.4;
                    ctx.setLineDash([8, 6]);
                    ctx.lineDashOffset = -(elapsed * 0.065);
                    ctx.beginPath();
                    ctx.moveTo(ptA.x, ptA.y);
                    ctx.quadraticCurveTo(mx, my, ptB.x, ptB.y);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Travelling luminous photon bead along the quadratic Bezier curve
                    const bt = (elapsed * 0.00125) % 1;
                    const inv = 1 - bt;
                    const bx = inv * inv * ptA.x + 2 * inv * bt * mx + bt * bt * ptB.x;
                    const by = inv * inv * ptA.y + 2 * inv * bt * my + bt * bt * ptB.y;
                    ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * alpha})`;
                    ctx.beginPath();
                    ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = `rgba(249, 115, 22, ${0.9 * alpha})`;
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    // Source & Target pulsing halos
                    const rPulse = 14 + 6 * Math.sin(elapsed * 0.01);
                    ctx.strokeStyle = `rgba(56, 189, 248, ${0.85 * alpha})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(ptA.x, ptA.y, rPulse, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.strokeStyle = `rgba(34, 197, 94, ${0.9 * alpha})`;
                    ctx.beginPath();
                    ctx.arc(ptB.x, ptB.y, rPulse + 3, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        }
    }

    // 2. Optical Shockwave Ripples
    for (let i = fxRipples.length - 1; i >= 0; i--) {
        const rp = fxRipples[i];
        const el = now - rp.startMs;
        if (el < 0) continue;
        if (el >= rp.durationMs) {
            fxRipples.splice(i, 1);
            continue;
        }
        const f = el / rp.durationMs;
        const ease = 1 - Math.pow(1 - f, 3);
        const r = 10 + ease * rp.maxR;
        ctx.save();
        ctx.globalAlpha = (1 - f) * 0.78;
        ctx.strokeStyle = rp.color;
        ctx.lineWidth = 2.6 * (1 - f * 0.6);
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // 3. Rising Floating Telemetry Badges (clean vector accent dot + non-overlapping safe vertical lane)
    const light = isLightTheme();
    const toastShowing = Boolean(els.milestoneToast?.classList.contains('milestone-toast--visible'));
    const minFloatY = toastShowing
        ? Math.max(150, (els.milestoneToast.offsetTop || 58) + (els.milestoneToast.offsetHeight || 84) + 12)
        : 64;
    for (let i = fxFloats.length - 1; i >= 0; i--) {
        const fl = fxFloats[i];
        const el = now - fl.startMs;
        if (el >= fl.durationMs) {
            fxFloats.splice(i, 1);
            continue;
        }
        const f = el / fl.durationMs;
        const alpha = f < 0.14 ? f / 0.14 : f > 0.72 ? (1 - f) / 0.28 : 1;
        const yPos = fl.y - f * 38;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '700 11.5px "JetBrains Mono", "Consolas", monospace';
        const textW = ctx.measureText(fl.text).width;
        const tw = textW + 30;
        const bx = Math.max(12, Math.min(W - tw - 12, fl.x - tw / 2));
        const by = Math.max(minFloatY, yPos - 12);

        ctx.fillStyle = light ? 'rgba(255, 255, 255, 0.96)' : 'rgba(9, 14, 26, 0.93)';
        ctx.beginPath();
        ctx.roundRect(bx, by, tw, 24, 999);
        ctx.fill();
        ctx.strokeStyle = fl.accent;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Crisp vector status dot
        ctx.fillStyle = fl.accent;
        ctx.beginPath();
        ctx.arc(bx + 12, by + 12, 3.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = light ? '#0f172a' : '#f8fafc';
        ctx.textAlign = 'left';
        ctx.fillText(fl.text, bx + 20, by + 16);
        ctx.restore();
    }

    // 4. Spectral Milestone Sparks
    for (let i = fxSparks.length - 1; i >= 0; i--) {
        const sp = fxSparks[i];
        const el = now - sp.bornMs;
        if (el < 0) continue;
        if (el >= sp.lifeMs) {
            fxSparks.splice(i, 1);
            continue;
        }
        const dt = el / 1000;
        const f = el / sp.lifeMs;
        const px = sp.x + sp.vx * dt;
        const py = sp.y + sp.vy * dt + 110 * dt * dt;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - f * f);
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(px, py, sp.size * (1 - f * 0.4), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    ctx.restore();
}

// ---------------------------------------------------------------------------
// Milestone Toast with Interactive Quick-Action CTA
// ---------------------------------------------------------------------------

export function dismissMilestoneToast() {
    if (milestoneTimer) {
        clearTimeout(milestoneTimer);
        milestoneTimer = null;
    }
    if (els.milestoneToast) {
        els.milestoneToast.classList.remove('milestone-toast--visible');
    }
}

function showMilestoneToast(milestone) {
    if (!els.milestoneToast) return;
    // Never overlap with ambient stage feedback pill
    if (typeof els.onHideFeedback === 'function') {
        els.onHideFeedback();
    }
    if (els.milestoneTitle) els.milestoneTitle.textContent = milestone.title;
    if (els.milestoneDetail) els.milestoneDetail.textContent = milestone.detail;
    if (els.milestoneCta) {
        if (milestone.ctaLabel) {
            els.milestoneCta.textContent = milestone.ctaLabel;
            els.milestoneCta.hidden = false;
            milestoneCtaAction = milestone.ctaType || null;
        } else {
            els.milestoneCta.hidden = true;
            milestoneCtaAction = null;
        }
    }

    els.milestoneToast.classList.add('milestone-toast--visible');
    playLabSound('milestone');
    triggerSpectralBurst();

    if (milestoneTimer) clearTimeout(milestoneTimer);
    milestoneTimer = setTimeout(() => {
        if (els.milestoneToast) els.milestoneToast.classList.remove('milestone-toast--visible');
        milestoneTimer = null;
    }, 6400);
}

function getStepScienceInsight(stepIdx) {
    const instr = instructions[stepIdx];
    if (!instr || stepIdx >= 83) {
        return {
            tag: 'Experiment Complete',
            tip: 'All 6 standards and the Unknown Drink (3.011 µM ≈ 2.39 mg/L FD&C Blue #1) are complete! Try the A vs. %T morph toggle or print your Lab Report.',
            formula: 'c(unk) = 0.4089 / 0.1358 = 3.011 µM',
        };
    }

    if (stepIdx <= 19) {
        const dilutionMap = [
            { max: 1,  s: 10, w: 0,  conc: '2.310 µM', label: '10/0 Stock' },
            { max: 5,  s: 8,  w: 2,  conc: '1.848 µM', label: '8/2 Standard' },
            { max: 9,  s: 6,  w: 4,  conc: '1.386 µM', label: '6/4 Standard' },
            { max: 13, s: 4,  w: 6,  conc: '0.924 µM', label: '4/6 Standard' },
            { max: 17, s: 2,  w: 8,  conc: '0.462 µM', label: '2/8 Standard' },
            { max: 19, s: 0,  w: 10, conc: '0.000 µM', label: '0/10 Blank' },
        ];
        const cur = dilutionMap.find((d) => stepIdx <= d.max) || dilutionMap[0];
        if (cur.s === 0) {
            return {
                tag: 'Blank Reference',
                tip: 'Distilled H₂O contains 0 µM dye and defines the 100.0 %T (0.000 Abs) optical baseline so glass & solvent reflections cancel out.',
                formula: 'c = 0.000 µM  ⇒  T₀ = 100%',
            };
        }
        return {
            tag: 'Serial Dilution',
            tip: `Dedicated Blue #1 & H₂O pipettes prevent cross-contamination while building ${cur.label} to a 10.0 mL total volume.`,
            formula: `M₂ = 2.31 × (${cur.s}/10) = ${cur.conc}`,
        };
    }

    if (stepIdx >= 20 && stepIdx <= 23) {
        return {
            tag: 'Zero Calibration',
            tip: 'Blanking with pure distilled H₂O locks I₀ (100.0 %T, 0.000 Abs). Fun fact: glass cuvette walls alone reflect ~8% of light — blanking cancels that out!',
            formula: 'T = I / I₀ = 1.000  ⇒  A = 0.0000',
        };
    }

    if (instr.action === 'emptyCuvette' || (instr.text && instr.text.includes('Rinse Cuvette'))) {
        return {
            tag: 'Carryover Control',
            tip: 'Rinsing the optical cuvette with distilled H₂O removes clinging dye droplets — even a 0.1 mL leftover film can shift dilute readings by >5%!',
            formula: 'Zero carryover error',
        };
    }

    if (stepIdx >= 28 && stepIdx <= 75) {
        const stdLabels = [
            { max: 35, name: 'Sample 1 (10/0)', conc: '2.310 µM' },
            { max: 43, name: 'Sample 2 (8/2)',  conc: '1.848 µM' },
            { max: 51, name: 'Sample 3 (6/4)',  conc: '1.386 µM' },
            { max: 59, name: 'Sample 4 (4/6)',  conc: '0.924 µM' },
            { max: 67, name: 'Sample 5 (2/8)',  conc: '0.462 µM' },
            { max: 75, name: 'Blank (0/10)',    conc: '0.000 µM' },
        ];
        const cur = stdLabels.find((s) => stepIdx <= s.max) || stdLabels[0];
        return {
            tag: 'Beer-Lambert Optics',
            tip: `Measuring ${cur.name} (${cur.conc}) at λmax = 630 nm: FD&C Blue #1 absorbs red-orange photons so strongly (ε ≈ 136,000) that 1 drop in a bathtub is still detectable!`,
            formula: 'A = −log₁₀(T) = ε · b · c',
        };
    }

    if (stepIdx === 76) {
        return {
            tag: 'Linear Regression',
            tip: 'All 6 points form a straight line through the origin! Toggle A vs. %T on the Calibration Curve to watch exponential decay morph into linearity.',
            formula: 'm = ΔA / Δc = 0.1358 Abs/µM',
        };
    }

    return {
        tag: 'Unknown Determination',
        tip: 'Using the dedicated Unknown Pipette prevents contaminating the stock standards. Once measured at 630 nm, divide Absorbance by slope m.',
        formula: 'c(unk) = A(unk) / 0.1358',
    };
}

// ---------------------------------------------------------------------------
// Physical Wavelength (400-700 nm) -> RGB, Complementary Wheel & Blue #1 Curve
// ---------------------------------------------------------------------------

function wavelengthToRgb(nm) {
    let r = 0, g = 0, b = 0;
    if (nm >= 380 && nm < 440) {
        r = -(nm - 440) / (440 - 380);
        b = 1.0;
    } else if (nm >= 440 && nm < 490) {
        g = (nm - 440) / (490 - 440);
        b = 1.0;
    } else if (nm >= 490 && nm < 510) {
        g = 1.0;
        b = -(nm - 510) / (510 - 490);
    } else if (nm >= 510 && nm < 580) {
        r = (nm - 510) / (580 - 510);
        g = 1.0;
    } else if (nm >= 580 && nm < 645) {
        r = 1.0;
        g = -(nm - 645) / (645 - 580);
    } else if (nm >= 645 && nm <= 750) {
        r = 1.0;
    }
    let factor = 1.0;
    if (nm < 420) factor = 0.35 + 0.65 * ((nm - 380) / 40);
    else if (nm > 670) factor = 0.35 + 0.65 * ((750 - nm) / 80);

    const gamma = 0.82;
    return {
        r: Math.round(255 * Math.pow(Math.max(0, r * factor), gamma)),
        g: Math.round(255 * Math.pow(Math.max(0, g * factor), gamma)),
        b: Math.round(255 * Math.pow(Math.max(0, b * factor), gamma)),
    };
}

function wavelengthColorName(nm) {
    if (nm < 445) return 'Violet';
    if (nm < 490) return 'Blue';
    if (nm < 520) return 'Cyan-Green';
    if (nm < 565) return 'Green';
    if (nm < 595) return 'Yellow';
    if (nm < 622) return 'Orange';
    if (nm < 650) return 'Red-Orange';
    return 'Deep Red';
}

function complementaryColorName(nm) {
    if (nm < 445) return 'Yellow-Green';
    if (nm < 490) return 'Orange';
    if (nm < 520) return 'Red';
    if (nm < 565) return 'Magenta-Violet';
    if (nm < 595) return 'Indigo-Blue';
    if (nm < 622) return 'Cerulean Blue';
    if (nm < 650) return 'Brilliant Blue';
    return 'Blue-Green';
}

// Piecewise angle mapping calibrated precisely to the 6 SVG slices:
// Red (0-60°), Orange (60-120°), Yellow (120-180°), Green (180-240°), Blue (240-300°), Violet (300-360°)
function wavelengthToWheelDeg(nm) {
    const stops = [
        [400, 345],
        [435, 312],
        [470, 270], // Blue center
        [505, 232],
        [540, 205], // Green center
        [580, 150], // Yellow center
        [608, 96],  // Orange center
        [630, 66],  // Red-Orange (opposite 246° Brilliant Blue!)
        [665, 32],  // Red center
        [700, 14],
    ];
    if (nm <= stops[0][0]) return stops[0][1];
    if (nm >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
    for (let i = 0; i < stops.length - 1; i++) {
        const [w0, a0] = stops[i];
        const [w1, a1] = stops[i + 1];
        if (nm >= w0 && nm <= w1) {
            const f = (nm - w0) / (w1 - w0);
            return a0 + (a1 - a0) * f;
        }
    }
    return 66;
}

function rawBlue1Absorptivity(nm) {
    const mainPeak = Math.exp(-0.5 * ((nm - 630) / 26) ** 2);
    const shoulder = 0.17 * Math.exp(-0.5 * ((nm - 590) / 22) ** 2);
    const uvBlue = 0.14 * Math.exp(-0.5 * ((nm - 410) / 18) ** 2);
    return mainPeak + shoulder + uvBlue;
}
const BLUE1_PEAK_RAW = rawBlue1Absorptivity(630);

function blue1RelativeAbsorptivity(nm) {
    return Math.min(1.0, rawBlue1Absorptivity(nm) / BLUE1_PEAK_RAW);
}

// Always reads the LIVE 3D bench cuvette (never sandbox!) — used by the floating 3D bench X-Ray PiP!
function getLiveBenchOpticsData() {
    const state = getState();
    const cuv = findObjectById('cuvette');
    const wavelength = state.spec20State?.wavelength || 630;

    if (cuv && cuv.currentVolume > 0.05) {
        const isUnknown = cuv.concentration === -1;
        const effectiveConc = isUnknown ? 0.4089 / config.KNOWN_SLOPE : Math.max(0, cuv.concentration || 0);
        let percentT;
        if (isUnknown) {
            percentT = 39.0;
        } else {
            const keys = Object.keys(config.TRANSMITTANCE_LOOKUP)
                .map(Number)
                .sort((a, b) => a - b);
            const exactKey = keys.find((k) => Math.abs(k - effectiveConc) < 0.015);
            if (exactKey !== undefined) {
                percentT = config.TRANSMITTANCE_LOOKUP[exactKey];
            } else {
                percentT = Math.pow(10, -config.KNOWN_SLOPE * effectiveConc) * 100;
            }
        }
        const T = Math.max(0.001, Math.min(1.0, percentT / 100));
        const abs = -Math.log10(T);
        const label = isUnknown
            ? 'Live Cuvette: Unknown Drink'
            : effectiveConc < 0.005
            ? 'Live Cuvette: Distilled H₂O (Blank)'
            : `Live Cuvette: ${effectiveConc.toFixed(3)} µM Blue #1`;
        return {
            sourceLabel: label,
            shortLabel: isUnknown ? 'Live: Unknown' : effectiveConc < 0.005 ? 'Live: Blank' : `Live: ${effectiveConc.toFixed(2)} µM`,
            conc: effectiveConc,
            wavelength,
            abs,
            T,
            percentT,
            isUnknown,
            isEmpty: false,
        };
    }

    return {
        sourceLabel: 'Cuvette Empty — Fill in 3D or try What-If / Scan',
        shortLabel: 'Cuvette Empty',
        conc: 0,
        wavelength,
        abs: 0,
        T: 1.0,
        percentT: 100.0,
        isUnknown: false,
        isEmpty: true,
    };
}

function getEffectiveOpticsData() {
    if (opticsMode === 'sandbox') {
        const relEps = blue1RelativeAbsorptivity(sandboxWavelength);
        const abs = Math.min(2.0, config.KNOWN_SLOPE * relEps * sandboxConc);
        const T = Math.pow(10, -abs);
        const isUnkApprox = Math.abs(sandboxConc - 3.011) < 0.015;
        return {
            sourceLabel: `What-If Sandbox (${sandboxConc.toFixed(2)} µM Blue #1)`,
            shortLabel: `What-If (${sandboxConc.toFixed(2)} µM)`,
            conc: sandboxConc,
            wavelength: sandboxWavelength,
            abs,
            T,
            percentT: T * 100,
            isUnknown: isUnkApprox,
            isEmpty: false,
        };
    }
    return getLiveBenchOpticsData();
}

// ---------------------------------------------------------------------------
// Smart Auto-Triggered Live PiP 630nm X-Ray Optical Beam HUD
// ---------------------------------------------------------------------------

function syncPipVisibility() {
    const cuv = findObjectById('cuvette');
    const hasLiquid = Boolean(cuv && cuv.currentVolume > 0.05);
    const shouldShow = pipUserOverride !== null ? pipUserOverride : hasLiquid;
    pipCurrentlyShown = shouldShow;
    if (els.pipCard) {
        els.pipCard.classList.toggle('pip-optics--hidden', !shouldShow);
        els.pipCard.tabIndex = shouldShow ? 0 : -1;
        els.pipCard.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    }
    if (els.onPipVisibilityChange) {
        els.onPipVisibilityChange(shouldShow);
    }
    ensureOpticsLoop();
}

export function setPipOpticsVisible(visible) {
    pipUserOverride = Boolean(visible);
    syncPipVisibility();
}

export function isPipOpticsVisible() {
    return pipCurrentlyShown;
}

function drawPipOpticsFrame(timeMs) {
    if (!pipCanvas || !pipCtx || !pipCurrentlyShown) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = pipCanvas.clientWidth || 244;
    const H = pipCanvas.clientHeight || 54;
    if (W < 40 || H < 20) return;

    const tw = Math.round(W * dpr);
    const th = Math.round(H * dpr);
    if (pipCanvas.width !== tw || pipCanvas.height !== th) {
        pipCanvas.width = tw;
        pipCanvas.height = th;
    }

    const ctx = pipCtx;
    // Floating 3D bench X-Ray PiP ALWAYS mirrors the real live 3D bench cuvette!
    const opt = getLiveBenchOpticsData();
    const beamRgb = wavelengthToRgb(opt.wavelength);
    const tSec = timeMs * 0.001;

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#070d1b';
    ctx.fillRect(0, 0, W, H);

    const midY = H * 0.52;
    const srcX = 14;
    const cuvL = W * 0.35;
    const cuvW = W * 0.26;
    const cuvR = cuvL + cuvW;
    const cuvTop = 7;
    const cuvH = H - 14;
    const detX = W - 26;

    // Incident beam I0 + glow
    ctx.strokeStyle = `rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, 0.28)`;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(srcX, midY);
    ctx.lineTo(cuvL, midY);
    ctx.stroke();

    ctx.strokeStyle = `rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, 0.95)`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(srcX, midY);
    ctx.lineTo(cuvL, midY);
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
        const f = (tSec * 1.15 + i / 3) % 1;
        const px = srcX + f * (cuvL - srcX);
        ctx.fillStyle = `rgba(255,255,255,${0.88 * Math.sin(f * Math.PI)})`;
        ctx.beginPath();
        ctx.arc(px, midY, 1.8, 0, Math.PI * 2);
        ctx.fill();
    }

    // Attenuated beam inside cuvette
    const innerG = ctx.createLinearGradient(cuvL, midY, cuvR, midY);
    innerG.addColorStop(0, `rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, 0.72)`);
    innerG.addColorStop(1, `rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, ${0.72 * Math.max(0.06, opt.T)})`);
    ctx.fillStyle = innerG;
    ctx.fillRect(cuvL + 2, midY - 6, cuvW - 4, 12);

    // Transmitted beam I
    ctx.strokeStyle = `rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, ${Math.max(0.12, 0.95 * opt.T)})`;
    ctx.lineWidth = Math.max(1.0, 2.6 * Math.sqrt(opt.T));
    ctx.beginPath();
    ctx.moveTo(cuvR, midY);
    ctx.lineTo(detX, midY);
    ctx.stroke();

    const tf = (tSec * 1.15) % 1;
    ctx.fillStyle = `rgba(255,255,255,${0.82 * opt.T * Math.sin(tf * Math.PI)})`;
    ctx.beginPath();
    ctx.arc(cuvR + tf * (detX - cuvR), midY, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Cuvette live liquid & drifting dye molecules
    if (!opt.isEmpty) {
        const a = Math.min(0.76, 0.10 + (opt.conc / 3.2) * 0.66);
        ctx.fillStyle = opt.isUnknown
            ? `rgba(124, 58, 237, ${a})`
            : opt.conc < 0.005
            ? 'rgba(186, 230, 253, 0.16)'
            : `rgba(14, 116, 240, ${a})`;
        ctx.fillRect(cuvL + 2, cuvTop + 6, cuvW - 4, cuvH - 8);

        const nMol = Math.min(18, Math.round((opt.conc / 3.2) * 18));
        for (let i = 0; i < nMol; i++) {
            const p = dyeParticles[i];
            const mx = cuvL + 5 + ((p.u + 0.05 * Math.sin(tSec * p.speed + p.phase) + 1) % 1) * (cuvW - 10);
            const my = cuvTop + 9 + ((p.v + 0.04 * Math.cos(tSec * p.speed + p.phase) + 1) % 1) * (cuvH - 13);
            ctx.fillStyle = opt.isUnknown ? 'rgba(216,180,254,0.88)' : 'rgba(125,211,252,0.9)';
            ctx.beginPath();
            ctx.arc(mx, my, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Cuvette outline
    ctx.strokeStyle = 'rgba(203, 232, 248, 0.74)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(cuvL, cuvTop, cuvW, cuvH, 3);
    ctx.stroke();

    // Source dot
    ctx.fillStyle = `rgb(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b})`;
    ctx.beginPath();
    ctx.arc(srcX, midY, 4.2, 0, Math.PI * 2);
    ctx.fill();

    // Detector mini bar
    ctx.fillStyle = '#111b2e';
    ctx.strokeStyle = 'rgba(132, 204, 22, 0.68)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(detX, cuvTop + 3, 18, cuvH - 6, 3);
    ctx.fill();
    ctx.stroke();
    const bh = (cuvH - 12) * opt.T;
    ctx.fillStyle = '#a3e635';
    ctx.fillRect(detX + 4, cuvTop + cuvH - 6 - bh, 10, bh);

    ctx.restore();

    if (els.pipReading) {
        els.pipReading.textContent = opt.isEmpty
            ? 'Empty • 100%T'
            : `${opt.percentT.toFixed(1)}%T • ${opt.abs.toFixed(3)}A`;
    }
}

// ---------------------------------------------------------------------------
// Full Quantum Photon-Collision Spectronic 20D+ Cutaway (#optics-canvas)
// ---------------------------------------------------------------------------

function drawOpticsFrame(timeMs) {
    if (!opticsCanvas || !opticsCtx || !opticsTabActive) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = opticsCanvas.clientWidth || 540;
    const H = opticsCanvas.clientHeight || 232;
    if (W < 40 || H < 40) return;

    const tw = Math.round(W * dpr);
    const th = Math.round(H * dpr);
    if (opticsCanvas.width !== tw || opticsCanvas.height !== th) {
        opticsCanvas.width = tw;
        opticsCanvas.height = th;
    }

    const ctx = opticsCtx;
    const opt = getEffectiveOpticsData();
    const beamRgb = wavelengthToRgb(opt.wavelength);
    const beamCss = `rgb(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b})`;
    const tSec = timeMs * 0.001;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Dark optical bench chamber (authentic interior of spectrophotometer so photons pop!)
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#070d1b');
    bg.addColorStop(0.5, '#0b1427');
    bg.addColorStop(1, '#070d1b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 24; x < W; x += 24) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
    }
    for (let y = 24; y < H; y += 24) {
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
    }
    ctx.stroke();

    const compact = W < 440;
    const midY = H * 0.50;
    const lampX = W * 0.08;
    const slit1X = W * 0.19;
    const prismX = W * 0.29;
    const slit2X = W * 0.40;
    const cuvLeft = W * (compact ? 0.52 : 0.55);
    const cuvW = compact ? Math.max(54, W * 0.17) : Math.max(60, W * 0.16);
    const cuvRight = cuvLeft + cuvW;
    const cuvH = H * 0.54;
    const cuvTop = midY - cuvH / 2;
    const detW = compact ? 38 : 42;
    const detX = Math.min(W * 0.875, W - detW - 10);

    ctx.fillStyle = '#94a3b8';
    ctx.font = compact
        ? '600 9.5px "JetBrains Mono", "Consolas", monospace'
        : '600 10.5px "JetBrains Mono", "Consolas", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(compact ? (opt.shortLabel || opt.sourceLabel) : opt.sourceLabel, 12, 18);
    ctx.textAlign = 'right';
    ctx.fillStyle = beamCss;
    ctx.fillText(
        compact ? `λ = ${opt.wavelength} nm` : `λ = ${opt.wavelength} nm (${wavelengthColorName(opt.wavelength)})`,
        W - 12,
        18
    );

    // Polychromatic white light cone
    const whiteGrad = ctx.createLinearGradient(lampX, midY, prismX, midY);
    whiteGrad.addColorStop(0, 'rgba(255, 245, 214, 0.92)');
    whiteGrad.addColorStop(0.55, 'rgba(255, 249, 232, 0.52)');
    whiteGrad.addColorStop(1, 'rgba(226, 238, 255, 0.34)');
    ctx.fillStyle = whiteGrad;
    ctx.beginPath();
    ctx.moveTo(lampX, midY - 4);
    ctx.lineTo(slit1X, midY - 12);
    ctx.lineTo(prismX, midY - 9);
    ctx.lineTo(prismX, midY + 9);
    ctx.lineTo(slit1X, midY + 12);
    ctx.lineTo(lampX, midY + 4);
    ctx.closePath();
    ctx.fill();

    // Dispersed rainbow fan from diffraction grating
    [430, 475, 520, 575, 625, 675].forEach((wl, idx) => {
        const c = wavelengthToRgb(wl);
        const yOff = (idx - 2.5) * 9.5;
        const isNearSel = Math.abs(wl - opt.wavelength) < 34;
        ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${isNearSel ? 0.72 : 0.35})`;
        ctx.lineWidth = isNearSel ? 5 : 3.8;
        ctx.beginPath();
        ctx.moveTo(prismX + 6, midY);
        ctx.lineTo(slit2X, midY + yOff);
        ctx.stroke();
    });

    // Monochromatic Incident Beam I0 glow + core
    const beamH = 20;
    const i0Glow = ctx.createLinearGradient(0, midY - beamH, 0, midY + beamH);
    i0Glow.addColorStop(0, `rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, 0)`);
    i0Glow.addColorStop(0.5, `rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, 0.50)`);
    i0Glow.addColorStop(1, `rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, 0)`);
    ctx.fillStyle = i0Glow;
    ctx.fillRect(slit2X, midY - beamH, cuvLeft - slit2X, beamH * 2);

    ctx.strokeStyle = `rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, 0.92)`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(slit2X, midY);
    ctx.lineTo(cuvLeft, midY);
    ctx.stroke();

    // Exponential attenuation gradient inside cuvette
    const transFrac = Math.max(0.05, Math.min(1.0, opt.T));
    const innerGrad = ctx.createLinearGradient(cuvLeft, midY, cuvRight, midY);
    innerGrad.addColorStop(0, `rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, 0.65)`);
    innerGrad.addColorStop(1, `rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, ${0.65 * transFrac})`);
    ctx.fillStyle = innerGrad;
    ctx.fillRect(cuvLeft + 3, midY - beamH * 0.68, cuvW - 6, beamH * 1.36);

    // Transmitted beam I glow + core
    const tAlpha = Math.max(0.08, 0.92 * opt.T);
    const tGlow = ctx.createLinearGradient(0, midY - beamH, 0, midY + beamH);
    tGlow.addColorStop(0, `rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, 0)`);
    tGlow.addColorStop(0.5, `rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, ${0.48 * opt.T})`);
    tGlow.addColorStop(1, `rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, 0)`);
    ctx.fillStyle = tGlow;
    ctx.fillRect(cuvRight, midY - beamH, detX - cuvRight, beamH * 2);

    ctx.strokeStyle = `rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, ${tAlpha})`;
    ctx.lineWidth = Math.max(1.1, 2.8 * Math.sqrt(opt.T));
    ctx.beginPath();
    ctx.moveTo(cuvRight, midY);
    ctx.lineTo(detX, midY);
    ctx.stroke();

    // 1.0 cm Cuvette solution & drifting solute molecules
    const solAlpha = opt.isEmpty ? 0.04 : Math.min(0.76, 0.08 + (opt.conc / 3.2) * 0.68);
    const solColor = opt.isUnknown
        ? `rgba(124, 58, 237, ${solAlpha})`
        : opt.conc < 0.005
        ? `rgba(186, 230, 253, ${opt.isEmpty ? 0.03 : 0.14})`
        : `rgba(14, 116, 240, ${solAlpha})`;

    if (!opt.isEmpty) {
        ctx.fillStyle = solColor;
        ctx.fillRect(cuvLeft + 3, cuvTop + 14, cuvW - 6, cuvH - 18);

        ctx.strokeStyle = 'rgba(224, 242, 254, 0.55)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cuvLeft + 3, cuvTop + 14);
        ctx.quadraticCurveTo(cuvLeft + cuvW / 2, cuvTop + 19, cuvRight - 3, cuvTop + 14);
        ctx.stroke();

        const activeMolecules = Math.min(dyeParticles.length, Math.round((opt.conc / 3.2) * dyeParticles.length));
        for (let i = 0; i < activeMolecules; i++) {
            const p = dyeParticles[i];
            const mx = cuvLeft + 8 + ((p.u + 0.04 * Math.sin(tSec * p.speed + p.phase) + 1) % 1) * (cuvW - 16);
            const my = cuvTop + 22 + ((p.v + 0.03 * Math.cos(tSec * p.speed * 0.8 + p.phase) + 1) % 1) * (cuvH - 30);
            const inBeam = Math.abs(my - midY) < 14;
            ctx.fillStyle = opt.isUnknown
                ? inBeam ? 'rgba(216, 180, 254, 0.92)' : 'rgba(168, 85, 247, 0.65)'
                : inBeam ? 'rgba(125, 211, 252, 0.95)' : 'rgba(59, 130, 246, 0.68)';
            ctx.beginPath();
            ctx.arc(mx, my, inBeam ? 2.5 : 1.9, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // --- QUANTUM PHOTON PACKETS & REAL-TIME MOLECULAR ABSORPTION FLASHES ---
    const totalPathLen = detX - slit2X;
    for (let i = 0; i < photonLanes.length; i++) {
        const lane = photonLanes[i];
        const frac = (tSec * 0.52 + lane.offset) % 1;
        const px = slit2X + frac * totalPathLen;
        const py = midY + lane.yFrac * 11;
        const willBeAbsorbed = !opt.isEmpty && lane.rank >= opt.T;
        const absorbX = cuvLeft + 6 + lane.absorbDepth * (cuvW - 12);

        if (willBeAbsorbed && px >= absorbX) {
            // Photon was just absorbed! Render a crisp quantum molecular excitation flash ring
            const sinceHit = (px - absorbX) / Math.max(24, cuvW * 0.55);
            if (sinceHit >= 0 && sinceHit < 1) {
                const ringR = 2.5 + sinceHit * 11;
                ctx.save();
                ctx.globalAlpha = (1 - sinceHit) * 0.92;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.arc(absorbX, py, ringR, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = `rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, 0.55)`;
                ctx.beginPath();
                ctx.arc(absorbX, py, 3.2 * (1 - sinceHit * 0.5), 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
            continue;
        }

        // Draw luminous traveling wave-packet photon
        const waveY = py + Math.sin(px * 0.18 - tSec * 14) * 1.4;
        ctx.fillStyle = `rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, 0.55)`;
        ctx.beginPath();
        ctx.arc(px, waveY, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, waveY, 2.0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Cuvette outline & 1.0 cm path length callout
    ctx.strokeStyle = 'rgba(203, 232, 248, 0.78)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cuvLeft, cuvTop, cuvW, cuvH, 4);
    ctx.stroke();

    const dimY = cuvTop + cuvH + 11;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cuvLeft, dimY - 3);
    ctx.lineTo(cuvLeft, dimY + 3);
    ctx.moveTo(cuvLeft, dimY);
    ctx.lineTo(cuvRight, dimY);
    ctx.moveTo(cuvRight, dimY - 3);
    ctx.lineTo(cuvRight, dimY + 3);
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 9.5px "JetBrains Mono", "Consolas", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('b = 1.0 cm', cuvLeft + cuvW / 2, dimY + 13);

    // Tungsten Lamp
    const lampGlow = ctx.createRadialGradient(lampX, midY, 2, lampX, midY, 24);
    lampGlow.addColorStop(0, 'rgba(255, 250, 224, 1)');
    lampGlow.addColorStop(0.45, 'rgba(251, 191, 36, 0.55)');
    lampGlow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = lampGlow;
    ctx.beginPath();
    ctx.arc(lampX, midY, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(lampX, midY, 11, 0, Math.PI * 2);
    ctx.stroke();

    // Slits
    const drawSlit = (sx, gap) => {
        ctx.fillStyle = '#475569';
        ctx.fillRect(sx - 2.5, midY - 34, 5, 34 - gap);
        ctx.fillRect(sx - 2.5, midY + gap, 5, 34 - gap);
    };
    drawSlit(slit1X, 9);
    drawSlit(slit2X, 5);

    // Diffraction Grating Prism
    ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(prismX, midY - 24);
    ctx.lineTo(prismX + 18, midY + 20);
    ctx.lineTo(prismX - 18, midY + 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Photodiode Detector
    ctx.fillStyle = '#111b2e';
    ctx.strokeStyle = 'rgba(132, 204, 22, 0.68)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(detX, midY - 28, detW, 56, 6);
    ctx.fill();
    ctx.stroke();

    const barH = 38 * opt.T;
    ctx.fillStyle = 'rgba(163, 230, 53, 0.16)';
    ctx.fillRect(detX + 7, midY - 19, 9, 38);
    ctx.fillStyle = '#a3e635';
    ctx.fillRect(detX + 7, midY + 19 - barH, 9, barH);

    ctx.fillStyle = '#bef264';
    ctx.font = '700 8.5px "JetBrains Mono", "Consolas", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${opt.percentT.toFixed(0)}%`, detX + (compact ? 27 : 29), midY + 3);

    const capY = H - 10;
    ctx.fillStyle = '#94a3b8';
    ctx.font = compact ? '600 9px "Inter", "Segoe UI", sans-serif' : '600 10px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Lamp', lampX, capY);
    ctx.fillText('Grating', prismX, capY);
    ctx.fillText('Slit', slit2X, capY);
    ctx.fillText('Detector', Math.min(detX + detW / 2, W - 24), capY);

    ctx.font = compact
        ? '700 9px "JetBrains Mono", "Consolas", monospace'
        : '700 10.5px "JetBrains Mono", "Consolas", monospace';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(compact ? 'I₀' : 'I₀ (100%)', (slit2X + cuvLeft) / 2, midY - 19);
    ctx.fillStyle = '#bef264';
    ctx.fillText(compact ? `${opt.percentT.toFixed(0)}%` : `I (${opt.percentT.toFixed(1)}%)`, (cuvRight + detX) / 2, midY - 19);

    ctx.restore();
    updateOpticsReadoutDom(opt, beamCss);
}

function updateOpticsReadoutDom(opt, beamCss) {
    const detectedCount = Math.round(opt.percentT);
    const absorbedCount = Math.max(0, 100 - detectedCount);
    const relEpsPct = Math.round(blue1RelativeAbsorptivity(opt.wavelength) * 100);
    const beamRgb = wavelengthToRgb(opt.wavelength);

    if (els.photonTallySent) els.photonTallySent.textContent = '100 Sent';
    if (els.photonTallyAbs) els.photonTallyAbs.textContent = `${absorbedCount} Absorbed`;
    if (els.photonTallyDet) els.photonTallyDet.textContent = `${detectedCount} Detected (${opt.percentT.toFixed(1)}%T)`;

    if (els.opticsI0) els.opticsI0.textContent = '100.0%';
    if (els.opticsT) els.opticsT.textContent = `${opt.percentT.toFixed(1)} %T`;
    if (els.opticsAbs) els.opticsAbs.textContent = `${opt.abs.toFixed(4)} Abs`;
    if (els.opticsConc) {
        els.opticsConc.textContent = opt.isEmpty ? 'Empty' : `${opt.conc.toFixed(3)} µM`;
    }
    // Keep locked slider readouts in sync with Live Bench cuvette so sliders never show stale values!
    if (opticsMode === 'live') {
        const liveConc = opt.isEmpty ? 0 : Math.min(3.5, opt.conc);
        if (els.concSlider) els.concSlider.value = liveConc.toFixed(2);
        if (els.concVal) els.concVal.textContent = opt.isEmpty ? '0.00 µM (Live)' : `${opt.conc.toFixed(2)} µM (Live)`;
        if (els.wlSlider) els.wlSlider.value = String(opt.wavelength);
        if (els.wlVal) els.wlVal.textContent = `${opt.wavelength} nm`;
    }
    if (els.tabBeamDot) {
        els.tabBeamDot.style.background = beamCss;
        els.tabBeamDot.style.boxShadow = `0 0 8px ${beamCss}`;
    }
    if (els.tabBeamLabel) {
        els.tabBeamLabel.textContent = `${opt.wavelength} nm`;
    }
    if (els.wheelNeedleGroup) {
        const deg = wavelengthToWheelDeg(opt.wavelength);
        els.wheelNeedleGroup.setAttribute('transform', `rotate(${deg.toFixed(1)} 40 40)`);
    }
    if (els.wheelNeedleLine) els.wheelNeedleLine.setAttribute('stroke', beamCss);
    if (els.wheelNeedleTip) els.wheelNeedleTip.setAttribute('fill', beamCss);

    if (els.wheelAbsLabel) {
        const peakSuffix = Math.abs(opt.wavelength - 630) <= 10
            ? ' — λmax Peak!'
            : relEpsPct < 15
            ? ' — Barely Absorbed'
            : ` — ${relEpsPct}% Rel. ε`;
        els.wheelAbsLabel.textContent = `Beam λ: ${opt.wavelength} nm (${wavelengthColorName(opt.wavelength)})${peakSuffix}`;
    }
    if (els.wheelTransLabel) {
        if (Math.abs(opt.wavelength - 630) <= 18) {
            els.wheelTransLabel.textContent = `Blue #1 absorbs ${relEpsPct}% here · Eye sees Brilliant Blue`;
        } else if (opt.wavelength >= 440 && opt.wavelength <= 505) {
            els.wheelTransLabel.textContent = `Blue #1 transmits blue light here (Complement: ${complementaryColorName(opt.wavelength)})`;
        } else {
            els.wheelTransLabel.textContent = `Complement: ${complementaryColorName(opt.wavelength)} · Blue #1 absorbs ${relEpsPct}% here`;
        }
    }
    if (els.eyeVialBeam) {
        // Visually attenuate the monochromatic beam from left (I₀=100%) to right (I=T) right inside the vial!
        const exitAlpha = Math.max(0.14, Math.min(1, opt.T));
        els.eyeVialBeam.style.background = `linear-gradient(90deg, rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, 1) 0%, rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, ${exitAlpha.toFixed(2)}) 100%)`;
        els.eyeVialBeam.style.boxShadow = `0 0 8px rgba(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b}, 0.72)`;
    }
    if (els.eyeVialLiquid) {
        const alpha = opt.isEmpty ? 0.14 : Math.min(0.95, 0.25 + (opt.conc / 3.2) * 0.70);
        els.eyeVialLiquid.style.opacity = String(alpha);
        els.eyeVialLiquid.style.background = opt.isUnknown
            ? 'linear-gradient(180deg, #a855f7, #6d28d9)'
            : 'linear-gradient(180deg, #38bdf8, #1d4ed8)';
    }
    if (els.eyeVialLbl) {
        els.eyeVialLbl.textContent = `${opt.wavelength} nm`;
    }
}

// ---------------------------------------------------------------------------
// Theme-Aware Interactive 400-700 nm FD&C Blue #1 Absorption Spectrum
// ---------------------------------------------------------------------------

export function drawSpectrumChart() {
    if (!spectrumCanvas || !spectrumCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = spectrumCanvas.clientWidth || 380;
    const H = spectrumCanvas.clientHeight || 212;
    if (W < 40 || H < 40) return;

    const tw = Math.round(W * dpr);
    const th = Math.round(H * dpr);
    if (spectrumCanvas.width !== tw || spectrumCanvas.height !== th) {
        spectrumCanvas.width = tw;
        spectrumCanvas.height = th;
    }

    const light = isLightTheme();
    const ctx = spectrumCtx;
    const opt = getEffectiveOpticsData();
    const selNm = opt.wavelength;
    const selRel = blue1RelativeAbsorptivity(selNm);

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = light ? '#ffffff' : '#070d1a';
    ctx.fillRect(0, 0, W, H);

    const pad = { top: 28, right: 18, bottom: 44, left: 42 };
    const pw = Math.max(40, W - pad.left - pad.right);
    const ph = Math.max(40, H - pad.top - pad.bottom);

    const xOfNm = (nm) => pad.left + ((nm - 400) / 300) * pw;
    const yOfRel = (rel) => pad.top + ph - rel * ph * 0.84;

    // Subtle plot background in light mode
    if (light) {
        ctx.fillStyle = 'rgba(241, 245, 249, 0.55)';
        ctx.fillRect(pad.left, pad.top, pw, ph);
    }

    // Visible spectrum rainbow ribbon along x-axis
    const barY = pad.top + ph + 4;
    const barH = 10;
    for (let px = 0; px < pw; px += 2) {
        const nm = 400 + (px / pw) * 300;
        const c = wavelengthToRgb(nm);
        ctx.fillStyle = `rgb(${c.r}, ${c.g}, ${c.b})`;
        ctx.fillRect(pad.left + px, barY, 2.5, barH);
    }

    ctx.strokeStyle = light ? 'rgba(15, 23, 42, 0.08)' : 'rgba(148, 163, 184, 0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i <= 4; i++) {
        const y = pad.top + (ph / 4) * i;
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + pw, y);
    }
    ctx.stroke();

    // Spectral fill under FD&C Blue #1 absorption curve
    const curveGrad = ctx.createLinearGradient(pad.left, 0, pad.left + pw, 0);
    curveGrad.addColorStop(0.0, light ? 'rgba(139, 92, 246, 0.18)' : 'rgba(139, 92, 246, 0.24)');
    curveGrad.addColorStop(0.3, light ? 'rgba(37, 99, 235, 0.12)' : 'rgba(59, 130, 246, 0.15)');
    curveGrad.addColorStop(0.6, light ? 'rgba(234, 179, 8, 0.18)' : 'rgba(234, 179, 8, 0.22)');
    curveGrad.addColorStop(0.77, light ? 'rgba(234, 88, 12, 0.36)' : 'rgba(249, 115, 22, 0.46)');
    curveGrad.addColorStop(1.0, light ? 'rgba(220, 38, 38, 0.22)' : 'rgba(239, 68, 68, 0.26)');

    ctx.fillStyle = curveGrad;
    ctx.beginPath();
    ctx.moveTo(xOfNm(400), pad.top + ph);
    for (let nm = 400; nm <= 700; nm += 2) {
        ctx.lineTo(xOfNm(nm), yOfRel(blue1RelativeAbsorptivity(nm)));
    }
    ctx.lineTo(xOfNm(700), pad.top + ph);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = light ? '#0284c7' : '#38bdf8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let nm = 400; nm <= 700; nm += 2) {
        const x = xOfNm(nm);
        const y = yOfRel(blue1RelativeAbsorptivity(nm));
        if (nm === 400) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // λmax annotation (positioned cleanly above peak dot so it never overlaps marker)
    const x630 = xOfNm(630);
    const y630 = yOfRel(blue1RelativeAbsorptivity(630));
    ctx.fillStyle = light ? '#c2410c' : '#fb923c';
    ctx.font = '700 10px "JetBrains Mono", "Consolas", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('λmax = 630 nm', Math.min(x630, W - 56), Math.max(15, y630 - 13));

    // Active wavelength vertical indicator & glowing handle (starts cleanly from peak dot so λmax text is never crossed!)
    const sx = xOfNm(selNm);
    const sy = yOfRel(selRel);
    const sc = wavelengthToRgb(selNm);
    const sCss = `rgb(${sc.r}, ${sc.g}, ${sc.b})`;

    ctx.strokeStyle = sCss;
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(sx, sy + 6);
    ctx.lineTo(sx, pad.top + ph + barH + 4);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = sCss;
    ctx.beginPath();
    ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = light ? '#0f172a' : '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Axes
    ctx.strokeStyle = light ? 'rgba(15, 23, 42, 0.36)' : 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, pad.top + ph);
    ctx.lineTo(pad.left + pw, pad.top + ph);
    ctx.stroke();

    ctx.fillStyle = light ? '#475569' : '#94a3b8';
    ctx.font = '10px "JetBrains Mono", "Consolas", monospace';
    ctx.textAlign = 'center';
    for (let nm = 400; nm <= 700; nm += 50) {
        ctx.fillText(`${nm}`, xOfNm(nm), barY + barH + 13);
    }
    ctx.fillStyle = light ? '#334155' : '#cbd5e1';
    ctx.font = '600 10px "Inter", "Segoe UI", sans-serif';
    ctx.fillText('Wavelength λ (nm) — drag curve or click Scan', pad.left + pw / 2, H - 4);

    ctx.save();
    ctx.translate(13, pad.top + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Relative Absorbance', 0, 0);
    ctx.restore();

    ctx.restore();

    if (els.spectrumCallout) {
        const absPct = Math.round(selRel * 100);
        const note =
            Math.abs(selNm - 630) <= 12
                ? 'Peak sensitivity (λmax) — maximum photon absorption for FD&C Blue #1!'
                : selNm < 510
                ? 'Blue #1 transmits blue light here — photons sail right through with weak sensitivity.'
                : 'Off-peak shoulder — noticeably lower sensitivity than 630 nm.';
        els.spectrumCallout.innerHTML = `
            <span class="color-pair">
                <span class="color-dot" style="background:${sCss};"></span>
                <strong>${selNm} nm (${wavelengthColorName(selNm)})</strong> · Rel. ε = ${absPct}%
            </span>
            <span>${note}</span>
        `;
    }
    updateOpticsReadoutDom(opt, sCss);
}

// ---------------------------------------------------------------------------
// Auto-Scan Monochromator 400 -> 700 nm Sweep + Dramatic Lock on λmax = 630 nm!
// ---------------------------------------------------------------------------

function stopSpectrumScan() {
    if (scanRafId !== null) {
        cancelAnimationFrame(scanRafId);
        scanRafId = null;
    }
    isScanning = false;
    if (els.opticsScanBtn) {
        els.opticsScanBtn.innerHTML =
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12c2.5-6 5.5-6 8 0s5.5 6 8 0c1-2.4 2.4-3.6 4-3.6"></path></svg><span>Scan 400→700 nm</span>';
        els.opticsScanBtn.classList.remove('button--accent-active');
    }
}

function startSpectrumScan(applyOpticsModeFn) {
    if (isScanning) {
        stopSpectrumScan();
        return;
    }
    isScanning = true;
    if (sandboxConc < 0.4) {
        sandboxConc = config.STOCK_CONCENTRATION;
        if (els.concSlider) els.concSlider.value = String(sandboxConc);
        if (els.concVal) els.concVal.textContent = `${sandboxConc.toFixed(2)} µM`;
    }
    applyOpticsModeFn('sandbox');
    if (els.opticsScanBtn) {
        els.opticsScanBtn.innerHTML =
            '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2.5"></rect></svg><span>Scanning…</span>';
        els.opticsScanBtn.classList.add('button--accent-active');
    }

    const startTime = performance.now();
    const sweepDuration = 2800; // 400 -> 700 nm
    const lockDuration = 750;   // smooth return 700 -> 630 nm peak lock

    const tick = (now) => {
        if (!isScanning) return;
        const el = now - startTime;
        if (el < sweepDuration) {
            const f = el / sweepDuration;
            sandboxWavelength = Math.round(400 + f * 300);
        } else if (el < sweepDuration + lockDuration) {
            const f = (el - sweepDuration) / lockDuration;
            const ease = 1 - Math.pow(1 - f, 3);
            sandboxWavelength = Math.round(700 - ease * 70);
        } else {
            sandboxWavelength = 630;
            if (els.wlSlider) els.wlSlider.value = '630';
            if (els.wlVal) els.wlVal.textContent = '630 nm';
            drawSpectrumChart();
            playLabSound('scanPeak');
            stopSpectrumScan();
            return;
        }
        if (els.wlSlider) els.wlSlider.value = String(sandboxWavelength);
        if (els.wlVal) els.wlVal.textContent = `${sandboxWavelength} nm`;
        drawSpectrumChart();
        scanRafId = requestAnimationFrame(tick);
    };
    scanRafId = requestAnimationFrame(tick);
}

// Unified 60fps optical animation loop powering BOTH PiP X-Ray HUD & Full Cutaway
function ensureOpticsLoop() {
    const shouldRun = opticsTabActive || pipCurrentlyShown;
    if (shouldRun && opticsRafId === null) {
        const tick = (now) => {
            if (!opticsTabActive && !pipCurrentlyShown) {
                opticsRafId = null;
                return;
            }
            if (pipCurrentlyShown) drawPipOpticsFrame(now);
            if (opticsTabActive) drawOpticsFrame(now);
            opticsRafId = requestAnimationFrame(tick);
        };
        opticsRafId = requestAnimationFrame(tick);
    } else if (!shouldRun && opticsRafId !== null) {
        cancelAnimationFrame(opticsRafId);
        opticsRafId = null;
    }
}

export function setOpticsTabActive(isActive) {
    opticsTabActive = Boolean(isActive);
    if (opticsTabActive) {
        drawSpectrumChart();
    } else {
        stopSpectrumScan();
    }
    ensureOpticsLoop();
}

export function refreshThemeVisuals() {
    drawSpectrumChart();
    if (opticsTabActive) drawOpticsFrame(performance.now());
    if (pipCurrentlyShown) drawPipOpticsFrame(performance.now());
}

// ---------------------------------------------------------------------------
// Interactive Unknown Solver Challenge & AP Chemistry Concept Check
// ---------------------------------------------------------------------------

function handleUnknownSolverCheck() {
    if (!els.solverInput || !els.solverFeedback) return;
    const raw = parseFloat(els.solverInput.value);
    const expected = 0.4089 / config.KNOWN_SLOPE; // ~3.0110 µM
    const mgL = (expected * BLUE1_MOLAR_MASS) / 1000;
    if (!Number.isFinite(raw)) {
        els.solverFeedback.className = 'solver-feedback solver-feedback--wrong';
        els.solverFeedback.textContent = 'Enter a numeric value in µM (hint: divide A by slope m).';
        return;
    }
    if (Math.abs(raw - expected) <= 0.03) {
        els.solverFeedback.className = 'solver-feedback solver-feedback--correct';
        els.solverFeedback.textContent = `Verified Analytical Chemist — ${expected.toFixed(3)} µM ≈ ${mgL.toFixed(2)} mg/L FD&C Blue #1 (~25,000× below FDA daily limit)!`;
        playLabSound('milestone');
        triggerSpectralBurst();
    } else {
        els.solverFeedback.className = 'solver-feedback solver-feedback--wrong';
        els.solverFeedback.textContent = `Check your division: c = A / m = 0.4089 / 0.1358 (try rounding to 3 decimals).`;
        playLabSound('error');
    }
}

function renderQuiz() {
    if (!els.quizList) return;
    els.quizList.innerHTML = '';

    QUIZ_BANK.forEach((item) => {
        const chosen = quizAnswers.has(item.id) ? quizAnswers.get(item.id) : null;
        const card = document.createElement('div');
        card.className = 'quiz-card';

        const qEl = document.createElement('p');
        qEl.className = 'quiz-card__q';
        qEl.textContent = item.question;
        card.appendChild(qEl);

        const optsWrap = document.createElement('div');
        optsWrap.className = 'quiz-options';

        item.options.forEach((optText, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'quiz-opt';
            btn.textContent = optText;
            if (chosen !== null) {
                if (idx === item.correct) btn.classList.add('quiz-opt--correct');
                else if (idx === chosen && chosen !== item.correct) btn.classList.add('quiz-opt--wrong');
            }
            btn.addEventListener('click', () => {
                quizAnswers.set(item.id, idx);
                playLabSound(idx === item.correct ? 'measure' : 'error');
                renderQuiz();
                updateQuizBadge();
            });
            optsWrap.appendChild(btn);
        });
        card.appendChild(optsWrap);

        if (chosen !== null) {
            const isRight = chosen === item.correct;
            const exp = document.createElement('div');
            exp.className = `quiz-explain ${isRight ? 'quiz-explain--correct' : 'quiz-explain--wrong'}`;
            exp.textContent = `${isRight ? 'Correct — ' : 'Review — '}${item.explanation}`;
            card.appendChild(exp);
        }

        els.quizList.appendChild(card);
    });
}

function getQuizScore() {
    let correct = 0;
    QUIZ_BANK.forEach((item) => {
        if (quizAnswers.get(item.id) === item.correct) correct++;
    });
    return { correct, total: QUIZ_BANK.length };
}

function updateQuizBadge() {
    const { correct, total } = getQuizScore();
    if (els.quizScoreBadge) {
        els.quizScoreBadge.textContent = `${correct}/${total}`;
    }
}

// ---------------------------------------------------------------------------
// Formal Printable / Exportable AP Chemistry Lab Report Modal & CSV Export
// ---------------------------------------------------------------------------

function buildLabCsv() {
    const state = getState();
    const lines = [
        'Solution,Dilution (Stock/Water),Concentration (uM),Measured %T,T (Decimal),Absorbance (-log10 T)',
    ];
    state.dataTableData.forEach((row) => {
        let concStr = row.conc !== null ? row.conc.toFixed(3) : 'N/A';
        let absStr = row.negLogT !== null && isFinite(row.negLogT) ? parseFloat(row.negLogT).toFixed(4) : '';
        if (row.id === 'unknown' && row.negLogT !== null && isFinite(row.negLogT)) {
            concStr = (row.negLogT / config.KNOWN_SLOPE).toFixed(3);
        }
        const pctT = row.measuredPercentT !== null ? row.measuredPercentT : '';
        const tDec = row.T !== null ? row.T : '';
        lines.push(`"${row.solution}","${row.dilution}",${concStr},${pctT},${tDec},${absStr}`);
    });
    lines.push('');
    lines.push(`"Calibration Slope (Abs/uM)",${config.KNOWN_SLOPE}`);
    lines.push(`"Wavelength (nm)",${config.TARGET_WAVELENGTH}`);
    return lines.join('\n');
}

function triggerCsvExport() {
    const csv = buildLabCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spectrophotometry_beers_law_data.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    if (els.exportStatus) {
        els.exportStatus.textContent = 'Downloaded spectrophotometry_beers_law_data.csv';
        setTimeout(() => {
            if (els.exportStatus) els.exportStatus.textContent = '';
        }, 3000);
    }
}

async function copyLabSummary() {
    const state = getState();
    const measured = state.dataTableData.filter((r) => r.measuredPercentT !== null);
    const unk = state.dataTableData.find((r) => r.id === 'unknown');
    const unkMeasured = unk && unk.negLogT !== null && isFinite(unk.negLogT);
    const unkConcVal = unkMeasured ? unk.negLogT / config.KNOWN_SLOPE : null;
    const unkConc = unkConcVal !== null
        ? `${unkConcVal.toFixed(3)} µM (${((unkConcVal * BLUE1_MOLAR_MASS) / 1000).toFixed(2)} mg/L Blue #1)`
        : 'Not yet measured';
    const { correct, total } = getQuizScore();

    const text = [
        '# AP Chemistry — Spectrophotometry Lab Report (Beer-Lambert Law)',
        `- **Analyte:** FD&C Blue #1 (Brilliant Blue FCF) at λ = 630 nm, b = 1.00 cm`,
        `- **Progress:** ${state.currentStep} / ${instructions.length - 1} steps | Measured: ${measured.length} / 7 samples`,
        `- **Calibration Slope (m = ε·b):** ${config.KNOWN_SLOPE} Abs/µM`,
        `- **Unknown Drink Concentration:** ${unkConc}`,
        `- **Concept Check Mastery:** ${correct} / ${total}`,
        '',
        '| Solution | Dilution | Conc (µM) | %T | T | Absorbance |',
        '|---|---|---|---|---|---|',
        ...state.dataTableData.map((r) => {
            const c =
                r.id === 'unknown' && r.negLogT !== null && isFinite(r.negLogT)
                    ? (r.negLogT / config.KNOWN_SLOPE).toFixed(3)
                    : r.conc !== null
                    ? r.conc.toFixed(3)
                    : 'N/A';
            const a = r.negLogT !== null && isFinite(r.negLogT) ? parseFloat(r.negLogT).toFixed(4) : '--';
            return `| ${r.solution} | ${r.dilution} | ${c} | ${r.measuredPercentT ?? '--'} | ${r.T ?? '--'} | ${a} |`;
        }),
    ].join('\n');

    try {
        await navigator.clipboard.writeText(text);
        if (els.exportStatus) {
            els.exportStatus.textContent = 'Copied Markdown lab report to clipboard!';
            setTimeout(() => {
                if (els.exportStatus) els.exportStatus.textContent = '';
            }, 3000);
        }
    } catch {
        if (els.exportStatus) els.exportStatus.textContent = 'Clipboard unavailable — use Download CSV or Print PDF.';
    }
}

export function openLabReportModal() {
    if (!els.reportModal || !els.reportBody) return;
    const state = getState();
    const measured = state.dataTableData.filter((r) => r.measuredPercentT !== null).length;
    const unk = state.dataTableData.find((r) => r.id === 'unknown');
    const unkMeasured = unk && unk.negLogT !== null && isFinite(unk.negLogT);
    const unkConcVal = unkMeasured ? unk.negLogT / config.KNOWN_SLOPE : null;
    const unkConc = unkConcVal !== null
        ? `${unkConcVal.toFixed(3)} µM (${((unkConcVal * BLUE1_MOLAR_MASS) / 1000).toFixed(2)} mg/L)`
        : 'Pending measurement';
    const { correct, total } = getQuizScore();
    // Always render snapshot cleanly on paper-light coordinate grid in linear Absorbance mode for PDF export!
    const graphImg = getGraphSnapshotDataUrl(true, true);
    const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

    const rowsHtml = state.dataTableData
        .map((r) => {
            const conc =
                r.id === 'unknown' && r.negLogT !== null && isFinite(r.negLogT)
                    ? (r.negLogT / config.KNOWN_SLOPE).toFixed(3)
                    : r.conc !== null
                    ? r.conc.toFixed(3)
                    : 'N/A';
            const abs = r.negLogT !== null && isFinite(r.negLogT) ? parseFloat(r.negLogT).toFixed(4) : '--';
            return `<tr>
                <td>${r.solution}</td>
                <td>${r.dilution}</td>
                <td class="mono">${conc}</td>
                <td class="mono">${r.measuredPercentT ?? '--'}</td>
                <td class="mono">${r.T ?? '--'}</td>
                <td class="mono">${abs}</td>
            </tr>`;
        })
        .join('');

    els.reportBody.innerHTML = `
        <div class="report-meta-grid">
            <div class="report-kpi"><span>Experiment</span><strong>Beer-Lambert Spectrophotometry</strong></div>
            <div class="report-kpi"><span>Wavelength / Path</span><strong>λ = 630 nm · b = 1.00 cm</strong></div>
            <div class="report-kpi"><span>Progress / Date</span><strong>${state.currentStep}/83 Steps · ${dateStr}</strong></div>
            <div class="report-kpi"><span>Samples / Quiz</span><strong>${measured}/7 Measured · ${correct}/${total} Quiz</strong></div>
        </div>
        <div class="report-split">
            <div class="report-block">
                <h5>Recorded Absorbance &amp; Transmittance Data</h5>
                <table class="report-table">
                    <thead>
                        <tr><th>Solution</th><th>Dilution</th><th>Conc (µM)</th><th>%T</th><th>T</th><th>Abs (−log₁₀ T)</th></tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
            <div class="report-block">
                <h5>Beer-Lambert Calibration Curve Snapshot</h5>
                ${graphImg ? `<img class="report-graph-img" src="${graphImg}" alt="Beer-Lambert Calibration Plot">` : '<p>Calibration plot unavailable.</p>'}
                <div class="report-analysis">
                    <div><strong>Calibration Slope (m = ε·b):</strong> ${config.KNOWN_SLOPE} Abs/µM</div>
                    <div><strong>Unknown Drink Result:</strong> ${unkConc}${unkMeasured ? ` · Calc: ${parseFloat(unk.negLogT).toFixed(4)} ÷ ${config.KNOWN_SLOPE}` : ''}</div>
                </div>
            </div>
        </div>
    `;

    els.reportModal.hidden = false;
    requestAnimationFrame(() => els.reportModal.classList.add('report-modal--open'));
}

export function closeLabReportModal() {
    if (!els.reportModal) return;
    els.reportModal.classList.remove('report-modal--open');
    setTimeout(() => {
        if (els.reportModal && !els.reportModal.classList.contains('report-modal--open')) {
            els.reportModal.hidden = true;
        }
    }, 180);
}

// ---------------------------------------------------------------------------
// Public Initialization & Live State Sync
// ---------------------------------------------------------------------------

export function initEducationStudio(elements = {}) {
    els = elements;
    getScreenPointFn = elements.getScreenPoint || null;
    opticsCanvas = elements.opticsCanvas || document.getElementById('optics-canvas');
    pipCanvas = elements.pipCanvas || document.getElementById('pip-optics-canvas');
    spectrumCanvas = elements.spectrumCanvas || document.getElementById('spectrum-canvas');
    fxCanvas = elements.fxCanvas || document.getElementById('fx-canvas');

    if (opticsCanvas) opticsCtx = opticsCanvas.getContext('2d');
    if (pipCanvas) pipCtx = pipCanvas.getContext('2d');
    if (spectrumCanvas) spectrumCtx = spectrumCanvas.getContext('2d');
    if (fxCanvas) fxCtx = fxCanvas.getContext('2d');

    // Interactive Phase Ribbon Tooltips + Click-to-Focus Camera
    if (els.phasePills) {
        PHASES.forEach((p) => {
            const pill = els.phasePills[p.id];
            if (!pill) return;
            pill.title = `${p.tooltip} — Click to focus camera`;
            pill.addEventListener('click', () => {
                if (typeof els.onFocusPreset === 'function') {
                    els.onFocusPreset(p.preset);
                }
            });
        });
    }

    // Milestone CTA & dismiss close button handlers
    if (els.milestoneClose) {
        els.milestoneClose.addEventListener('click', dismissMilestoneToast);
    }
    if (els.milestoneCta) {
        els.milestoneCta.addEventListener('click', () => {
            if (els.milestoneToast) els.milestoneToast.classList.remove('milestone-toast--visible');
            if (!milestoneCtaAction) return;
            if (milestoneCtaAction.startsWith('preset:') && typeof els.onFocusPreset === 'function') {
                els.onFocusPreset(milestoneCtaAction.slice(7));
            } else if (milestoneCtaAction.startsWith('tab:') && typeof els.onActivateTab === 'function') {
                els.onActivateTab(milestoneCtaAction.slice(4), true);
            } else if (milestoneCtaAction === 'report') {
                openLabReportModal();
            }
        });
    }

    // Live vs What-If Sandbox optics mode switch
    const applyOpticsMode = (mode) => {
        opticsMode = mode;
        if (mode === 'live') stopSpectrumScan();
        if (els.modeLiveBtn) els.modeLiveBtn.classList.toggle('mode-switch__btn--active', mode === 'live');
        if (els.modeSandboxBtn) els.modeSandboxBtn.classList.toggle('mode-switch__btn--active', mode === 'sandbox');
        if (els.sandboxControls) els.sandboxControls.classList.toggle('sandbox-controls--locked', mode !== 'sandbox');
            if (els.concSlider) {
                els.concSlider.disabled = mode !== 'sandbox';
                if (mode === 'sandbox') {
                    els.concSlider.value = String(sandboxConc);
                    if (els.concVal) els.concVal.textContent = `${sandboxConc.toFixed(2)} µM`;
                }
            }
            if (els.wlSlider) {
                els.wlSlider.disabled = mode !== 'sandbox';
                if (mode === 'sandbox') {
                    els.wlSlider.value = String(sandboxWavelength);
                    if (els.wlVal) els.wlVal.textContent = `${sandboxWavelength} nm`;
                }
            }
        drawSpectrumChart();
        if (opticsTabActive) drawOpticsFrame(performance.now());
    };
    applyOpticsModeRef = applyOpticsMode;

    if (els.modeLiveBtn && els.modeSandboxBtn) {
        els.modeLiveBtn.addEventListener('click', () => applyOpticsMode('live'));
        els.modeSandboxBtn.addEventListener('click', () => applyOpticsMode('sandbox'));
        applyOpticsMode('live');
    }

    // Auto-Scan 400 -> 700 nm button
    if (els.opticsScanBtn) {
        els.opticsScanBtn.addEventListener('click', () => startSpectrumScan(applyOpticsMode));
    }

    // Sandbox Preset Quick-Load Chips
    document.querySelectorAll('.sandbox-preset').forEach((btn) => {
        btn.addEventListener('click', () => {
            stopSpectrumScan();
            const c = parseFloat(btn.dataset.conc);
            const wl = parseInt(btn.dataset.wl, 10);
            if (Number.isFinite(c)) {
                sandboxConc = c;
                if (els.concSlider) els.concSlider.value = String(c);
                if (els.concVal) els.concVal.textContent = `${c.toFixed(2)} µM`;
            }
            if (Number.isFinite(wl)) {
                sandboxWavelength = wl;
                if (els.wlSlider) els.wlSlider.value = String(wl);
                if (els.wlVal) els.wlVal.textContent = `${wl} nm`;
            }
            applyOpticsMode('sandbox');
        });
    });

    if (els.concSlider) {
        els.concSlider.addEventListener('input', () => {
            sandboxConc = parseFloat(els.concSlider.value);
            if (els.concVal) els.concVal.textContent = `${sandboxConc.toFixed(2)} µM`;
            drawSpectrumChart();
        });
    }
    if (els.wlSlider) {
        els.wlSlider.addEventListener('input', () => {
            stopSpectrumScan();
            sandboxWavelength = parseInt(els.wlSlider.value, 10);
            if (els.wlVal) els.wlVal.textContent = `${sandboxWavelength} nm`;
            drawSpectrumChart();
        });
    }

    // Interactive drag/click directly on the 400-700 nm absorption spectrum
    if (spectrumCanvas) {
        let draggingSpectrum = false;
        const pickWavelength = (e) => {
            stopSpectrumScan();
            const rect = spectrumCanvas.getBoundingClientRect();
            const padLeft = 42;
            const padRight = 18;
            const pw = Math.max(40, rect.width - padLeft - padRight);
            const frac = Math.max(0, Math.min(1, (e.clientX - rect.left - padLeft) / pw));
            sandboxWavelength = Math.round(400 + frac * 300);
            if (opticsMode !== 'sandbox') applyOpticsMode('sandbox');
            if (els.wlSlider) els.wlSlider.value = String(sandboxWavelength);
            if (els.wlVal) els.wlVal.textContent = `${sandboxWavelength} nm`;
            drawSpectrumChart();
        };
        spectrumCanvas.addEventListener('pointerdown', (e) => {
            draggingSpectrum = true;
            pickWavelength(e);
        });
        window.addEventListener('pointermove', (e) => {
            if (draggingSpectrum) pickWavelength(e);
        });
        window.addEventListener('pointerup', () => {
            draggingSpectrum = false;
        });
    }

    // Unknown Solver Mini-Challenge
    if (els.solverCheckBtn) els.solverCheckBtn.addEventListener('click', handleUnknownSolverCheck);
    if (els.solverInput) {
        els.solverInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleUnknownSolverCheck();
        });
    }

    // Export & Formal Lab Report Modal wiring
    if (els.exportCsvBtn) els.exportCsvBtn.addEventListener('click', triggerCsvExport);
    if (els.copyReportBtn) els.copyReportBtn.addEventListener('click', copyLabSummary);
    if (els.openReportBtn) els.openReportBtn.addEventListener('click', openLabReportModal);
    if (els.closeReportBtn) els.closeReportBtn.addEventListener('click', closeLabReportModal);
    if (els.reportPrintBtn) els.reportPrintBtn.addEventListener('click', () => window.print());
    if (els.reportCsvBtn) els.reportCsvBtn.addEventListener('click', triggerCsvExport);
    if (els.reportCopyBtn) els.reportCopyBtn.addEventListener('click', copyLabSummary);
    if (els.reportModal) {
        els.reportModal.addEventListener('click', (e) => {
            if (e.target === els.reportModal) closeLabReportModal();
        });
    }

    renderQuiz();
    updateQuizBadge();
    updateEducationPanel();
    syncPipVisibility();
}

export function inspectSampleInPhotonLab(row) {
    if (!row) return;
    stopSpectrumScan();
    let conc = 0;
    if (row.id === 'unknown' && row.negLogT !== null && isFinite(row.negLogT)) {
        conc = row.negLogT / config.KNOWN_SLOPE;
    } else if (row.conc !== null && Number.isFinite(row.conc)) {
        conc = row.conc;
    }
    sandboxConc = Math.max(0, Math.min(3.5, Number(conc.toFixed(3))));
    sandboxWavelength = 630;
    if (els.concSlider) els.concSlider.value = String(sandboxConc);
    if (els.concVal) els.concVal.textContent = `${sandboxConc.toFixed(2)} µM`;
    if (els.wlSlider) els.wlSlider.value = '630';
    if (els.wlVal) els.wlVal.textContent = '630 nm';
    if (typeof applyOpticsModeRef === 'function') {
        applyOpticsModeRef('sandbox');
    }
    if (typeof els.onActivateTab === 'function') {
        els.onActivateTab('optics', true);
    }
    playLabSound('themeSwitch');
}

export function resetEducationState() {
    stopSpectrumScan();
    highestMilestoneStep = 0;
    lastPhaseId = 'prep';
    pipUserOverride = null;
    precisionStreak = 0;
    lastMeasuredBadgeCount = 0;
    syncPrecisionPill();

    // Stop any running FX loop & clear canvas completely
    activeGuideArc = null;
    fxRipples.length = 0;
    fxFloats.length = 0;
    fxSparks.length = 0;
    if (fxRafId !== null) {
        cancelAnimationFrame(fxRafId);
        fxRafId = null;
    }
    clearFxCanvas();
    dismissMilestoneToast();

    // Return Quantum Photon Lab cleanly to Live Bench mode & 630 nm
    sandboxConc = 1.386;
    sandboxWavelength = 630;
    if (els.concSlider) els.concSlider.value = String(sandboxConc);
    if (els.concVal) els.concVal.textContent = `${sandboxConc.toFixed(2)} µM`;
    if (els.wlSlider) els.wlSlider.value = '630';
    if (els.wlVal) els.wlVal.textContent = '630 nm';
    if (typeof applyOpticsModeRef === 'function') {
        applyOpticsModeRef('live');
    }

    // Clear Unknown Solver inputs & feedback
    if (els.solverInput) els.solverInput.value = '';
    if (els.solverFeedback) {
        els.solverFeedback.textContent = '';
        els.solverFeedback.className = 'solver-feedback';
    }
    syncPipVisibility();
}

export function updateEducationPanel() {
    const state = getState();
    const step = state.currentStep;
    const totalSteps = instructions.length - 1;

    // Immediately drop any guidance arc that was created for a previous step!
    if (activeGuideArc && (activeGuideArc.forStep !== step || step >= totalSteps)) {
        activeGuideArc = null;
    }

    // Reset milestone tracker & spatial FX cleanly if lab was reset to 0
    if (step === 0) {
        highestMilestoneStep = 0;
        lastPhaseId = 'prep';
        pipUserOverride = null;
        activeGuideArc = null;
        fxRipples.length = 0;
        fxFloats.length = 0;
        fxSparks.length = 0;
        if (fxRafId !== null) {
            cancelAnimationFrame(fxRafId);
            fxRafId = null;
        }
        clearFxCanvas();
        dismissMilestoneToast();
    } else {
        for (const m of MILESTONES) {
            if (step >= m.step && highestMilestoneStep < m.step) {
                highestMilestoneStep = m.step;
                showMilestoneToast(m);
            }
        }
    }

    // 1. Update Progress Percentage Readout
    if (els.progressPctEl) {
        const pct = Math.min(100, Math.round((step / totalSteps) * 100));
        els.progressPctEl.textContent = `${pct}%`;
    }

    // 2. Update 5-Phase Journey Ribbon + gentle "Why?" nudge on phase transitions
    let activePhaseId = lastPhaseId;
    if (els.phasePills) {
        PHASES.forEach((p, idx) => {
            const pill = els.phasePills[p.id];
            if (!pill) return;
            const isDone = step > p.end || step >= 83;
            const isActive = !isDone && step >= p.start && step <= p.end;
            if (isActive) activePhaseId = p.id;
            pill.classList.toggle('phase-pill--done', isDone);
            pill.classList.toggle('phase-pill--active', isActive);
            const numEl = pill.querySelector('.phase-pill__num');
            if (numEl) {
                numEl.innerHTML = isDone
                    ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>'
                    : String(idx + 1);
            }
        });
    }
    if (activePhaseId !== lastPhaseId) {
        lastPhaseId = activePhaseId;
        if (els.whyToggleBtn) {
            els.whyToggleBtn.classList.remove('why-btn--nudge');
            void els.whyToggleBtn.offsetWidth;
            els.whyToggleBtn.classList.add('why-btn--nudge');
        }
    }

    // 3. Update Contextual Science Coach inside Collapsible "Why?" Drawer
    const insight = getStepScienceInsight(step);
    if (els.coachTag) els.coachTag.textContent = insight.tag;
    if (els.coachTip) els.coachTip.textContent = insight.tip;
    if (els.coachFormula) els.coachFormula.textContent = insight.formula;

    // Disable Show Me Demo button once experiment is complete
    if (els.demoStepBtn) {
        const curInstr = instructions[step];
        els.demoStepBtn.disabled = !curInstr || !curInstr.action || curInstr.action === 'info' || curInstr.action === 'setUnknownFlag';
    }

    // 4. Update Live Formula Workbench Cards
    const measuredStdCount = state.dataTableData.filter(
        (r) => r.id !== 'unknown' && r.measuredPercentT !== null
    ).length;
    const latestMeasured = [...state.dataTableData].reverse().find((r) => r.measuredPercentT !== null);
    const unkRow = state.dataTableData.find((r) => r.id === 'unknown');
    const unkDone = Boolean(unkRow && unkRow.negLogT !== null && isFinite(unkRow.negLogT));

    if (els.liveDilutionEq) {
        els.liveDilutionEq.textContent =
            step <= 19 ? insight.formula : '6 standards prepared: 2.310 → 0.000 µM';
    }
    if (els.liveAbsEq) {
        if (latestMeasured) {
            const absVal = parseFloat(latestMeasured.negLogT).toFixed(4);
            els.liveAbsEq.textContent = `${latestMeasured.solution}: −log₁₀(${latestMeasured.T}) = ${absVal} Abs`;
        } else {
            els.liveAbsEq.textContent = 'Awaiting first Spec 20D+ reading';
        }
    }
    if (els.liveBeerEq) {
        els.liveBeerEq.textContent =
            measuredStdCount > 0
                ? `Slope m = ${config.KNOWN_SLOPE} Abs/µM (${measuredStdCount}/6 standards)`
                : `Target slope m = ${config.KNOWN_SLOPE} Abs/µM at 630 nm`;
    }
    if (els.liveUnknownEq) {
        if (unkDone) {
            const c = unkRow.negLogT / config.KNOWN_SLOPE;
            const mgL = (c * BLUE1_MOLAR_MASS) / 1000;
            els.liveUnknownEq.textContent = `c = ${c.toFixed(3)} µM  (${mgL.toFixed(2)} mg/L Blue #1)`;
        } else {
            els.liveUnknownEq.textContent = 'Measure Unknown Drink (Steps 78–82)';
        }
    }

    if (els.solverCard) {
        els.solverCard.classList.toggle('solver-card--ready', unkDone);
    }

    // 5. Update Data Tab Measured Counter with celebratory bounce when a new measurement arrives!
    const totalMeasured = state.dataTableData.filter((r) => r.measuredPercentT !== null).length;
    if (els.dataTabBadge) {
        els.dataTabBadge.textContent = `${totalMeasured}/7`;
        if (totalMeasured > lastMeasuredBadgeCount) {
            els.dataTabBadge.classList.remove('studio-tab__badge--pulse');
            void els.dataTabBadge.offsetWidth;
            els.dataTabBadge.classList.add('studio-tab__badge--pulse');
        }
        lastMeasuredBadgeCount = totalMeasured;
    }

    // 6. Sync smart auto-appearing PiP X-Ray & live optical telemetry
    syncPipVisibility();

    if (opticsTabActive) {
        drawSpectrumChart();
    } else {
        const opt = getEffectiveOpticsData();
        const beamRgb = wavelengthToRgb(opt.wavelength);
        updateOpticsReadoutDom(opt, `rgb(${beamRgb.r}, ${beamRgb.g}, ${beamRgb.b})`);
    }
}
