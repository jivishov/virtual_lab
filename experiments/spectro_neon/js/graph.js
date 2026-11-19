// graph.js - High-DPI Beer's Law Calibration Curve Renderer
import { getState } from './state.js';
import * as config from './config.js';

let graphCanvas = null;
let graphCtx = null;

export function initGraph(canvasEl) {
    graphCanvas = canvasEl;
    if (graphCanvas) {
        graphCtx = graphCanvas.getContext('2d');
    }
}

export function drawGraph() {
    if (!graphCanvas || !graphCtx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = graphCanvas.clientWidth || 340;
    const cssHeight = graphCanvas.clientHeight || 220;
    if (graphCanvas.width !== Math.round(cssWidth * dpr) || graphCanvas.height !== Math.round(cssHeight * dpr)) {
        graphCanvas.width = Math.round(cssWidth * dpr);
        graphCanvas.height = Math.round(cssHeight * dpr);
    }

    const ctx = graphCtx;
    ctx.save();
    ctx.scale(dpr, dpr);

    // Clean scientific graph background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const state = getState();
    const plotData = state.dataTableData.filter(
        (d) => d.conc !== null && d.id !== 'unknown' && d.negLogT !== null && isFinite(d.negLogT)
    );

    const padding = { top: 18, right: 20, bottom: 40, left: 52 };
    const plotWidth = cssWidth - padding.left - padding.right;
    const plotHeight = cssHeight - padding.top - padding.bottom;

    const allConcValues = plotData.map((d) => d.conc);
    const unknownRow = state.dataTableData.find((r) => r.id === 'unknown');
    let calculatedUnknownConc = null;
    if (unknownRow && unknownRow.negLogT !== null && config.KNOWN_SLOPE > 0 && isFinite(unknownRow.negLogT)) {
        calculatedUnknownConc = unknownRow.negLogT / config.KNOWN_SLOPE;
        allConcValues.push(calculatedUnknownConc);
    }
    allConcValues.push(config.STOCK_CONCENTRATION);

    const allAbsValues = plotData.map((d) => d.negLogT);
    if (unknownRow && unknownRow.negLogT !== null && isFinite(unknownRow.negLogT)) {
        allAbsValues.push(unknownRow.negLogT);
    }
    allAbsValues.push(0.35);

    const maxConc = Math.max(0.1, ...allConcValues) * 1.12 || 1;
    const maxAbs = Math.max(0.1, ...allAbsValues) * 1.15 || 1;

    const scaleX = (conc) => padding.left + (conc / maxConc) * plotWidth;
    const scaleY = (abs) => padding.top + plotHeight - (abs / maxAbs) * plotHeight;

    // Subtle coordinate gridlines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i <= 5; i++) {
        const y = scaleY((maxAbs / 5) * i);
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + plotWidth, y);
        const x = scaleX((maxConc / 5) * i);
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + plotHeight);
    }
    ctx.stroke();

    // Axes
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + plotHeight);
    ctx.lineTo(padding.left + plotWidth, padding.top + plotHeight);
    ctx.stroke();

    // Axis titles
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'center';
    ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Concentration (µM)', padding.left + plotWidth / 2, cssHeight - 8);

    ctx.save();
    ctx.translate(14, padding.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Absorbance (-log T)', 0, 0);
    ctx.restore();

    // Ticks & labels
    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = '#64748b';
    ctx.font = '10px "Consolas", monospace';
    ctx.textAlign = 'right';
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
        const absValue = (maxAbs / 5) * i;
        const y = scaleY(absValue);
        ctx.moveTo(padding.left - 4, y);
        ctx.lineTo(padding.left, y);
        ctx.fillText(absValue.toFixed(2), padding.left - 7, y + 3);
    }
    ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
        const concValue = (maxConc / 5) * i;
        const x = scaleX(concValue);
        ctx.moveTo(x, padding.top + plotHeight);
        ctx.lineTo(x, padding.top + plotHeight + 4);
        ctx.fillText(concValue.toFixed(2), x, padding.top + plotHeight + 15);
    }
    ctx.stroke();

    // Beer's Law Calibration Regression Line (slope = KNOWN_SLOPE)
    if (plotData.length > 0 && config.KNOWN_SLOPE > 0) {
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(scaleX(0), scaleY(0));
        const endConc = maxConc;
        const endAbs = config.KNOWN_SLOPE * endConc;
        if (endAbs <= maxAbs * 1.02) {
            ctx.lineTo(scaleX(endConc), scaleY(endAbs));
        } else {
            const boundedConc = maxAbs / config.KNOWN_SLOPE;
            if (isFinite(boundedConc)) {
                ctx.lineTo(scaleX(boundedConc), scaleY(maxAbs));
            }
        }
        ctx.stroke();
    }

    // Calibration Standard Points
    plotData.forEach((d) => {
        const px = scaleX(d.conc);
        const py = scaleY(d.negLogT);
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.2;
        ctx.stroke();
    });

    // Unknown Sample Interpolated Point + Dashed Guide Lines
    if (calculatedUnknownConc !== null && unknownRow && unknownRow.negLogT !== null && isFinite(unknownRow.negLogT)) {
        const unknownX = scaleX(calculatedUnknownConc);
        const unknownY = scaleY(unknownRow.negLogT);
        if (
            unknownX >= padding.left &&
            unknownX <= padding.left + plotWidth &&
            unknownY >= padding.top &&
            unknownY <= padding.top + plotHeight
        ) {
            ctx.strokeStyle = 'rgba(74, 222, 128, 0.65)';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(padding.left, unknownY);
            ctx.lineTo(unknownX, unknownY);
            ctx.moveTo(unknownX, unknownY);
            ctx.lineTo(unknownX, padding.top + plotHeight);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#4ade80';
            ctx.beginPath();
            ctx.arc(unknownX, unknownY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#052e16';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    // Empty placeholder text
    if (plotData.length === 0 && calculatedUnknownConc === null) {
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.font = '12px "Segoe UI", system-ui, sans-serif';
        ctx.fillText('Calibration points will plot here as you measure', cssWidth / 2, cssHeight / 2 - 4);
    }

    ctx.restore();
}
