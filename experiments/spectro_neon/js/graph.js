// graph.js - High-DPI Theme-Aware Interactive Beer's Law Calibration Curve Renderer
// Features smooth animated morphing between Linear Absorbance (A = ε·b·c) and Exponential %Transmittance
// (%T = 100·10^(-m·c)), optional "Predict Next" Beer-Lambert ghost previews, and Light/Dark palettes.
import { getState } from './state.js';
import * as config from './config.js';

let graphCanvas = null;
let graphCtx = null;
let tooltipEl = null;
let r2BadgeEl = null;
let eqBadgeEl = null;

// Plot display mode: 'abs' (morphT -> 0) or 'pctT' (morphT -> 1)
let plotMode = 'abs';
let morphT = 0; // 0 = pure Linear Absorbance, 1 = pure Exponential %T
let morphRaf = null;
let predictOverlayEnabled = false;
let lastPlotMeta = null;
let hoverPointer = null;

function isLightTheme(forceLight = false) {
    if (forceLight) return true;
    return document.documentElement?.dataset?.theme === 'light';
}

function getPalette(forceLight = false) {
    if (isLightTheme(forceLight)) {
        return {
            bgTop: '#ffffff',
            bgBottom: '#f8fafc',
            plotFill: 'rgba(241, 245, 249, 0.55)',
            grid: 'rgba(15, 23, 42, 0.08)',
            axis: 'rgba(15, 23, 42, 0.38)',
            axisTitle: '#334155',
            tickText: '#64748b',
            tickStroke: 'rgba(15, 23, 42, 0.35)',
            lineAbs: '#e11d48',
            lineAbsGlow: 'rgba(225, 29, 72, 0.16)',
            linePct: '#d97706',
            linePctGlow: 'rgba(217, 119, 6, 0.16)',
            pointHalo: 'rgba(2, 132, 199, 0.16)',
            pointRing: '#ffffff',
            unkColor: '#16a34a',
            unkHalo: 'rgba(22, 163, 74, 0.22)',
            unkGuide: 'rgba(22, 163, 74, 0.65)',
            unkTagBg: 'rgba(240, 253, 244, 0.96)',
            unkTagBorder: 'rgba(22, 163, 74, 0.55)',
            unkTagText: '#14532d',
            legendText: '#334155',
            emptyTitle: '#475569',
            emptySub: '#64748b',
            hoverRing: '#0f172a',
            hoverDash: 'rgba(15, 23, 42, 0.30)',
            crosshair: 'rgba(2, 132, 199, 0.42)',
            predictStroke: 'rgba(2, 132, 199, 0.72)',
            predictText: '#0369a1',
        };
    }
    return {
        bgTop: '#091122',
        bgBottom: '#060b16',
        plotFill: 'rgba(15, 23, 42, 0.35)',
        grid: 'rgba(148, 163, 184, 0.11)',
        axis: 'rgba(148, 163, 184, 0.48)',
        axisTitle: '#cbd5e1',
        tickText: '#94a3b8',
        tickStroke: 'rgba(148, 163, 184, 0.45)',
        lineAbs: '#fb7185',
        lineAbsGlow: 'rgba(248, 113, 113, 0.24)',
        linePct: '#fbbf24',
        linePctGlow: 'rgba(251, 191, 36, 0.22)',
        pointHalo: 'rgba(56, 189, 248, 0.22)',
        pointRing: '#070d1a',
        unkColor: '#4ade80',
        unkHalo: 'rgba(74, 222, 128, 0.28)',
        unkGuide: 'rgba(74, 222, 128, 0.72)',
        unkTagBg: 'rgba(6, 36, 22, 0.92)',
        unkTagBorder: 'rgba(74, 222, 128, 0.55)',
        unkTagText: '#bbf7d0',
        legendText: '#cbd5e1',
        emptyTitle: '#64748b',
        emptySub: '#475569',
        hoverRing: '#f8fafc',
        hoverDash: 'rgba(148, 163, 184, 0.38)',
        crosshair: 'rgba(56, 189, 248, 0.38)',
        predictStroke: 'rgba(56, 189, 248, 0.78)',
        predictText: '#7dd3fc',
    };
}

function getPointSwatchColor(row, light) {
    if (row.id === 'unknown') return light ? '#16a34a' : '#4ade80';
    if (row.conc === null || row.conc <= 0.001) return light ? '#0284c7' : '#7dd3fc';
    const t = Math.max(0, Math.min(1, row.conc / config.STOCK_CONCENTRATION));
    if (light) {
        const r = Math.round(14 - 8 * t);
        const g = Math.round(165 - 110 * t);
        const b = Math.round(233 - 10 * t);
        return `rgb(${r}, ${g}, ${b})`;
    }
    const r = Math.round(56 - 30 * t);
    const g = Math.round(189 - 92 * t);
    const b = Math.round(248 - 8 * t);
    return `rgb(${r}, ${g}, ${b})`;
}

function computeLinearityR2(points, slope) {
    if (!points || points.length < 2) return null;
    const ys = points.map((p) => p.negLogT);
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    let ssTot = 0;
    let ssRes = 0;
    for (const p of points) {
        const yHat = slope * p.conc;
        ssTot += (p.negLogT - meanY) ** 2;
        ssRes += (p.negLogT - yHat) ** 2;
    }
    if (ssTot <= 1e-12) return 1.0;
    return Math.max(0, Math.min(1, 1 - ssRes / ssTot));
}

export function getCurrentLinearityR2() {
    const state = getState();
    const plotData = state.dataTableData.filter(
        (d) => d.conc !== null && d.id !== 'unknown' && d.negLogT !== null && isFinite(d.negLogT)
    );
    return computeLinearityR2(plotData, config.KNOWN_SLOPE);
}

function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function setGraphPlotMode(mode, animate = true) {
    const nextMode = mode === 'pctT' ? 'pctT' : 'abs';
    plotMode = nextMode;
    hoverPointer = null;
    if (tooltipEl) tooltipEl.classList.remove('graph-tooltip--visible');

    const targetMorph = nextMode === 'pctT' ? 1 : 0;
    if (!animate || Math.abs(morphT - targetMorph) < 0.001) {
        if (morphRaf) cancelAnimationFrame(morphRaf);
        morphRaf = null;
        morphT = targetMorph;
        drawGraph();
        return;
    }

    if (morphRaf) cancelAnimationFrame(morphRaf);
    const startMorph = morphT;
    const startTime = performance.now();
    const duration = 460;

    const step = (now) => {
        const p = Math.min(1, (now - startTime) / duration);
        morphT = startMorph + (targetMorph - startMorph) * easeInOutCubic(p);
        drawGraph();
        if (p < 1) {
            morphRaf = requestAnimationFrame(step);
        } else {
            morphT = targetMorph;
            morphRaf = null;
            drawGraph();
        }
    };
    morphRaf = requestAnimationFrame(step);
}

export function getGraphPlotMode() {
    return plotMode;
}

export function setPredictOverlayEnabled(enabled) {
    predictOverlayEnabled = Boolean(enabled);
    drawGraph();
}

export function isPredictOverlayEnabled() {
    return predictOverlayEnabled;
}

export function getGraphSnapshotDataUrl(forceLight = false, forceLinearAbs = true) {
    if (!graphCanvas) return null;
    const prevPlotMode = plotMode;
    const prevMorphT = morphT;
    const prevPredict = predictOverlayEnabled;
    const prevHover = hoverPointer;
    try {
        if (forceLinearAbs) {
            plotMode = 'abs';
            morphT = 0;
            predictOverlayEnabled = false;
        }
        hoverPointer = null;
        drawGraph(forceLight, true);
        const url = graphCanvas.toDataURL('image/png');
        return url;
    } catch {
        return null;
    } finally {
        plotMode = prevPlotMode;
        morphT = prevMorphT;
        predictOverlayEnabled = prevPredict;
        hoverPointer = prevHover;
        drawGraph(false);
    }
}

export function initGraph(canvasEl, options = {}) {
    graphCanvas = canvasEl;
    tooltipEl = options.tooltipEl || document.getElementById('graph-tooltip');
    r2BadgeEl = options.r2BadgeEl || document.getElementById('graph-r2-badge');
    eqBadgeEl = options.eqBadgeEl || document.getElementById('graph-eq-badge');

    if (graphCanvas) {
        graphCtx = graphCanvas.getContext('2d');

        graphCanvas.addEventListener('pointermove', (e) => {
            const rect = graphCanvas.getBoundingClientRect();
            hoverPointer = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
            drawGraph();
        });

        graphCanvas.addEventListener('pointerleave', () => {
            hoverPointer = null;
            if (tooltipEl) tooltipEl.classList.remove('graph-tooltip--visible');
            drawGraph();
        });
    }
}

export function drawGraph(forceLight = false, isSnapshot = false) {
    if (!graphCanvas || !graphCtx) return;

    const dpr = isSnapshot ? Math.max(window.devicePixelRatio || 1, 2) : Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = (isSnapshot ? 460 : graphCanvas.clientWidth) || 440;
    const cssHeight = (isSnapshot ? 276 : graphCanvas.clientHeight) || 266;
    if (cssWidth < 20 || cssHeight < 20) return;

    const targetW = Math.round(cssWidth * dpr);
    const targetH = Math.round(cssHeight * dpr);
    if (graphCanvas.width !== targetW || graphCanvas.height !== targetH) {
        graphCanvas.width = targetW;
        graphCanvas.height = targetH;
    }

    const pal = getPalette(forceLight);
    const light = isLightTheme(forceLight);
    const ctx = graphCtx;
    ctx.save();
    ctx.scale(dpr, dpr);

    // Coordinate surface background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, cssHeight);
    bgGrad.addColorStop(0, pal.bgTop);
    bgGrad.addColorStop(1, pal.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const state = getState();
    const plotData = state.dataTableData.filter(
        (d) => d.conc !== null && d.id !== 'unknown' && d.negLogT !== null && isFinite(d.negLogT)
    );

    const padding = { top: 24, right: 24, bottom: 42, left: 56 };
    const plotWidth = Math.max(40, cssWidth - padding.left - padding.right);
    const plotHeight = Math.max(40, cssHeight - padding.top - padding.bottom);

    const allConcValues = plotData.map((d) => d.conc);
    const unknownRow = state.dataTableData.find((r) => r.id === 'unknown');
    let calculatedUnknownConc = null;
    if (unknownRow && unknownRow.negLogT !== null && config.KNOWN_SLOPE > 0 && isFinite(unknownRow.negLogT)) {
        calculatedUnknownConc = unknownRow.negLogT / config.KNOWN_SLOPE;
        allConcValues.push(calculatedUnknownConc);
    }
    allConcValues.push(config.STOCK_CONCENTRATION);

    const maxConc = Math.max(0.1, ...allConcValues) * 1.12 || 1;
    const isPctMode = plotMode === 'pctT';
    const m = morphT; // 0 = Absorbance, 1 = %T

    const allAbsValues = plotData.map((d) => d.negLogT);
    if (unknownRow && unknownRow.negLogT !== null && isFinite(unknownRow.negLogT)) {
        allAbsValues.push(unknownRow.negLogT);
    }
    allAbsValues.push(0.35);
    const maxAbsY = Math.max(0.1, ...allAbsValues) * 1.15 || 1;
    const maxPctY = 105;

    const scaleX = (conc) => padding.left + (conc / maxConc) * plotWidth;
    const scaleYAbs = (absVal) => padding.top + plotHeight - (absVal / maxAbsY) * plotHeight;
    const scaleYPct = (pctVal) => padding.top + plotHeight - (pctVal / maxPctY) * plotHeight;
    // Morphing Y coordinate blends smoothly between Absorbance y-position and %T y-position!
    const scaleYMorph = (absVal, pctVal) => {
        const yA = scaleYAbs(absVal);
        const yP = scaleYPct(pctVal);
        return yA + (yP - yA) * m;
    };

    const maxY = isPctMode ? maxPctY : maxAbsY;
    const scaleY = (val) => padding.top + plotHeight - (val / maxY) * plotHeight;
    const invX = (px) => ((px - padding.left) / plotWidth) * maxConc;
    const invY = (py) => ((padding.top + plotHeight - py) / plotHeight) * maxY;

    // Subtle plot frame tint
    ctx.fillStyle = pal.plotFill;
    ctx.fillRect(padding.left, padding.top, plotWidth, plotHeight);

    // Coordinate gridlines
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i <= 5; i++) {
        const y = m >= 0.5 ? scaleYPct(i * 20) : scaleYAbs((maxAbsY / 5) * i);
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + plotWidth, y);
        const x = scaleX((maxConc / 5) * i);
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + plotHeight);
    }
    ctx.stroke();

    // Axes
    ctx.strokeStyle = pal.axis;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + plotHeight);
    ctx.lineTo(padding.left + plotWidth, padding.top + plotHeight);
    ctx.stroke();

    // Axis titles
    ctx.fillStyle = pal.axisTitle;
    ctx.textAlign = 'center';
    ctx.font = '600 11px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Concentration (µM)', padding.left + plotWidth / 2, cssHeight - 8);

    ctx.save();
    ctx.translate(14, padding.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(m >= 0.5 ? 'Transmittance (%T)' : 'Absorbance (−log₁₀ T)', 0, 0);
    ctx.restore();

    // Ticks & labels
    ctx.fillStyle = pal.tickText;
    ctx.strokeStyle = pal.tickStroke;
    ctx.font = '10px "JetBrains Mono", "Consolas", monospace';
    ctx.textAlign = 'right';
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
        const showPctTicks = m >= 0.5;
        const val = showPctTicks ? i * 20 : (maxAbsY / 5) * i;
        const y = showPctTicks ? scaleYPct(val) : scaleYAbs(val);
        ctx.moveTo(padding.left - 4, y);
        ctx.lineTo(padding.left, y);
        ctx.fillText(showPctTicks ? `${val}%` : val.toFixed(2), padding.left - 7, y + 3);
    }
    for (let i = 0; i <= 5; i++) {
        const concValue = (maxConc / 5) * i;
        const x = scaleX(concValue);
        ctx.moveTo(x, padding.top + plotHeight);
        ctx.lineTo(x, padding.top + plotHeight + 4);
        ctx.textAlign = i === 0 ? 'left' : i === 5 ? 'right' : 'center';
        ctx.fillText(concValue.toFixed(2), i === 0 ? x + 2 : x, padding.top + plotHeight + 17);
    }
    ctx.stroke();

    // Theoretical Model Curve (smoothly morphs between linear A = m·c and exponential %T = 100·10^(-m·c)!)
    if ((plotData.length > 0 || predictOverlayEnabled) && config.KNOWN_SLOPE > 0) {
        const traceModel = () => {
            ctx.beginPath();
            const steps = 64;
            let started = false;
            for (let i = 0; i <= steps; i++) {
                const c = (maxConc * i) / steps;
                const aVal = config.KNOWN_SLOPE * c;
                const pctVal = 100 * Math.pow(10, -aVal);
                const x = scaleX(c);
                const y = scaleYMorph(aVal, pctVal);
                if (y < padding.top - 4 || y > padding.top + plotHeight + 4) continue;
                if (!started) {
                    ctx.moveTo(x, y);
                    started = true;
                } else {
                    ctx.lineTo(x, y);
                }
            }
        };

        const isCurveAccent = m >= 0.5;
        ctx.save();
        if (plotData.length === 0 && predictOverlayEnabled) {
            ctx.setLineDash([5, 4]);
        }
        ctx.strokeStyle = isCurveAccent ? pal.linePctGlow : pal.lineAbsGlow;
        ctx.lineWidth = 5.5;
        traceModel();
        ctx.stroke();

        ctx.strokeStyle = isCurveAccent ? pal.linePct : pal.lineAbs;
        ctx.lineWidth = 2.0;
        traceModel();
        ctx.stroke();
        ctx.restore();
    }

    // Optional "Predict Next" Ghost Points for Unmeasured Standards
    if (predictOverlayEnabled) {
        const unmeasured = state.dataTableData.filter(
            (r) => r.id !== 'unknown' && r.conc !== null && r.measuredPercentT === null
        );
        unmeasured.forEach((row) => {
            const predAbs = config.KNOWN_SLOPE * row.conc;
            const predPct = 100 * Math.pow(10, -predAbs);
            const px = scaleX(row.conc);
            const py = scaleYMorph(predAbs, predPct);
            if (py < padding.top || py > padding.top + plotHeight) return;

            ctx.save();
            ctx.strokeStyle = pal.predictStroke;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([2.5, 2.5]);
            ctx.beginPath();
            ctx.arc(px, py, 5.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = pal.predictText;
            ctx.font = '600 9px "JetBrains Mono", "Consolas", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(row.dilution.replace(/\s+/g, ''), px, py - 9);
            ctx.restore();
        });
    }

    const screenPoints = [];

    // Standard Calibration Points
    plotData.forEach((d) => {
        const pctVal = parseFloat(d.measuredPercentT);
        const px = scaleX(d.conc);
        const py = scaleYMorph(d.negLogT, pctVal);
        const col = getPointSwatchColor(d, light);
        screenPoints.push({ px, py, row: d, conc: d.conc, abs: d.negLogT, pctT: pctVal, isUnknown: false, col });

        ctx.fillStyle = pal.pointHalo;
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = pal.pointRing;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    });

    // Unknown Sample Interpolated Point + Dashed Guide Lines
    if (calculatedUnknownConc !== null && unknownRow && unknownRow.negLogT !== null && isFinite(unknownRow.negLogT)) {
        const unkPct = parseFloat(unknownRow.measuredPercentT);
        const unknownX = scaleX(calculatedUnknownConc);
        const unknownY = scaleYMorph(unknownRow.negLogT, unkPct);
        if (
            unknownX >= padding.left &&
            unknownX <= padding.left + plotWidth &&
            unknownY >= padding.top &&
            unknownY <= padding.top + plotHeight
        ) {
            screenPoints.push({
                px: unknownX,
                py: unknownY,
                row: unknownRow,
                conc: calculatedUnknownConc,
                abs: unknownRow.negLogT,
                pctT: unkPct,
                isUnknown: true,
                col: pal.unkColor,
            });

            ctx.strokeStyle = pal.unkGuide;
            ctx.lineWidth = 1.3;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(padding.left, unknownY);
            ctx.lineTo(unknownX, unknownY);
            ctx.moveTo(unknownX, unknownY);
            ctx.lineTo(unknownX, padding.top + plotHeight);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = pal.unkHalo;
            ctx.beginPath();
            ctx.arc(unknownX, unknownY, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = pal.unkColor;
            ctx.beginPath();
            ctx.arc(unknownX, unknownY, 5.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = pal.pointRing;
            ctx.lineWidth = 1.6;
            ctx.stroke();

            ctx.fillStyle = pal.unkTagBg;
            const tagText = `Unknown: ${calculatedUnknownConc.toFixed(3)} µM`;
            ctx.font = '700 10px "JetBrains Mono", "Consolas", monospace';
            const tw = ctx.measureText(tagText).width + 12;
            const tagX = Math.max(padding.left + 6, Math.min(unknownX - tw - 10, padding.left + plotWidth - tw - 6));
            // Place tag neatly below the horizontal guide line when near the top legend so they never overlap!
            const nearTopLegend = unknownY < padding.top + 46;
            const tagY = nearTopLegend
                ? Math.min(padding.top + plotHeight - 22, unknownY + 9)
                : Math.max(padding.top + 24, unknownY - 22);
            ctx.beginPath();
            ctx.roundRect(tagX, tagY, tw, 17, 4);
            ctx.fill();
            ctx.strokeStyle = pal.unkTagBorder;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = pal.unkTagText;
            ctx.textAlign = 'left';
            ctx.fillText(tagText, tagX + 6, tagY + 12);
        }
    }

    // Inline Compact Legend
    if (plotData.length > 0 || predictOverlayEnabled) {
        const lx = padding.left + 9;
        const ly = m >= 0.5 ? padding.top + plotHeight - 12 : padding.top + 12;
        ctx.font = '600 10px "Inter", "Segoe UI", sans-serif';
        ctx.textAlign = 'left';

        ctx.fillStyle = light ? '#0284c7' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(lx + 4, ly, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pal.legendText;
        ctx.fillText(plotData.length > 0 ? 'Measured' : 'Predicted', lx + 11, ly + 3);

        ctx.strokeStyle = m >= 0.5 ? pal.linePct : pal.lineAbs;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lx + 74, ly);
        ctx.lineTo(lx + 86, ly);
        ctx.stroke();
        ctx.fillStyle = pal.legendText;
        ctx.fillText(m >= 0.5 ? 'Exponential Decay (Curved)' : 'Beer-Lambert Linear Fit', lx + 91, ly + 3);
    }

    // Empty placeholder state
    if (plotData.length === 0 && calculatedUnknownConc === null && !predictOverlayEnabled) {
        ctx.fillStyle = pal.emptyTitle;
        ctx.textAlign = 'center';
        ctx.font = '600 12.5px "Plus Jakarta Sans", "Inter", system-ui, sans-serif';
        ctx.fillText(
            isPctMode
                ? 'Measure standards to watch exponential %T decay unfold'
                : 'Measure standards in Spec 20D+ to build your Beer-Lambert curve',
            padding.left + plotWidth / 2,
            padding.top + plotHeight / 2 - 7
        );
        ctx.fillStyle = pal.emptySub;
        ctx.font = '500 11px "JetBrains Mono", "Consolas", monospace';
        ctx.fillText(
            isPctMode ? '%T = 100 · 10^(−ε·b·c)  ·  Try "Predict Next" below' : 'A = ε · b · c  ·  Try "Predict Next" below',
            padding.left + plotWidth / 2,
            padding.top + plotHeight / 2 + 14
        );
    }

    lastPlotMeta = { padding, plotWidth, plotHeight, maxConc, maxY, scaleX, scaleY, invX, invY, screenPoints, isPctMode, pal };
    if (hoverPointer && !forceLight && !isSnapshot) {
        renderHoverCrosshair(ctx, hoverPointer, lastPlotMeta, plotData.length > 0 || predictOverlayEnabled);
    }

    // Update R² & Model Equation Chips below graph (skip DOM mutations during print snapshot capture!)
    if (!isSnapshot) {
        const r2 = computeLinearityR2(plotData, config.KNOWN_SLOPE);
        if (eqBadgeEl) {
            if (isPctMode) {
                eqBadgeEl.innerHTML = `Curve: <strong>%T = 100·10^(−${config.KNOWN_SLOPE}c)</strong>`;
            } else {
                eqBadgeEl.innerHTML = plotData.length > 0
                    ? `Model: <strong>A = ${config.KNOWN_SLOPE}·c</strong>`
                    : `Model: <strong>A = ε·b·c</strong>`;
            }
        }
        if (r2BadgeEl) {
            if (isPctMode) {
                r2BadgeEl.innerHTML = `Why Log? <strong>Curved → Straight</strong>`;
            } else {
                r2BadgeEl.innerHTML = r2 !== null
                    ? `Linearity R²: <strong>${r2.toFixed(4)}</strong>`
                    : `Standards: <strong>${plotData.length} / 6</strong>`;
            }
        }
    }

    ctx.restore();
}

function positionTooltip(px, py) {
    if (!tooltipEl || !graphCanvas) return;
    const w = graphCanvas.clientWidth || 380;
    const clampedX = Math.max(96, Math.min(w - 100, px));
    const flipBelow = py < 68;
    tooltipEl.style.left = `${clampedX}px`;
    tooltipEl.style.top = `${py}px`;
    tooltipEl.style.transform = flipBelow ? 'translate(-50%, 18px)' : 'translate(-50%, -118%)';
    tooltipEl.classList.add('graph-tooltip--visible');
}

function renderHoverCrosshair(ctx, pointer, meta, hasFit) {
    const { padding, plotWidth, plotHeight, scaleY, invX, invY, screenPoints, isPctMode, pal } = meta;
    const inPlot =
        pointer.x >= padding.left &&
        pointer.x <= padding.left + plotWidth &&
        pointer.y >= padding.top &&
        pointer.y <= padding.top + plotHeight;

    if (!inPlot) {
        if (tooltipEl) tooltipEl.classList.remove('graph-tooltip--visible');
        return;
    }

    let nearest = null;
    let bestDist = 18;
    for (const pt of screenPoints) {
        const d = Math.hypot(pointer.x - pt.px, pointer.y - pt.py);
        if (d < bestDist) {
            bestDist = d;
            nearest = pt;
        }
    }

    if (nearest) {
        ctx.strokeStyle = pal.hoverRing;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(nearest.px, nearest.py, 8.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = pal.hoverDash;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(padding.left, nearest.py);
        ctx.lineTo(nearest.px, nearest.py);
        ctx.moveTo(nearest.px, nearest.py);
        ctx.lineTo(nearest.px, padding.top + plotHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        if (tooltipEl) {
            const pctT = nearest.row.measuredPercentT ?? '--';
            tooltipEl.innerHTML = `
                <div class="graph-tooltip__title">${nearest.row.solution}${nearest.isUnknown ? ' (Interpolated)' : ''}</div>
                <div class="graph-tooltip__mono">c = ${nearest.conc.toFixed(3)} µM · %T = ${pctT}%</div>
                <div class="graph-tooltip__mono">A = ${nearest.abs.toFixed(4)} Abs</div>
            `;
            positionTooltip(nearest.px, nearest.py);
        }
        return;
    }

    const conc = Math.max(0, invX(pointer.x));
    const abs = hasFit
        ? config.KNOWN_SLOPE * conc
        : isPctMode
        ? -Math.log10(Math.max(0.01, Math.min(1, invY(pointer.y) / 100)))
        : Math.max(0, invY(pointer.y));
    const predPctT = Math.pow(10, -abs) * 100;
    const snapY = hasFit
        ? Math.max(padding.top, Math.min(padding.top + plotHeight, scaleY(isPctMode ? predPctT : abs)))
        : pointer.y;

    ctx.strokeStyle = pal.crosshair;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(pointer.x, padding.top);
    ctx.lineTo(pointer.x, padding.top + plotHeight);
    ctx.moveTo(padding.left, snapY);
    ctx.lineTo(padding.left + plotWidth, snapY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (hasFit) {
        ctx.fillStyle = isPctMode ? pal.linePct : pal.lineAbs;
        ctx.beginPath();
        ctx.arc(pointer.x, snapY, 3.8, 0, Math.PI * 2);
        ctx.fill();
    }

    if (tooltipEl) {
        tooltipEl.innerHTML = `
            <div class="graph-tooltip__title">${
                hasFit
                    ? isPctMode
                        ? 'Exponential %T Decay'
                        : 'Beer-Lambert Linear Fit'
                    : 'Coordinate Readout'
            }</div>
            <div class="graph-tooltip__mono">c = ${conc.toFixed(3)} µM · %T ≈ ${predPctT.toFixed(1)}%</div>
            <div class="graph-tooltip__mono">A = ${abs.toFixed(4)} Abs</div>
        `;
        positionTooltip(pointer.x, snapY);
    }
}
