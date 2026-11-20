// main.js - 3D Photorealistic Spectrophotometry Simulation Entry Point
import * as config from './config.js';
import * as state from './state.js';
import * as actions from './actions.js';
import * as ui from './ui.js';
import * as graph from './graph.js';
import instructions from './instructions.js';
import {
    initScene3D,
    syncSceneFromState,
    triggerActionEffect,
    setCameraPreset,
    setLabelsVisible,
    getLabelsVisible,
    getScreenPoint,
} from './scene3d.js?v=3';
import { initInteraction3D, handleUndoClick, handleResetClick } from './interaction3d.js?v=3';

document.addEventListener('DOMContentLoaded', async () => {
    const getEl = (id) => document.getElementById(id);

    const viewportEl = getEl('viewport-3d');
    const labelsEl = getEl('labels-overlay');
    const loadingEl = getEl('loading-overlay');
    const loadingBarEl = getEl('loading-bar-fill');
    const loadingPctEl = getEl('loading-pct');

    const instructionEl = getEl('instruction-text');
    const stepBadgeEl = getEl('step-badge');
    const progressFillEl = getEl('progress-fill');
    const feedbackEl = document.querySelector('.feedback');
    const resultsTbody = getEl('results-tbody');
    const slopeDisplayEl = getEl('slope-display');
    const unknownResultEl = getEl('unknown-result');
    const undoButton = getEl('undo-button');
    const resetButton = getEl('reset-button');
    const graphCanvas = getEl('graph-canvas');
    const hoverInfoEl = getEl('hover-info');
    const specQuickReadoutEl = getEl('spec-quick-readout');
    const labelsToggleBtn = getEl('labels-toggle-btn');
    const dataPanelEl = getEl('data-panel');
    const graphPanelEl = getEl('graph-panel');

    const pipetteChips = {
        pipette_stock: getEl('chip-pipette-stock'),
        pipette_water: getEl('chip-pipette-water'),
        pipette_unknown: getEl('chip-pipette-unknown'),
    };

    try {
        // 1. Initialize State & Graph
        state.initializeState(undoButton);
        graph.initGraph(graphCanvas);

        // 2. Initialize UI
        ui.initUI(
            {
                instructionEl,
                stepBadgeEl,
                progressFillEl,
                feedbackEl,
                resultsTbody,
                slopeDisplayEl,
                unknownResultEl,
                undoButton,
                pipetteChips,
                specQuickReadoutEl,
                dataPanelEl,
                graphPanelEl,
            },
            () => syncSceneFromState(false)
        );

        // 3. Wire 3D Action Animations
        actions.setActionEffectHandler((type, payload) => {
            triggerActionEffect(type, payload);
        });

        // 4. Initialize Blender 5.2 Photorealistic 3D Scene
        await initScene3D(viewportEl, labelsEl, (progress) => {
            const pct = Math.round(progress * 100);
            if (loadingBarEl) loadingBarEl.style.width = `${pct}%`;
            if (loadingPctEl) loadingPctEl.textContent = `${pct}%`;
        });

        // 5. Initialize 3D Drag-and-Drop & Click Interaction
        const interactionActions = {
            tryZeroSpec: actions.tryZeroSpec,
            tryMeasure: actions.tryMeasure,
            tryToggleMode: actions.tryToggleMode,
            tryFillPipette: actions.tryFillPipette,
            tryDispensePipette: actions.tryDispensePipette,
            tryEmptyCuvette: actions.tryEmptyCuvette,
            tryInsertCuvette: actions.tryInsertCuvette,
            tryRemoveCuvetteFromSpec: actions.tryRemoveCuvetteFromSpec,
        };
        initInteraction3D({
            undoBtn: undoButton,
            resetBtn: resetButton,
            hoverEl: hoverInfoEl,
            actionFunctions: interactionActions,
        });

        // 6. Camera Preset Controls & Labels Toggle
        document.querySelectorAll('.cam-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                setCameraPreset(preset);
                document.querySelectorAll('.cam-btn').forEach((b) =>
                    b.classList.toggle('cam-btn--active', b === btn)
                );
            });
        });

        if (labelsToggleBtn) {
            labelsToggleBtn.addEventListener('click', () => {
                const next = !getLabelsVisible();
                setLabelsVisible(next);
                labelsToggleBtn.textContent = next ? 'Labels: ON' : 'Labels: OFF';
                labelsToggleBtn.classList.toggle('hud-pill--active', next);
            });
        }

        // Clickable Pipette Legend Chips select that dedicated pipette directly!
        Object.entries(pipetteChips).forEach(([pipId, chipEl]) => {
            if (!chipEl) return;
            chipEl.addEventListener('click', () => {
                const cur = state.getState().selectedObjectId;
                state.setStateVariable('selectedObjectId', cur === pipId ? null : pipId);
                ui.updateUI();
            });
        });

        // 7. Initial UI & Graph Render
        ui.updateUI();
        graph.drawGraph();
        actions.checkAndProcessInternalStep();
        syncSceneFromState(true);

        // Fade out loading screen
        if (loadingEl) {
            loadingEl.classList.add('loading-overlay--done');
            setTimeout(() => loadingEl.remove(), 350);
        }

        // Clean inspection hook for automated verification
        window.__SPECTRO_LAB__ = {
            getState: state.getState,
            instructions,
            actions: interactionActions,
            setCameraPreset,
            getScreenPoint,
            undo: handleUndoClick,
            reset: handleResetClick,
            syncScene: () => syncSceneFromState(true),
        };
    } catch (error) {
        console.error('Error initializing 3D Spectrophotometry Simulation:', error);
        if (loadingEl) {
            loadingEl.innerHTML = `<div class="loading-card"><p style="color:${config.COLORS.error};font-weight:600;">Failed to load 3D lab assets. Ensure the app is served over HTTP.</p><pre style="font-size:12px;opacity:.8;">${error.message}</pre></div>`;
        }
    }
});
