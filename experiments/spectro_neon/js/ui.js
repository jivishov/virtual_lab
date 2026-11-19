// ui.js - HUD, Instructions, Feedback, Data Table & Results Synchronizer
import { getState, setStateVariable } from './state.js';
import * as config from './config.js';
import instructions from './instructions.js';

let uiElements = {};
let sceneSyncCallback = null;

export function initUI(elements, onSceneSync = null) {
    uiElements = elements;
    sceneSyncCallback = onSceneSync;
}

export function showFeedback(message, type = 'info') {
    if (uiElements.feedbackEl) {
        uiElements.feedbackEl.textContent = message;
        uiElements.feedbackEl.classList.remove('feedback--success', 'feedback--error', 'feedback--info');
        if (type === 'success') {
            uiElements.feedbackEl.classList.add('feedback--success');
        } else if (type === 'error') {
            uiElements.feedbackEl.classList.add('feedback--error');
        } else {
            uiElements.feedbackEl.classList.add('feedback--info');
        }
    }
    setStateVariable('feedback', { message, type });
}

export function updateUI() {
    if (!uiElements.instructionEl) return;

    try {
        const state = getState();
        const stepConfig = instructions[state.currentStep];
        const totalActionableSteps = instructions.length - 1; // 83

        // Instructions & Step Progress Bar
        const pct = Math.min(100, Math.round((state.currentStep / totalActionableSteps) * 100));
        if (uiElements.progressFillEl) {
            uiElements.progressFillEl.style.width = `${pct}%`;
        }
        if (uiElements.stepBadgeEl) {
            if (state.currentStep >= totalActionableSteps) {
                uiElements.stepBadgeEl.textContent = `Complete (${totalActionableSteps}/${totalActionableSteps})`;
                uiElements.stepBadgeEl.classList.add('step-badge--done');
            } else {
                uiElements.stepBadgeEl.textContent = `Step ${state.currentStep + 1} / ${totalActionableSteps}`;
                uiElements.stepBadgeEl.classList.remove('step-badge--done');
            }
        }

        if (stepConfig && stepConfig.action) {
            uiElements.instructionEl.innerHTML = stepConfig.text;
            setStateVariable('highlights', stepConfig.highlight ? [...stepConfig.highlight] : []);
        } else if (stepConfig) {
            // Final completion step (Step 83)
            uiElements.instructionEl.innerHTML = `<strong>${stepConfig.text}</strong>`;
            setStateVariable('highlights', []);
        } else {
            uiElements.instructionEl.innerHTML = '<strong>Experiment Complete! Analysis finished.</strong>';
            setStateVariable('highlights', []);
        }

        // Keep panel highlights subtle when graph analysis / final info steps occur
        const curHighlights = getState().highlights;
        if (uiElements.dataPanelEl) {
            uiElements.dataPanelEl.classList.toggle('panel--highlight', curHighlights.includes('data-panel'));
        }
        if (uiElements.graphPanelEl) {
            uiElements.graphPanelEl.classList.toggle('panel--highlight', curHighlights.includes('graph-panel'));
        }

        // Update Feedback display from state
        showFeedback(state.feedback.message, state.feedback.type);

        // Update Data Table (exact same 6 columns & rounding precision!)
        if (uiElements.resultsTbody) {
            uiElements.resultsTbody.innerHTML = '';
            state.dataTableData.forEach((row) => {
                const tr = document.createElement('tr');
                if (row.measuredPercentT !== null) {
                    tr.classList.add('data-table__row--measured');
                }
                if (row.id === 'unknown') {
                    tr.classList.add('data-table__row--unknown');
                }

                let displayConc = row.conc;
                let displayAbs = row.negLogT;

                if (row.id === 'unknown') {
                    if (row.negLogT !== null && config.KNOWN_SLOPE > 0 && isFinite(row.negLogT)) {
                        displayConc = (row.negLogT / config.KNOWN_SLOPE).toFixed(3);
                        displayAbs = parseFloat(row.negLogT).toFixed(4);
                    } else if (row.negLogT === Infinity) {
                        displayConc = 'Too High';
                        displayAbs = `>${config.MAX_ABS.toFixed(1)}`;
                    } else {
                        displayConc = 'N/A';
                        displayAbs = '--';
                    }
                } else {
                    displayConc = displayConc !== null ? displayConc.toFixed(3) : '--';
                    if (displayAbs === Infinity || displayAbs > 10) {
                        displayAbs = `>${config.MAX_ABS.toFixed(1)}`;
                    } else if (displayAbs !== null) {
                        displayAbs = parseFloat(displayAbs).toFixed(4);
                    } else {
                        displayAbs = '--';
                    }
                }

                tr.innerHTML = `
                    <td class="data-table__cell data-table__cell--label">${row.solution}</td>
                    <td class="data-table__cell">${row.dilution}</td>
                    <td class="data-table__cell data-table__cell--mono">${displayConc}</td>
                    <td class="data-table__cell data-table__cell--mono">${row.measuredPercentT !== null ? row.measuredPercentT : '--'}</td>
                    <td class="data-table__cell data-table__cell--mono">${row.T !== null ? row.T : '--'}</td>
                    <td class="data-table__cell data-table__cell--mono">${displayAbs}</td>
                `;
                uiElements.resultsTbody.appendChild(tr);
            });
        }

        // Update Slope Display
        const measureCompleteStep = instructions.findIndex((instr) => instr.id === 'graph_analysis');
        if (uiElements.slopeDisplayEl) {
            if (measureCompleteStep > -1 && state.currentStep >= measureCompleteStep) {
                uiElements.slopeDisplayEl.textContent = `Calibration Line Slope (Abs/µM) ≈ ${config.KNOWN_SLOPE}`;
                uiElements.slopeDisplayEl.hidden = false;
            } else {
                uiElements.slopeDisplayEl.textContent = '';
                uiElements.slopeDisplayEl.hidden = true;
            }
        }

        // Update Unknown Result Display
        if (uiElements.unknownResultEl) {
            const unknownRow = state.dataTableData.find((r) => r.id === 'unknown');
            if (unknownRow && unknownRow.negLogT !== null && config.KNOWN_SLOPE > 0) {
                if (isFinite(unknownRow.negLogT)) {
                    const measuredAbs = parseFloat(unknownRow.negLogT);
                    const calculatedConc = measuredAbs / config.KNOWN_SLOPE;
                    uiElements.unknownResultEl.innerHTML = `<strong>Unknown Drink Conc. ≈ ${calculatedConc.toFixed(3)} µM</strong><br><small>Calc: Conc = Abs / Slope = ${measuredAbs.toFixed(4)} / ${config.KNOWN_SLOPE}</small>`;
                    uiElements.unknownResultEl.hidden = false;
                } else if (unknownRow.negLogT === Infinity) {
                    uiElements.unknownResultEl.innerHTML = `<strong>Unknown Concentration Too High</strong><br><small>Absorbance > ${config.MAX_ABS.toFixed(1)}.</small>`;
                    uiElements.unknownResultEl.hidden = false;
                } else {
                    uiElements.unknownResultEl.textContent = '';
                    uiElements.unknownResultEl.hidden = true;
                }
            } else {
                uiElements.unknownResultEl.textContent = '';
                uiElements.unknownResultEl.hidden = true;
            }
        }

        // Update Pipette Legend Pill highlighting
        if (uiElements.pipetteChips) {
            const activePipId = stepConfig?.pipette || null;
            Object.entries(uiElements.pipetteChips).forEach(([pid, el]) => {
                if (!el) return;
                const obj = state.labObjects.find((o) => o.id === pid);
                el.classList.toggle('pipette-chip--active', activePipId === pid);
                const volSpan = el.querySelector('.pipette-chip__vol');
                if (volSpan && obj) {
                    volSpan.textContent = obj.currentVolume > 0 ? `${obj.currentVolume.toFixed(0)} mL` : 'Empty';
                }
            });
        }

        // Update Spec 20 quick status readout pill
        if (uiElements.specQuickReadoutEl) {
            uiElements.specQuickReadoutEl.textContent = `${state.spec20State.reading} • ${state.spec20State.wavelength} nm`;
        }

        // Update Undo button
        if (uiElements.undoButton) {
            uiElements.undoButton.disabled = state.historyStack.length === 0;
        }

        // Sync 3D scene visuals
        if (typeof sceneSyncCallback === 'function') {
            sceneSyncCallback();
        }
    } catch (error) {
        console.error('Error during updateUI:', error);
        showFeedback('An error occurred updating the interface. Check console.', 'error');
    }
}
