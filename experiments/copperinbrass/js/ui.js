// ui.js - DOM updates, feedback display, and UI rendering

import { getState, findObjectById, hasHistory } from './state.js';
import instructions, { getStepConfig, getTotalSteps } from './instructions.js';
import * as config from './config.js';
import * as GFX from './graphics.js';
import { t, getInstruction } from './i18n/i18n.js';

// Will be set by interaction.js to avoid circular dependency
let dragSetupCallback = null;

export function setDragSetupCallback(callback) {
    dragSetupCallback = callback;
}

// DOM element references
let stepProgressEl = null;
let feedbackEl = null;
let stepListEl = null;
let notebookMassEl = null;
let notebookCondEl = null;
let notebookTableBody = null;
let resultAreaEl = null;
let undoBtn = null;
let workbenchEl = null;
let graphAreaEl = null;
let graphCanvas = null;

// =============================================
// INITIALIZATION
// =============================================

export function initializeUI() {
    // Cache DOM references
    stepProgressEl = document.getElementById('step-progress');
    feedbackEl = document.querySelector('.feedback') || document.getElementById('feedback-panel');
    stepListEl = document.getElementById('step-list');
    notebookMassEl = document.getElementById('nb-mass');
    notebookCondEl = document.getElementById('nb-cond');
    notebookTableBody = document.querySelector('#nb-table tbody');
    resultAreaEl = document.getElementById('result-area');
    undoBtn = document.getElementById('undo-btn');
    workbenchEl = document.getElementById('workbench');
    graphAreaEl = document.getElementById('graph-area');
    graphCanvas = document.getElementById('calibration-graph');

    // Initial render
    updateUI();
}

// =============================================
// FEEDBACK DISPLAY
// =============================================

export function showFeedback(message, type = 'info') {
    const state = getState();

    // Update state
    state.feedback = { message, type };

    // Update DOM
    if (feedbackEl) {
        feedbackEl.textContent = message;
        feedbackEl.className = type;  // success, error, or info

        // Auto-hide success/info messages
        if (type !== 'error') {
            setTimeout(() => {
                feedbackEl.className = 'hidden';
            }, 4000);
        }
    }
}

// =============================================
// MAIN UI UPDATE
// =============================================

export function updateUI() {
    syncShelfStatus();
    updateInstructions();
    updateStepTracker();
    updateNotebook();
    updateHighlights();
    updateUndoButton();
    renderLabObjects();
}

// =============================================
// INSTRUCTIONS PANEL
// =============================================

function updateInstructions() {
    const state = getState();
    const stepConfig = getStepConfig(state.currentStep);

    // Update step progress pill
    if (stepProgressEl) {
        if (!stepConfig) {
            stepProgressEl.textContent = t('ui.complete');
            stepProgressEl.classList.add('complete');
        } else {
            stepProgressEl.textContent = t('ui.stepOf', { current: state.currentStep + 1, total: getTotalSteps() });
            stepProgressEl.classList.remove('complete');
        }
    }
}

function createGearPill(label) {
    const color = config.GEAR_COLORS[label] || '#6b7b8c';
    return `<span class="gear-pill" style="--tag:${color}">${label}</span>`;
}

// =============================================
// STEP TRACKER
// =============================================

function updateStepTracker() {
    if (!stepListEl) return;

    const state = getState();

    // Update step item classes
    const items = stepListEl.querySelectorAll('.step-item');
    items.forEach((item, idx) => {
        item.classList.toggle('active', idx === state.currentStep);
        item.classList.toggle('done', idx < state.currentStep);
        item.classList.toggle('pending', idx > state.currentStep);
    });

    // Scroll active step into view
    const activeItem = stepListEl.querySelector('.step-item.active');
    if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

export function buildStepTracker(containerEl) {
    if (!containerEl) return;

    const html = instructions.map((step, idx) => `
        <div class="step-item ${idx === 0 ? 'active' : 'pending'}" data-idx="${idx}">
            <div class="step-num">${idx + 1}</div>
            <div class="step-copy">
                <div class="step-title">${getInstruction(idx)}</div>
                <div class="step-gear">${(step.gear || []).map(g => createGearPill(g)).join('')}</div>
            </div>
        </div>
    `).join('');

    containerEl.innerHTML = html;
    stepListEl = containerEl;
}

// =============================================
// NOTEBOOK
// =============================================

function updateNotebook() {
    const state = getState();

    // Update brass mass
    if (notebookMassEl) {
        notebookMassEl.textContent = state.notebookData.brassMass
            ? state.notebookData.brassMass.toFixed(3) + ' g'
            : '--';
    }

    // Update condition (translate condition key)
    if (notebookCondEl) {
        const condKey = state.notebookData.condition === 'Dissolved' ? 'dissolved' : 'solid';
        notebookCondEl.textContent = t(`conditions.${condKey}`);
    }

    // Update measurements table
    if (notebookTableBody) {
        notebookTableBody.innerHTML = state.notebookData.measurements
            .map(m => `<tr><td>${m.sample}</td><td>${m.absorbance.toFixed(3)}</td></tr>`)
            .join('');
    }

    // Show cleaning area during cleaningChecklist step
    const cleaningAreaEl = document.getElementById('cleaning-area');
    if (cleaningAreaEl) {
        const stepConfig = getStepConfig(state.currentStep);
        const shouldShow = stepConfig?.action === 'cleaningChecklist';
        cleaningAreaEl.style.display = shouldShow ? 'block' : 'none';

        // Initialize checkbox handlers when cleaning area becomes visible
        if (shouldShow && window.initCleanupHandlers) {
            window.initCleanupHandlers();
        }
    }

    // Show result area only during submitCalculation step
    if (resultAreaEl) {
        const stepConfig = getStepConfig(state.currentStep);
        resultAreaEl.style.display = stepConfig?.action === 'submitCalculation' ? 'block' : 'none';
    }

    // Update calibration graph
    updateCalibrationGraph(state.notebookData.measurements);
}

// =============================================
// CALIBRATION GRAPH
// =============================================

function updateCalibrationGraph(measurements) {
    if (!graphCanvas || !graphAreaEl) return;

    // Get standards from measurements
    const standards = measurements.filter(m => m.sample.includes('M'));
    const unknown = measurements.find(m => m.sample === 'Unknown');

    // Show graph area only when we have at least one standard measurement
    if (standards.length === 0) {
        graphAreaEl.style.display = 'none';
        return;
    }
    graphAreaEl.style.display = 'block';

    const ctx = graphCanvas.getContext('2d');
    const W = graphCanvas.width;
    const H = graphCanvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, W, H);

    // Graph padding
    const pad = { left: 35, right: 15, top: 15, bottom: 25 };
    const gW = W - pad.left - pad.right;
    const gH = H - pad.top - pad.bottom;

    // Data ranges (Concentration: 0-0.5M, Absorbance: 0-1.0)
    const maxConc = 0.5;
    const maxAbs = 1.0;

    // Helper functions
    const xScale = (conc) => pad.left + (conc / maxConc) * gW;
    const yScale = (abs) => pad.top + gH - (abs / maxAbs) * gH;

    // Draw axes
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, pad.top + gH);
    ctx.lineTo(pad.left + gW, pad.top + gH);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = '#5d6d7e';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t('graph.concentration'), pad.left + gW / 2, H - 3);

    // Y-axis label (rotated)
    ctx.save();
    ctx.translate(10, pad.top + gH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(t('graph.absorbance'), 0, 0);
    ctx.restore();

    // Axis tick marks and values
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';

    // X-axis ticks
    [0, 0.1, 0.2, 0.3, 0.4, 0.5].forEach(v => {
        const x = xScale(v);
        ctx.beginPath();
        ctx.moveTo(x, pad.top + gH);
        ctx.lineTo(x, pad.top + gH + 3);
        ctx.stroke();
        if (v > 0) ctx.fillText(v.toFixed(1), x, pad.top + gH + 12);
    });

    // Y-axis ticks
    ctx.textAlign = 'right';
    [0, 0.2, 0.4, 0.6, 0.8, 1.0].forEach(v => {
        const y = yScale(v);
        ctx.beginPath();
        ctx.moveTo(pad.left - 3, y);
        ctx.lineTo(pad.left, y);
        ctx.stroke();
        ctx.fillText(v.toFixed(1), pad.left - 5, y + 3);
    });

    // Draw calibration line (Beer's Law: A = εbc, through origin with slope ~2.22)
    const slope = config.MOLAR_ABSORPTIVITY;
    const intercept = config.Y_INTERCEPT;
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(xScale(0), yScale(intercept));
    ctx.lineTo(xScale(0.45), yScale(slope * 0.45 + intercept));
    ctx.stroke();
    ctx.setLineDash([]);

    // Concentration lookup for standards
    const concLookup = { '0.1M': 0.1, '0.2M': 0.2, '0.4M': 0.4 };

    // Draw standard points (blue circles)
    ctx.fillStyle = '#2980b9';
    standards.forEach(m => {
        const conc = concLookup[m.sample] || 0;
        const x = xScale(conc);
        const y = yScale(m.absorbance);
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw unknown point (green circle with dashed lines to axes)
    if (unknown) {
        const unknownConc = config.calculateConcentration(unknown.absorbance);
        const x = xScale(unknownConc);
        const y = yScale(unknown.absorbance);

        // Dashed lines to axes
        ctx.strokeStyle = '#27ae60';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, pad.top + gH);
        ctx.moveTo(x, y);
        ctx.lineTo(pad.left, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Unknown point
        ctx.fillStyle = '#27ae60';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        ctx.fillStyle = '#27ae60';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(t('graph.unknown'), x + 8, y + 3);
    }

    // Legend
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'left';

    // Standards legend
    ctx.fillStyle = '#2980b9';
    ctx.beginPath();
    ctx.arc(pad.left + 5, pad.top + 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5d6d7e';
    ctx.fillText(t('graph.standards'), pad.left + 12, pad.top + 11);

    // Best fit line legend
    ctx.strokeStyle = '#3498db';
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(pad.left + 35, pad.top + 8);
    ctx.lineTo(pad.left + 50, pad.top + 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText(t('graph.fit'), pad.left + 54, pad.top + 11);
}

// =============================================
// HIGHLIGHTS
// =============================================

function updateHighlights() {
    const state = getState();
    const stepConfig = getStepConfig(state.currentStep);

    // Remove all highlights
    document.querySelectorAll('.lab-obj.highlighted, .shelf-item.highlighted').forEach(el => {
        el.classList.remove('highlighted');
    });

    if (!stepConfig || !stepConfig.highlight) return;

    // Add highlights to relevant objects
    stepConfig.highlight.forEach(id => {
        // Try workbench objects
        const obj = state.labObjects.find(o =>
            o.id === id ||
            o.type === id ||
            o.id.startsWith(id) ||
            (o.props?.sourceType === id) ||
            (o.props?.assignedTo === id)  // Match pipettes by assignment
        );

        if (obj) {
            const el = document.getElementById(obj.id);
            if (el) el.classList.add('highlighted');
        }

        // Try shelf items
        const shelfItem = document.querySelector(`.shelf-item[data-type="${id}"]`);
        if (shelfItem) shelfItem.classList.add('highlighted');
    });
}

// =============================================
// UNDO BUTTON
// =============================================

function updateUndoButton() {
    if (undoBtn) {
        undoBtn.disabled = !hasHistory();
    }
}

// =============================================
// LAB OBJECT RENDERING
// =============================================

function renderLabObjects() {
    const state = getState();

    state.labObjects.forEach(obj => {
        renderLabObject(obj);
    });
}

export function renderLabObject(obj) {
    let el = document.getElementById(obj.id);
    let isNew = false;

    // Create element if it doesn't exist
    if (!el && workbenchEl) {
        el = document.createElement('div');
        el.id = obj.id;
        el.className = 'lab-obj';
        el.draggable = true;
        el.style.position = 'absolute';
        el.style.touchAction = 'none';
        workbenchEl.appendChild(el);
        isNew = true;
    }

    if (!el) return;

    // Setup drag events for new elements
    if (isNew && dragSetupCallback) {
        dragSetupCallback(el, obj);
    }

    // Update position
    el.style.left = obj.x + 'px';
    el.style.top = obj.y + 'px';

    // Handle visibility
    if (obj.props?.inBeaker || obj.props?.inSpec) {
        el.style.display = 'none';
    } else {
        el.style.display = 'block';
    }

    // Set z-index based on type
    if (obj.type === 'brass') el.style.zIndex = '100';
    else if (obj.type === 'pipette') el.style.zIndex = '200';
    else if (obj.type === 'cuvette') el.style.zIndex = '101';

    // Render SVG content
    el.innerHTML = getObjectSVG(obj);
}

function getObjectSVG(obj) {
    const p = obj.props || {};

    switch (obj.type) {
        case 'balance':
            return GFX.balance(p.reading || '0.000');

        case 'brass':
            return GFX.brass();

        case 'beaker':
            return GFX.beaker(
                p.vol || 0,
                p.color || 'transparent',
                p.hasBrass || false,
                p.reacting || false,
                '50ml',
                GFX.getContentLabel(p.content)
            );

        case 'flask':
            return GFX.flask(
                p.vol || 0,
                p.color || 'transparent',
                GFX.getContentLabel(p.content)
            );

        case 'pipette':
            return GFX.pipette(
                p.vol || 0,
                p.color || 'transparent',
                p.serial || ''
            );

        case 'bottle':
            return GFX.bottle(p.label || 'H₂O', p.color || config.COLORS.water);

        case 'spec':
            const state = getState();
            return GFX.spec({
                open: state.specState.open,
                reading: state.specState.reading,
                cuvette: state.specState.hasCuvette
            });

        case 'rack':
            return GFX.rack();

        case 'cuvette':
            return GFX.cuvette(
                p.color || 'transparent',
                p.vol || 0,
                GFX.getContentLabel(p.assignedTo)
            );

        case 'waste':
            return GFX.waste(p.vol || 10, p.disposedPipettes || []);

        default:
            return '';
    }
}

// =============================================
// SHELF ITEM STATUS
// =============================================

export function updateShelfItemStatus(type, taken) {
    const shelfItem = document.querySelector(`.shelf-item[data-type="${type}"]`);
    if (shelfItem) {
        shelfItem.classList.toggle('taken', taken);
    }
}

// Sync all shelf items with current equipment counts
export function syncShelfStatus() {
    const state = getState();

    // List of singleton equipment types
    const singletons = ['balance', 'brass', 'beaker', 'flask', 'spec', 'rack', 'waste', 'acid', 'water', 'std1', 'std2', 'std4'];

    singletons.forEach(type => {
        const count = state.equipmentCounts[type] || 0;
        updateShelfItemStatus(type, count > 0);
    });

    // Remove DOM elements for lab objects that no longer exist in state
    const workbench = document.getElementById('workbench');
    if (workbench) {
        const existingIds = state.labObjects.map(o => o.id);
        const domObjects = workbench.querySelectorAll('.lab-obj');
        domObjects.forEach(el => {
            if (!existingIds.includes(el.id)) {
                el.remove();
            }
        });
    }
}

// =============================================
// RESULT CHECKING
// =============================================

export function checkResult() {
    const input = document.getElementById('user-calc');
    if (!input) return;

    const userAnswer = parseFloat(input.value);
    if (isNaN(userAnswer)) {
        showFeedback(t('messages.enterNumeric'), 'error');
        return;
    }

    // Import and call action
    import('./actions.js').then(actions => {
        actions.trySubmitCalculation(userAnswer);
    });
}

// Make checkResult available globally for onclick
window.checkResult = checkResult;
