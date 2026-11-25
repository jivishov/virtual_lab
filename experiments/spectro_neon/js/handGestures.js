// handGestures.js - On-Device MediaPipe HandLandmarker Spatial Gesture Controller (AETHER Spatial Interface)
// Biomechanical Mapping:
//   - Open / Half-Open Palm      -> Smooth Aim & Hover Inspection ONLY (zero accidental orbit!)
//   - Closed Palm / Fist (✊)     -> Grab, Drag & Tap Pipettes and General Lab Apparatus
//   - Index + Thumb Pinch (🤏)    -> Precision Grip Cuvette | Tap Buttons/HUD | Drag Empty Space to Orbit
//   - Two-Hand Pinch Spread      -> Smooth Damped Camera Zoom
//   - Peace Sign (✌️ hold 650ms)  -> Focus Camera & Holographic Step Guide Arc

const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8],       // Index
    [5, 9], [9, 10], [10, 11], [11, 12],  // Middle
    [9, 13], [13, 14], [14, 15], [15, 16],// Ring
    [13, 17], [17, 18], [18, 19], [19, 20],// Pinky
    [0, 17],
];

// One-Euro Adaptive Low-Pass Filter: rock-steady hover lock + crisp lag-free sweep
class OneEuroFilter {
    constructor(minCutoff = 0.95, beta = 0.032, dCutoff = 1.0) {
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;
        this.xPrev = null;
        this.dxPrev = 0;
        this.tPrev = null;
    }

    reset() {
        this.xPrev = null;
        this.dxPrev = 0;
        this.tPrev = null;
    }

    _alpha(cutoff, dt) {
        const tau = 1.0 / (2 * Math.PI * cutoff);
        return 1.0 / (1.0 + tau / Math.max(dt, 1e-4));
    }

    filter(x, tSec) {
        if (this.tPrev === null || this.xPrev === null) {
            this.xPrev = x;
            this.dxPrev = 0;
            this.tPrev = tSec;
            return x;
        }
        const dt = Math.max(1 / 180, Math.min(0.25, tSec - this.tPrev));
        const dx = (x - this.xPrev) / dt;
        const aD = this._alpha(this.dCutoff, dt);
        const edx = aD * dx + (1 - aD) * this.dxPrev;
        const cutoff = this.minCutoff + this.beta * Math.abs(edx);
        const aX = this._alpha(cutoff, dt);
        const xHat = aX * x + (1 - aX) * this.xPrev;
        this.xPrev = xHat;
        this.dxPrev = edx;
        this.tPrev = tSec;
        return xHat;
    }
}

let els = {};
let hooks = {};
let handLandmarker = null;
let loadingPromise = null;
let mediaStream = null;
let rafId = null;
let lastVideoTime = -1;

let activeMode = 'off'; // 'off' | 'loading' | 'webcam' | 'virtual' | 'error'
let mirrored = true;
let pipCollapsed = false;

// Calibrated filters for responsive, rock-steady spatial precision
const filterX = new OneEuroFilter(1.25, 0.055, 1.0);
const filterY = new OneEuroFilter(1.25, 0.055, 1.0);
const filterPinch = new OneEuroFilter(2.2, 0.015, 1.0);
const filterCurl = new OneEuroFilter(2.1, 0.015, 1.0);

// Thresholds tuned so a relaxed half-open palm NEVER accidentally grabs or orbits
const PINCH_ON = 0.34;
const PINCH_OFF = 0.48;
const FIST_ON = 0.87;     // Strict closed-palm curl ratio (half-open is ~1.05..1.30!)
const FIST_OFF = 1.05;    // Clean hysteresis release
const GRAB_DEBOUNCE_MS = 40;
const PINCH_DEBOUNCE_MS = 35;
const AIM_LOCK_MS = 55;   // Stabilizes cursor right as fingers close to grab/pinch
const CURSOR_DEADZONE_PX = 2.0;
const ORBIT_DEADZONE_PX = 16;
const PEACE_DWELL_MS = 650;
const HUD_CLICK_MAX_MOVE = 32;
const MIN_DETECT_INTERVAL_MS = 30; // ~33 Hz cap keeps WebGL 3D smooth even on busy laptops!
let lastDetectMs = 0;

const gState = {
    visible: false,
    normX: 0.5,
    normY: 0.5,
    clientX: 0,
    clientY: 0,
    stableClientX: 0,
    stableClientY: 0,
    pinchRatio: 1.0,
    fistCurl: 1.4,

    // Active exclusive gesture session: 'idle' | 'grab3d' | 'pinchCuvette' | 'pinchHud' | 'pinchSpecBtn' | 'pinchOrbit'
    session: 'idle',
    sessionStartX: 0,
    sessionStartY: 0,
    sessionStartMs: 0,
    sessionHudBtn: null,
    orbitEngaged: false,
    lastOrbitX: 0,
    lastOrbitY: 0,
    smoothOrbitDx: 0,
    smoothOrbitDy: 0,

    // Debounce timers for clean transitions
    fistCandidateStartMs: 0,
    pinchCandidateStartMs: 0,
    isFistActive: false,
    isPinchActive: false,

    twoHandZoomDist: null,
    peaceStartMs: 0,
    peaceTriggered: false,
    lostFrames: 0,
    gestureName: 'STANDBY',
    hoveredHudBtn: null,
};

// Virtual Mouse-Driven Hand Preview listeners (for no-webcam fallback / testing)
// Move mouse to aim · Hold C for Closed-Palm Grab (pipettes/objects) · Hold V for Pinch (cuvette/buttons/orbit)
let virtualPointerMoveFn = null;
let virtualKeyDownFn = null;
let virtualKeyUpFn = null;
let virtualPinchKeyHeld = false;
let virtualGrabKeyHeld = false;
let virtualMouseX = 0.5;
let virtualMouseY = 0.5;

function dist2D(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}

// Comfortable ergonomic inner reach zone (16%..84%) mapped cleanly to 100% viewport
function mapReach(rawVal, margin = 0.16) {
    return clamp01((rawVal - margin) / (1 - 2 * margin));
}

function fingerRatio(lm, tipIdx, pipIdx, wristIdx = 0) {
    const dTip = dist2D(lm[tipIdx], lm[wristIdx]);
    const dPip = Math.max(1e-4, dist2D(lm[pipIdx], lm[wristIdx]));
    return dTip / dPip;
}

function classifyHand(lm) {
    const palmScale = Math.max(0.045, dist2D(lm[0], lm[9]));
    const pinchRatio = dist2D(lm[4], lm[8]) / palmScale;

    // 4-finger fold ratios (open ~1.45-1.65, relaxed half-open ~1.05-1.28, firm closed fist < 0.86)
    const rIdx = fingerRatio(lm, 8, 6);
    const rMid = fingerRatio(lm, 12, 10);
    const rRng = fingerRatio(lm, 16, 14);
    const rPnk = fingerRatio(lm, 20, 18);

    const palmCenter = {
        x: lm[0].x * 0.34 + lm[5].x * 0.22 + lm[9].x * 0.24 + lm[13].x * 0.20,
        y: lm[0].y * 0.34 + lm[5].y * 0.22 + lm[9].y * 0.24 + lm[13].y * 0.20,
    };

    const tipsCloseToPalm =
        (dist2D(lm[8], palmCenter) / palmScale < 0.78 ? 1 : 0) +
        (dist2D(lm[12], palmCenter) / palmScale < 0.76 ? 1 : 0) +
        (dist2D(lm[16], palmCenter) / palmScale < 0.76 ? 1 : 0) +
        (dist2D(lm[20], palmCenter) / palmScale < 0.80 ? 1 : 0);

    const strictFoldedCount =
        (rIdx < 0.90 ? 1 : 0) +
        (rMid < 0.90 ? 1 : 0) +
        (rRng < 0.90 ? 1 : 0) +
        (rPnk < 0.92 ? 1 : 0);

    const avgFoldRatio = (rIdx + rMid + rRng + rPnk) * 0.25;
    // Firm closed palm requires genuinely curled fingers (relaxed half-open palm stays safely open!)
    const rawFist = (avgFoldRatio < FIST_ON && strictFoldedCount >= 3) || tipsCloseToPalm >= 4;

    // Peace sign: clear V with index + middle extended, ring + pinky firmly curled, thumb separated
    const isPeace = rIdx > 1.18 && rMid > 1.18 && rRng < 0.92 && rPnk < 0.94 && pinchRatio > 0.56;

    // Pinch is ONLY valid when the hand is NOT balled into a full fist (middle/ring at least partially open)
    const middleRingOpen = (rMid + rRng) * 0.5 > 0.96;
    const effectivePinchRatio = rawFist || !middleRingOpen ? Math.max(pinchRatio, 0.75) : pinchRatio;

    // Rigid metacarpal knuckle anchor (stable palm bones barely move when closing fist OR pinching!)
    const anchorX = lm[9].x * 0.44 + lm[5].x * 0.36 + lm[13].x * 0.20;
    const anchorY = lm[9].y * 0.44 + lm[5].y * 0.36 + lm[13].y * 0.20 - palmScale * 0.20;

    const mappedX = mapReach(mirrored ? 1.0 - anchorX : anchorX, 0.16);
    const mappedY = mapReach(anchorY, 0.16);

    return {
        mappedX,
        mappedY,
        pinchRatio: effectivePinchRatio,
        rawPinchRatio: pinchRatio,
        fistCurl: avgFoldRatio,
        rawFist,
        isPeace,
        palmScale,
    };
}

function findClickableHudButton(clientX, clientY) {
    if (!document.elementsFromPoint) return null;
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const node of stack) {
        if (!node || node.id === 'gesture-cursor' || node.closest?.('#gesture-cursor')) continue;
        const btn = node.closest?.('button:not(:disabled)');
        if (btn && btn.offsetParent !== null) {
            return btn;
        }
        if (node.tagName === 'CANVAS' && node.closest?.('#viewport-3d')) {
            return null;
        }
    }
    return null;
}

function clearHudHover() {
    if (gState.hoveredHudBtn) {
        gState.hoveredHudBtn.classList.remove('gesture-hud-hover');
        gState.hoveredHudBtn = null;
    }
}

function updateCursorVisuals({
    label = '',
    role = 'idle',
    pinchProgress = 0,
    grabProgress = 0,
    peaceProgress = 0,
    visible = true,
}) {
    const cursor = els.cursorEl;
    if (!cursor) return;

    cursor.classList.toggle('gesture-cursor--visible', visible);
    if (!visible) return;

    const stageRect = els.stageEl ? els.stageEl.getBoundingClientRect() : { left: 0, top: 0 };
    const lx = gState.stableClientX - stageRect.left;
    const ly = gState.stableClientY - stageRect.top;
    cursor.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;

    const isGrabbing = gState.session === 'grab3d';
    const isPinching =
        gState.session === 'pinchCuvette' ||
        gState.session === 'pinchHud' ||
        gState.session === 'pinchSpecBtn';
    const isOrbiting = gState.session === 'pinchOrbit' && gState.orbitEngaged;

    cursor.classList.toggle('gesture-cursor--grabbing', isGrabbing);
    cursor.classList.toggle('gesture-cursor--pinching', isPinching);
    cursor.classList.toggle('gesture-cursor--orbit', isOrbiting);
    cursor.classList.toggle('gesture-cursor--drop', role === 'drop');
    cursor.classList.toggle('gesture-cursor--draggable', role === 'draggable');
    cursor.classList.toggle('gesture-cursor--cuvette', role === 'cuvette');
    cursor.classList.toggle('gesture-cursor--button', role === 'button' || role === 'hud');
    cursor.classList.toggle('gesture-cursor--highlight', role === 'highlight');

    if (els.cursorTagEl) {
        els.cursorTagEl.textContent = label || '';
        els.cursorTagEl.classList.toggle('gesture-cursor__tag--visible', Boolean(label));
    }

    if (els.cursorDwellRing) {
        const circ = 113.1; // 2 * pi * 18
        const prog = peaceProgress > 0.02 ? peaceProgress : 0;
        els.cursorDwellRing.style.strokeDashoffset = (circ * (1 - clamp01(prog))).toFixed(2);
        els.cursorDwellRing.style.opacity = prog > 0.02 ? '1' : '0';
    }

    if (els.cursorPinchArc) {
        const engagement = Math.max(pinchProgress, grabProgress);
        const scale = Math.max(0.56, Math.min(1.16, 1.14 - engagement * 0.54));
        els.cursorPinchArc.style.transform = `scale(${scale.toFixed(3)})`;
    }
}

function triggerClickRipple() {
    if (!els.cursorEl) return;
    els.cursorEl.classList.remove('gesture-cursor--pulse');
    void els.cursorEl.offsetWidth;
    els.cursorEl.classList.add('gesture-cursor--pulse');
}

function setStatusUI(mode, badgeText, detailText = '') {
    activeMode = mode;
    if (els.pipCard) {
        els.pipCard.classList.toggle('gesture-pip--visible', mode !== 'off');
        els.pipCard.classList.toggle('gesture-pip--collapsed', pipCollapsed);
        els.pipCard.classList.toggle('gesture-pip--error', mode === 'error');
        els.pipCard.classList.toggle('gesture-pip--virtual', mode === 'virtual');
    }
    if (els.pipStatusText) {
        els.pipStatusText.textContent = badgeText;
    }
    if (els.pipErrorBox) {
        els.pipErrorBox.hidden = mode !== 'error';
    }
    if (els.pipErrorMsg && detailText) {
        els.pipErrorMsg.textContent = detailText;
    }
    if (els.pipDot) {
        els.pipDot.classList.toggle('gesture-pip__dot--live', mode === 'webcam' || mode === 'virtual');
        els.pipDot.classList.toggle('gesture-pip__dot--pinch', gState.session !== 'idle');
    }
    if (typeof hooks.onModeChange === 'function') {
        hooks.onModeChange(mode, badgeText);
    }
}

function drawSkeletonOverlay(handsLandmarks) {
    const canvas = els.pipCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle Aether holographic reach grid & corner calibration ticks
    ctx.save();
    const rx = w * 0.16;
    const ry = h * 0.16;
    const rw = w * 0.68;
    const rh = h * 0.68;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.24)';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);

    // Holographic corner brackets
    const b = 8;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(rx, ry + b); ctx.lineTo(rx, ry); ctx.lineTo(rx + b, ry);
    ctx.moveTo(rx + rw - b, ry); ctx.lineTo(rx + rw, ry); ctx.lineTo(rx + rw, ry + b);
    ctx.moveTo(rx, ry + rh - b); ctx.lineTo(rx, ry + rh); ctx.lineTo(rx + b, ry + rh);
    ctx.moveTo(rx + rw - b, ry + rh); ctx.lineTo(rx + rw, ry + rh); ctx.lineTo(rx + rw, ry + rh - b);
    ctx.stroke();
    ctx.restore();

    if (!handsLandmarks || handsLandmarks.length === 0) return;

    const isGrab = gState.session === 'grab3d';
    const isPinch = gState.session === 'pinchCuvette' || gState.session === 'pinchHud' || gState.session === 'pinchSpecBtn';
    const isOrbit = gState.session === 'pinchOrbit' && gState.orbitEngaged;

    handsLandmarks.forEach((lm, handIdx) => {
        const px = (pt) => (mirrored ? 1.0 - pt.x : pt.x) * w;
        const py = (pt) => pt.y * h;

        const wireColor =
            handIdx > 0
                ? 'rgba(168, 85, 247, 0.80)'
                : isGrab
                ? 'rgba(251, 191, 36, 0.94)'
                : isPinch
                ? 'rgba(74, 222, 128, 0.95)'
                : isOrbit
                ? 'rgba(192, 132, 252, 0.92)'
                : 'rgba(56, 189, 248, 0.88)';

        // Glowing holographic wireframe bones
        ctx.strokeStyle = wireColor;
        ctx.lineWidth = handIdx === 0 ? 1.8 : 1.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (const [a, bIdx] of HAND_CONNECTIONS) {
            ctx.moveTo(px(lm[a]), py(lm[a]));
            ctx.lineTo(px(lm[bIdx]), py(lm[bIdx]));
        }
        ctx.stroke();

        // Highlight palm tracking core (#9 knuckle) + thumb/index pinch vector
        if (handIdx === 0) {
            const kx = px(lm[9]);
            const ky = py(lm[9]);
            ctx.strokeStyle = isGrab ? '#fbbf24' : 'rgba(56, 189, 248, 0.72)';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(kx, ky, isGrab ? 9.5 : 7, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = isPinch || isOrbit ? '#4ade80' : 'rgba(251, 191, 36, 0.75)';
            ctx.lineWidth = isPinch || isOrbit ? 2.5 : 1.4;
            ctx.beginPath();
            ctx.moveTo(px(lm[4]), py(lm[4]));
            ctx.lineTo(px(lm[8]), py(lm[8]));
            ctx.stroke();
        }

        // Joint nodes
        for (let i = 0; i < lm.length; i++) {
            const isKey = i === 4 || i === 8 || i === 9;
            ctx.fillStyle = isKey
                ? isGrab
                    ? '#fbbf24'
                    : isPinch
                    ? '#4ade80'
                    : '#e0f2fe'
                : 'rgba(186, 230, 253, 0.86)';
            ctx.beginPath();
            ctx.arc(px(lm[i]), py(lm[i]), isKey ? 2.9 : 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

function drawVirtualHandPreview(nx, ny, mode) {
    const canvas = els.pipCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Aether holographic radar background
    ctx.fillStyle = 'rgba(4, 14, 28, 0.94)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.lineWidth = 1;
    for (let gx = 0.25; gx < 1; gx += 0.25) {
        ctx.beginPath(); ctx.moveTo(w * gx, 0); ctx.lineTo(w * gx, h); ctx.stroke();
    }
    for (let gy = 0.25; gy < 1; gy += 0.25) {
        ctx.beginPath(); ctx.moveTo(0, h * gy); ctx.lineTo(w, h * gy); ctx.stroke();
    }

    const cx = (0.16 + nx * 0.68) * w;
    const cy = (0.16 + ny * 0.68) * h;
    const isGrab = mode === 'grab3d';
    const isPinch = mode === 'pinchCuvette' || mode === 'pinchHud' || mode === 'pinchSpecBtn' || mode === 'pinchOrbit';
    const col = isGrab ? '#fbbf24' : isPinch ? '#4ade80' : '#38bdf8';

    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, isGrab ? 9 : isPinch ? 6 : 13, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
    ctx.fill();
}

function releaseActiveSession(endX, endY) {
    const prev = gState.session;
    if (prev === 'idle') return;

    if (prev === 'grab3d' || prev === 'pinchCuvette' || prev === 'pinchSpecBtn') {
        hooks.handleVirtualPointerUp?.(endX, endY);
    } else if (prev === 'pinchHud' && gState.sessionHudBtn) {
        const travel = Math.hypot(endX - gState.sessionStartX, endY - gState.sessionStartY);
        if (travel <= HUD_CLICK_MAX_MOVE) {
            gState.sessionHudBtn.click();
            triggerClickRipple();
        }
    }

    gState.session = 'idle';
    gState.sessionHudBtn = null;
    gState.orbitEngaged = false;
    gState.smoothOrbitDx = 0;
    gState.smoothOrbitDy = 0;
}

// Core unified gesture frame processor (real MediaPipe frames + synthetic/virtual hand)
function processHandFrame(
    {
        normX,
        normY,
        pinchRatio = 0.9,
        fistCurl = 1.4,
        rawFist = false,
        isPeace = false,
        secondHand = null,
    },
    nowMs
) {
    const tSec = nowMs * 0.001;
    const stageRect = els.stageEl
        ? els.stageEl.getBoundingClientRect()
        : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

    const sx = filterX.filter(clamp01(normX), tSec);
    const sy = filterY.filter(clamp01(normY), tSec);
    const sPinch = filterPinch.filter(pinchRatio, tSec);
    const sCurl = filterCurl.filter(fistCurl, tSec);

    const rawClientX = stageRect.left + sx * stageRect.width;
    const rawClientY = stageRect.top + sy * stageRect.height;

    // Micro-deadzone when stationary eliminates jitter over small buttons/cuvette
    if (!gState.visible || Math.hypot(rawClientX - gState.stableClientX, rawClientY - gState.stableClientY) >= CURSOR_DEADZONE_PX) {
        gState.stableClientX = rawClientX;
        gState.stableClientY = rawClientY;
    }

    gState.visible = true;
    gState.lostFrames = 0;
    gState.normX = sx;
    gState.normY = sy;
    gState.clientX = rawClientX;
    gState.clientY = rawClientY;
    gState.pinchRatio = sPinch;
    gState.fistCurl = sCurl;

    // 1. Optional Two-Hand Simultaneous Pinch Zoom (damped + deadzoned)
    if (secondHand && sPinch < PINCH_ON && secondHand.pinchRatio < PINCH_ON) {
        if (gState.session !== 'idle') {
            hooks.cancelVirtualPointer?.();
            gState.session = 'idle';
        }
        const dHands = Math.hypot(sx - secondHand.mappedX, sy - secondHand.mappedY);
        if (gState.twoHandZoomDist !== null && dHands > 0.05) {
            const delta = Math.abs(dHands - gState.twoHandZoomDist);
            if (delta > 0.009) {
                const rawRatio = gState.twoHandZoomDist / dHands;
                const clampedRatio = Math.max(0.93, Math.min(1.07, rawRatio));
                hooks.zoomCameraByScale?.(clampedRatio);
            }
        }
        gState.twoHandZoomDist = dHands;
        gState.gestureName = 'ZOOM · 2-HAND';
        if (els.pipStatusText) els.pipStatusText.textContent = 'Two-Hand Zoom';
        updateCursorVisuals({ label: '◎ TWO-HAND ZOOM', role: 'orbit', visible: true });
        return;
    } else {
        gState.twoHandZoomDist = null;
    }

    // 2. Peace Sign Dwell -> Focus Step & Holographic Guide Arc (only when idle)
    if (isPeace && gState.session === 'idle') {
        if (!gState.peaceStartMs) {
            gState.peaceStartMs = nowMs;
            gState.peaceTriggered = false;
        }
        const elapsed = nowMs - gState.peaceStartMs;
        const progress = clamp01(elapsed / PEACE_DWELL_MS);
        if (progress >= 1.0 && !gState.peaceTriggered) {
            gState.peaceTriggered = true;
            triggerClickRipple();
            hooks.onPeaceFocus?.();
        }
        gState.gestureName = gState.peaceTriggered ? 'FOCUS LOCKED' : 'PEACE · FOCUS';
        if (els.pipStatusText) els.pipStatusText.textContent = gState.peaceTriggered ? 'Step Focused' : 'Hold ✌️ to Focus';
        updateCursorVisuals({
            label: gState.peaceTriggered ? '✓ STEP FOCUSED' : '✌️ HOLD TO FOCUS STEP',
            role: 'highlight',
            peaceProgress: progress,
            visible: true,
        });
        return;
    } else {
        gState.peaceStartMs = 0;
        gState.peaceTriggered = false;
    }

    // 3. Debounced Schmitt-Trigger Classifiers for Closed Palm (✊) and Index-Thumb Pinch (🤏)
    const fistDesired = gState.isFistActive ? (sCurl < FIST_OFF || rawFist) : (sCurl < FIST_ON && rawFist);
    if (fistDesired && !gState.isFistActive) {
        if (!gState.fistCandidateStartMs) gState.fistCandidateStartMs = nowMs;
        if (nowMs - gState.fistCandidateStartMs >= GRAB_DEBOUNCE_MS) {
            gState.isFistActive = true;
            gState.fistCandidateStartMs = 0;
        }
    } else if (!fistDesired) {
        gState.isFistActive = false;
        gState.fistCandidateStartMs = 0;
    }

    const pinchDesired = !gState.isFistActive && (gState.isPinchActive ? sPinch < PINCH_OFF : sPinch < PINCH_ON);
    if (pinchDesired && !gState.isPinchActive) {
        if (!gState.pinchCandidateStartMs) gState.pinchCandidateStartMs = nowMs;
        if (nowMs - gState.pinchCandidateStartMs >= PINCH_DEBOUNCE_MS) {
            gState.isPinchActive = true;
            gState.pinchCandidateStartMs = 0;
        }
    } else if (!pinchDesired) {
        gState.isPinchActive = false;
        gState.pinchCandidateStartMs = 0;
    }

    // 4. Check HUD hover only when not dragging a 3D lab object
    const active3dDrag = gState.session === 'grab3d' || gState.session === 'pinchCuvette';
    const hudBtn = !active3dDrag && gState.session !== 'pinchOrbit'
        ? findClickableHudButton(gState.stableClientX, gState.stableClientY)
        : null;

    if (hudBtn !== gState.hoveredHudBtn) {
        clearHudHover();
        if (hudBtn) {
            hudBtn.classList.add('gesture-hud-hover');
            gState.hoveredHudBtn = hudBtn;
        }
    }

    // 5. Exclusive Biomechanical Gesture Session Machine
    //    - Closed Palm (✊): Handles Pipettes & General Objects (NOT cuvette, NOT orbit!)
    //    - Pinch (🤏): Handles Cuvette, Spec/HUD Buttons, or Empty-Space Orbit!
    //    - Open / Half-Open Palm: Pure Aim & Hover ONLY!
    let customCue = '';

    if (gState.session === 'grab3d') {
        if (!gState.isFistActive) {
            releaseActiveSession(gState.stableClientX, gState.stableClientY);
        } else {
            const elapsed = nowMs - gState.sessionStartMs;
            const moveX = elapsed < AIM_LOCK_MS ? gState.sessionStartX : gState.stableClientX;
            const moveY = elapsed < AIM_LOCK_MS ? gState.sessionStartY : gState.stableClientY;
            hooks.handleVirtualPointerMove?.(moveX, moveY);
        }
    } else if (gState.session === 'pinchCuvette' || gState.session === 'pinchSpecBtn') {
        if (!gState.isPinchActive) {
            releaseActiveSession(gState.stableClientX, gState.stableClientY);
        } else if (gState.session === 'pinchCuvette') {
            const elapsed = nowMs - gState.sessionStartMs;
            const moveX = elapsed < AIM_LOCK_MS ? gState.sessionStartX : gState.stableClientX;
            const moveY = elapsed < AIM_LOCK_MS ? gState.sessionStartY : gState.stableClientY;
            hooks.handleVirtualPointerMove?.(moveX, moveY);
        }
    } else if (gState.session === 'pinchHud') {
        if (!gState.isPinchActive) {
            releaseActiveSession(gState.stableClientX, gState.stableClientY);
        }
    } else if (gState.session === 'pinchOrbit') {
        if (!gState.isPinchActive) {
            releaseActiveSession(gState.stableClientX, gState.stableClientY);
        } else {
            const travelPx = Math.hypot(
                gState.stableClientX - gState.sessionStartX,
                gState.stableClientY - gState.sessionStartY
            );
            if (!gState.orbitEngaged && travelPx >= ORBIT_DEADZONE_PX) {
                gState.orbitEngaged = true;
                gState.lastOrbitX = sx;
                gState.lastOrbitY = sy;
            }
            if (gState.orbitEngaged) {
                const rawDx = sx - gState.lastOrbitX;
                const rawDy = sy - gState.lastOrbitY;
                gState.smoothOrbitDx = gState.smoothOrbitDx * 0.58 + rawDx * 0.42;
                gState.smoothOrbitDy = gState.smoothOrbitDy * 0.58 + rawDy * 0.42;
                if (Math.abs(gState.smoothOrbitDx) > 0.0005 || Math.abs(gState.smoothOrbitDy) > 0.0005) {
                    hooks.orbitCameraByDelta?.(gState.smoothOrbitDx, gState.smoothOrbitDy);
                }
                gState.lastOrbitX = sx;
                gState.lastOrbitY = sy;
            }
        }
    } else {
        // IDLE -> Check deliberate onset of Closed Palm (✊) OR Pinch (🤏)
        const info = hudBtn ? null : hooks.inspectAtClientPoint?.(gState.stableClientX, gState.stableClientY);

        if (gState.isFistActive) {
            // Closed Palm handles pipettes & general objects — NEVER orbits empty space!
            if (info?.isCuvette && info.selectedObjectId !== 'pipette_stock' && info.selectedObjectId !== 'pipette_water' && info.selectedObjectId !== 'pipette_unknown') {
                customCue = '🤏 PINCH TO GRIP CUVETTE';
            } else if (!hudBtn && info?.hitId && !info.isButton) {
                const downRes = hooks.handleVirtualPointerDown?.(gState.stableClientX, gState.stableClientY);
                if (downRes?.captured) {
                    gState.session = 'grab3d';
                    gState.sessionStartX = gState.stableClientX;
                    gState.sessionStartY = gState.stableClientY;
                    gState.sessionStartMs = nowMs;
                    triggerClickRipple();
                }
            }
        } else if (gState.isPinchActive) {
            // Pinch handles: (1) HUD buttons, (2) Cuvette precision grip, (3) Spec 20D+ buttons,
            // (4) Drop target if Cuvette is selected, (5) Empty-space / background deliberate camera orbit!
            gState.sessionStartX = gState.stableClientX;
            gState.sessionStartY = gState.stableClientY;
            gState.sessionStartMs = nowMs;
            gState.lastOrbitX = sx;
            gState.lastOrbitY = sy;
            gState.orbitEngaged = false;
            gState.smoothOrbitDx = 0;
            gState.smoothOrbitDy = 0;

            if (hudBtn) {
                gState.session = 'pinchHud';
                gState.sessionHudBtn = hudBtn;
                triggerClickRipple();
            } else if (info?.isCuvette || (info?.selectedObjectId === 'cuvette' && info?.isValidDrop)) {
                const downRes = hooks.handleVirtualPointerDown?.(gState.stableClientX, gState.stableClientY);
                if (downRes?.captured) {
                    gState.session = 'pinchCuvette';
                    triggerClickRipple();
                }
            } else if (info?.isButton) {
                const downRes = hooks.handleVirtualPointerDown?.(gState.stableClientX, gState.stableClientY);
                if (downRes?.captured) {
                    gState.session = 'pinchSpecBtn';
                    triggerClickRipple();
                }
            } else {
                // Pinch anywhere else -> Deliberate damped orbit once moved past deadzone!
                gState.session = 'pinchOrbit';
            }
        } else {
            // Pure hover aim (open or half-open palm)
            if (!hudBtn) {
                hooks.handleVirtualPointerMove?.(gState.stableClientX, gState.stableClientY);
            }
        }
    }

    // 6. Update AETHER Spatial Reticle Tag, Role & PiP Telemetry
    let cursorLabel = customCue;
    let cursorRole = 'idle';

    if (!cursorLabel) {
        if (gState.session === 'pinchOrbit') {
            cursorLabel = gState.orbitEngaged ? '◎ ORBITING VIEW' : '🤏 DRAG TO ORBIT';
            cursorRole = 'orbit';
        } else if (hudBtn) {
            const btnTxt = (hudBtn.getAttribute('aria-label') || hudBtn.textContent || 'Control')
                .trim()
                .replace(/\s+/g, ' ')
                .slice(0, 24);
            cursorLabel = `🤏 ${btnTxt.toUpperCase()}`;
            cursorRole = 'hud';
        } else {
            const info = hooks.inspectAtClientPoint?.(gState.stableClientX, gState.stableClientY);
            if (info?.hitId) {
                const upper = (info.label || info.hitId).toUpperCase();
                if (gState.session === 'grab3d') {
                    cursorLabel = info.isValidDrop ? `✓ RELEASE → ${upper}` : `✊ HOLDING · ${upper}`;
                    cursorRole = info.isValidDrop ? 'drop' : 'draggable';
                } else if (gState.session === 'pinchCuvette') {
                    cursorLabel = info.isValidDrop ? `✓ RELEASE → ${upper}` : `🤏 CUVETTE · ${upper}`;
                    cursorRole = info.isValidDrop ? 'drop' : 'cuvette';
                } else if (info.isCuvette) {
                    cursorLabel = `🤏 PINCH · ${upper}`;
                    cursorRole = info.isHighlighted ? 'highlight' : 'cuvette';
                } else if (info.isButton) {
                    cursorLabel = `🤏 TAP · ${upper}`;
                    cursorRole = info.isHighlighted ? 'highlight' : 'button';
                } else if (info.isValidDrop) {
                    const verb = info.selectedObjectId === 'cuvette' ? '🤏 TAP' : '✊ DROP';
                    cursorLabel = `${verb} · ${upper}`;
                    cursorRole = 'drop';
                } else if (info.isDraggable) {
                    cursorLabel = `✊ GRAB · ${upper}`;
                    cursorRole = info.isHighlighted ? 'highlight' : 'draggable';
                } else {
                    cursorLabel = upper;
                    cursorRole = info.isHighlighted ? 'highlight' : 'target';
                }
            }
        }
    }

    const pinchProgress = clamp01((0.72 - sPinch) / (0.72 - PINCH_ON));
    const grabProgress = clamp01((1.22 - sCurl) / (1.22 - FIST_ON));

    gState.gestureName =
        gState.session === 'grab3d'
            ? 'FIST · GRAB'
            : gState.session === 'pinchCuvette'
            ? 'PINCH · CUVETTE'
            : gState.session === 'pinchOrbit'
            ? (gState.orbitEngaged ? 'PINCH · ORBIT' : 'PINCH · READY')
            : gState.session === 'pinchHud' || gState.session === 'pinchSpecBtn'
            ? 'PINCH · CLICK'
            : 'OPEN · AIM';

    if (els.pipStatusText) {
        els.pipStatusText.textContent =
            gState.session === 'grab3d'
                ? '✊ Closed Palm Grab'
                : gState.session === 'pinchCuvette'
                ? '🤏 Cuvette Pinch Grip'
                : gState.session === 'pinchOrbit'
                ? (gState.orbitEngaged ? '◎ Pinch Orbit' : '🤏 Pinch Ready')
                : 'Aether Hand Lock';
    }
    if (els.pipDot) {
        els.pipDot.classList.toggle('gesture-pip__dot--pinch', gState.session !== 'idle');
    }

    updateCursorVisuals({
        label: cursorLabel,
        role: cursorRole,
        pinchProgress,
        grabProgress,
        visible: true,
    });
}

function handleHandLost() {
    gState.lostFrames++;
    if (gState.lostFrames === 8) {
        if (gState.session === 'grab3d' || gState.session === 'pinchCuvette' || gState.session === 'pinchSpecBtn') {
            hooks.cancelVirtualPointer?.();
        }
        clearHudHover();
        gState.session = 'idle';
        gState.sessionHudBtn = null;
        gState.isFistActive = false;
        gState.isPinchActive = false;
        gState.fistCandidateStartMs = 0;
        gState.pinchCandidateStartMs = 0;
        gState.orbitEngaged = false;
        gState.twoHandZoomDist = null;
        gState.peaceStartMs = 0;
        gState.visible = false;
        filterX.reset();
        filterY.reset();
        filterPinch.reset();
        filterCurl.reset();
        updateCursorVisuals({ visible: false });
        if (els.pipStatusText && activeMode === 'webcam') {
            els.pipStatusText.textContent = 'Show hand to camera';
        }
        if (els.pipDot) {
            els.pipDot.classList.remove('gesture-pip__dot--pinch');
        }
    }
}

async function ensureHandLandmarker() {
    if (handLandmarker) return handLandmarker;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
        const visionMod = await import('../vendor/mediapipe/vision_bundle.mjs');
        const { FilesetResolver, HandLandmarker } = visionMod;
        const fileset = await FilesetResolver.forVisionTasks('./vendor/mediapipe/wasm');

        const baseOpts = {
            baseOptions: {
                modelAssetPath: './vendor/mediapipe/hand_landmarker.task',
                delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.58,
            minHandPresenceConfidence: 0.55,
            minTrackingConfidence: 0.55,
        };

        try {
            handLandmarker = await HandLandmarker.createFromOptions(fileset, baseOpts);
        } catch (gpuErr) {
            console.warn('[HandGestures] GPU delegate unavailable, falling back to CPU:', gpuErr);
            baseOpts.baseOptions.delegate = 'CPU';
            handLandmarker = await HandLandmarker.createFromOptions(fileset, baseOpts);
        }
        return handLandmarker;
    })();

    try {
        return await loadingPromise;
    } catch (err) {
        loadingPromise = null;
        throw err;
    }
}

function webcamLoop() {
    if (activeMode !== 'webcam') return;
    rafId = requestAnimationFrame(webcamLoop);

    const video = els.pipVideo;
    if (!video || !handLandmarker || video.readyState < 2) return;

    const nowMs = performance.now();
    if (video.currentTime === lastVideoTime) return;
    if (nowMs - lastDetectMs < MIN_DETECT_INTERVAL_MS) return;
    lastDetectMs = nowMs;
    lastVideoTime = video.currentTime;

    let result;
    try {
        result = handLandmarker.detectForVideo(video, nowMs);
    } catch {
        return;
    }

    const hands = result?.landmarks || [];
    if (hands.length === 0) {
        drawSkeletonOverlay([]);
        handleHandLost();
        return;
    }

    const primary = classifyHand(hands[0]);
    const secondary = hands.length > 1 ? classifyHand(hands[1]) : null;

    processHandFrame(
        {
            normX: primary.mappedX,
            normY: primary.mappedY,
            pinchRatio: primary.pinchRatio,
            fistCurl: primary.fistCurl,
            rawFist: primary.rawFist,
            isPeace: primary.isPeace,
            secondHand: secondary,
        },
        nowMs
    );
    drawSkeletonOverlay(hands);
}

function detachVirtualListeners() {
    if (virtualPointerMoveFn) {
        window.removeEventListener('mousemove', virtualPointerMoveFn);
        virtualPointerMoveFn = null;
    }
    if (virtualKeyDownFn) {
        window.removeEventListener('keydown', virtualKeyDownFn);
        virtualKeyDownFn = null;
    }
    if (virtualKeyUpFn) {
        window.removeEventListener('keyup', virtualKeyUpFn);
        virtualKeyUpFn = null;
    }
    virtualPinchKeyHeld = false;
    virtualGrabKeyHeld = false;
}

export function startVirtualHandMode() {
    stopHandGestures(false);
    setStatusUI('virtual', 'Virtual Hand · C Grab / V Pinch');

    const emitVirtual = () => {
        const nowMs = performance.now();
        processHandFrame(
            {
                normX: virtualMouseX,
                normY: virtualMouseY,
                pinchRatio: virtualPinchKeyHeld ? 0.20 : 0.90,
                fistCurl: virtualGrabKeyHeld ? 0.72 : 1.45,
                rawFist: virtualGrabKeyHeld,
            },
            nowMs
        );
        drawVirtualHandPreview(gState.normX, gState.normY, gState.session);
    };

    virtualPointerMoveFn = (e) => {
        if (activeMode !== 'virtual') return;
        const rect = els.stageEl
            ? els.stageEl.getBoundingClientRect()
            : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        virtualMouseX = clamp01((e.clientX - rect.left) / Math.max(1, rect.width));
        virtualMouseY = clamp01((e.clientY - rect.top) / Math.max(1, rect.height));
        emitVirtual();
    };

    virtualKeyDownFn = (e) => {
        if (activeMode !== 'virtual' || e.repeat) return;
        const k = e.key.toLowerCase();
        if (k === 'c') {
            virtualGrabKeyHeld = true;
            emitVirtual();
        } else if (k === 'v') {
            virtualPinchKeyHeld = true;
            emitVirtual();
        }
    };

    virtualKeyUpFn = (e) => {
        if (activeMode !== 'virtual') return;
        const k = e.key.toLowerCase();
        if (k === 'c') {
            virtualGrabKeyHeld = false;
            emitVirtual();
        } else if (k === 'v') {
            virtualPinchKeyHeld = false;
            emitVirtual();
        }
    };

    window.addEventListener('mousemove', virtualPointerMoveFn);
    window.addEventListener('keydown', virtualKeyDownFn);
    window.addEventListener('keyup', virtualKeyUpFn);

    emitVirtual();
    hooks.onToast?.('Aether Virtual Hand active — Hold C (Closed Palm) for pipettes, Hold V (Pinch) for cuvette / buttons / orbit.', 'info');
}

export async function startHandGestures() {
    if (activeMode === 'webcam' || activeMode === 'loading') return true;
    stopHandGestures(false);
    setStatusUI('loading', 'Initializing Aether Optics…');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatusUI(
            'error',
            'Camera Unavailable',
            'Webcam API is unavailable in this browser context. Use Virtual Hand Preview or mouse/touch.'
        );
        return false;
    }

    try {
        const [stream] = await Promise.all([
            navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 320 },
                    height: { ideal: 240 },
                    frameRate: { ideal: 30, max: 30 },
                    facingMode: 'user',
                },
                audio: false,
            }),
            ensureHandLandmarker(),
        ]);

        if (activeMode !== 'loading') {
            stream.getTracks().forEach((t) => t.stop());
            return false;
        }

        mediaStream = stream;
        if (els.pipVideo) {
            els.pipVideo.srcObject = stream;
            els.pipVideo.classList.toggle('gesture-pip__video--mirrored', mirrored);
            await els.pipVideo.play();
        }

        filterX.reset();
        filterY.reset();
        filterPinch.reset();
        filterCurl.reset();
        lastVideoTime = -1;
        setStatusUI('webcam', 'Show hand to camera');
        hooks.onToast?.('Aether Hand Control online — Closed Palm (✊) grabs pipettes; Pinch (🤏) grips Cuvette, taps buttons, or orbits.', 'success');
        webcamLoop();
        return true;
    } catch (err) {
        console.warn('[HandGestures] Activation error:', err);
        stopHandGestures(false);
        const isPerm = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
        const isMissing = err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError';
        const reason = isPerm
            ? 'Camera permission was denied. Allow webcam access or try Virtual Hand Preview below.'
            : isMissing
            ? 'No webcam detected on this device. You can still try Virtual Hand Preview below.'
            : `Could not start hand tracking (${err?.message || 'camera unavailable'}).`;
        setStatusUI('error', isPerm ? 'Camera Blocked' : 'No Webcam', reason);
        return false;
    }
}

export function stopHandGestures(notifyOff = true) {
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    detachVirtualListeners();
    if (mediaStream) {
        mediaStream.getTracks().forEach((t) => t.stop());
        mediaStream = null;
    }
    if (els.pipVideo) {
        els.pipVideo.pause();
        els.pipVideo.srcObject = null;
    }
    if (gState.session === 'grab3d' || gState.session === 'pinchCuvette' || gState.session === 'pinchSpecBtn') {
        hooks.cancelVirtualPointer?.();
    }
    clearHudHover();
    gState.visible = false;
    gState.session = 'idle';
    gState.sessionHudBtn = null;
    gState.isFistActive = false;
    gState.isPinchActive = false;
    gState.fistCandidateStartMs = 0;
    gState.pinchCandidateStartMs = 0;
    gState.orbitEngaged = false;
    gState.twoHandZoomDist = null;
    gState.peaceStartMs = 0;
    filterX.reset();
    filterY.reset();
    filterPinch.reset();
    filterCurl.reset();
    updateCursorVisuals({ visible: false });

    if (notifyOff) {
        setStatusUI('off', 'Hands Off');
    }
}

export async function toggleHandGestures() {
    if (activeMode === 'off' || activeMode === 'error') {
        return startHandGestures();
    }
    stopHandGestures(true);
    return false;
}

export function setHandMirror(isMirrored) {
    mirrored = Boolean(isMirrored);
    if (els.pipVideo) {
        els.pipVideo.classList.toggle('gesture-pip__video--mirrored', mirrored);
    }
    if (els.mirrorBtn) {
        els.mirrorBtn.classList.toggle('gesture-pip__mini-btn--active', mirrored);
    }
}

export function getHandGestureStatus() {
    return {
        mode: activeMode,
        session: gState.session,
        isGrabbing: gState.session === 'grab3d',
        isPinching: gState.isPinchActive,
        isOrbiting: gState.session === 'pinchOrbit' && gState.orbitEngaged,
        normX: gState.normX,
        normY: gState.normY,
        clientX: gState.stableClientX,
        clientY: gState.stableClientY,
        gestureName: gState.gestureName,
        mirrored,
        pipCollapsed,
    };
}

// Deterministic synthetic hand input for automated E2E verification & demo
export function feedSyntheticHand({
    normX = 0.5,
    normY = 0.5,
    grab = false,
    pinch = false,
    peace = false,
    timeMs = null,
    instant = false,
} = {}) {
    if (activeMode === 'off' || activeMode === 'error') {
        setStatusUI('virtual', 'Aether Virtual');
    }
    const now = timeMs ?? performance.now();
    if (!gState.visible || instant) {
        filterX.reset();
        filterY.reset();
        filterPinch.reset();
        filterCurl.reset();
    }
    // Feed two frames spaced past debounce when instant is requested so hysteresis latches cleanly
    const payload = {
        normX,
        normY,
        pinchRatio: pinch && !grab ? 0.20 : 0.90,
        fistCurl: grab ? 0.72 : 1.45,
        rawFist: Boolean(grab),
        isPeace: Boolean(peace),
    };
    if (instant) {
        processHandFrame(payload, now);
        processHandFrame(payload, now + 60);
    } else {
        processHandFrame(payload, now);
    }
    drawVirtualHandPreview(gState.normX, gState.normY, gState.session);
    return getHandGestureStatus();
}

export function initHandGestures(elements, callbacks) {
    els = elements || {};
    hooks = callbacks || {};

    if (els.pipCollapseBtn) {
        els.pipCollapseBtn.addEventListener('click', () => {
            pipCollapsed = !pipCollapsed;
            if (els.pipCard) els.pipCard.classList.toggle('gesture-pip--collapsed', pipCollapsed);
            els.pipCollapseBtn.setAttribute('aria-expanded', pipCollapsed ? 'false' : 'true');
            els.pipCollapseBtn.title = pipCollapsed ? 'Expand Hand Telemetry' : 'Minimize Hand Telemetry';
        });
    }

    if (els.pipCloseBtn) {
        els.pipCloseBtn.addEventListener('click', () => stopHandGestures(true));
    }

    if (els.mirrorBtn) {
        els.mirrorBtn.classList.toggle('gesture-pip__mini-btn--active', mirrored);
        els.mirrorBtn.addEventListener('click', () => setHandMirror(!mirrored));
    }

    if (els.virtualDemoBtn) {
        els.virtualDemoBtn.addEventListener('click', () => startVirtualHandMode());
    }

    if (els.retryCamBtn) {
        els.retryCamBtn.addEventListener('click', () => startHandGestures());
    }

    window.addEventListener('beforeunload', () => stopHandGestures(false));
}
