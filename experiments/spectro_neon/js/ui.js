// ui.js - HUD, Scaffolded Mission Prompt, Ambient Feedback, Optical Data Table & Telemetry Sync
import { getState, setStateVariable } from './state.js';
import * as config from './config.js';
import instructions from './instructions.js';
import { getCurrentLinearityR2 } from './graph.js?v=11';

let uiElements = {};
let sceneSyncCallback = null;
let eduSyncCallback = null;
let feedbackEventCallback = null;
let inspectRowCallback = null;
let scaffoldMode = 'guided'; // 'guided' | 'challenge'
let challengePeekStep = -1;
let feedbackFadeTimer = null;

// Real molar mass of FD&C Blue #1 (Brilliant Blue FCF, C37H34N2Na2O9S3)
const BLUE1_MOLAR_MASS = 792.85; // g/mol -> 1 µM = 0.79285 mg/L

export function initUI(
    elements,
    onSceneSync = null,
    onEduSync = null,
    onFeedback = null,
    onInspectRow = null
) {
    uiElements = elements;
    sceneSyncCallback = onSceneSync;
    eduSyncCallback = onEduSync;
    feedbackEventCallback = onFeedback;
    inspectRowCallback = onInspectRow;
}

export function setScaffoldMode(mode) {
    scaffoldMode = mode === 'challenge' ? 'challenge' : 'guided';
    challengePeekStep = -1;
    updateUI();
}

export function getScaffoldMode() {
    return scaffoldMode;
}

export function resetChallengePeek() {
    challengePeekStep = -1;
}

export function isCurrentStepChallengeHidden() {
    const state = getState();
    const totalActionableSteps = instructions.length - 1;
    return (
        scaffoldMode === 'challenge' &&
        state.currentStep < totalActionableSteps &&
        challengePeekStep !== state.currentStep
    );
}

export function peekChallengeStep() {
    challengePeekStep = getState().currentStep;
    updateUI();
}

export function hideFeedbackBanner() {
    if (feedbackFadeTimer) {
        clearTimeout(feedbackFadeTimer);
        feedbackFadeTimer = null;
    }
    if (uiElements.feedbackEl) {
        uiElements.feedbackEl.classList.remove('stage-feedback--visible');
    }
}

function getChallengePhaseGoal(stepIdx) {
    if (stepIdx <= 19) return 'Phase 1 Goal: Prepare all 6 serial dilutions (10/0 → 0/10 Blank, 10 mL each) using dedicated Blue #1 & H₂O pipettes.';
    if (stepIdx <= 27) return 'Phase 2 Goal: Fill the cuvette with Blank (0/10), insert into Spec 20D+, press ZERO, then empty & rinse cuvette.';
    if (stepIdx <= 75) return 'Phase 3 Goal: Measure each standard (10/0 → 0/10) at 630 nm, emptying and rinsing with H₂O between samples.';
    if (stepIdx === 76) return 'Phase 4 Goal: Inspect your linear Beer-Lambert calibration curve and note slope m ≈ 0.1358 Abs/µM.';
    return 'Phase 5 Goal: Use the dedicated Unknown Pipette to fill the clean cuvette, insert into Spec 20D+, and press MEASURE.';
}

function getSolutionSwatchStyle(row) {
    if (row.id === 'unknown') {
        return 'background: linear-gradient(135deg, #7c3aed, #a855f7); box-shadow: 0 0 6px rgba(168,85,247,0.4);';
    }
    if (row.conc === null || row.conc <= 0.001) {
        return 'background: linear-gradient(135deg, rgba(186,230,253,0.45), rgba(224,242,254,0.85));';
    }
    const t = Math.max(0, Math.min(1, row.conc / config.STOCK_CONCENTRATION));
    const r = Math.round(56 - 48 * t);
    const g = Math.round(189 - 142 * t);
    const b = Math.round(248 - 70 * t);
    return `background: rgb(${r}, ${g}, ${b}); box-shadow: 0 0 6px rgba(${r}, ${g}, ${b}, 0.4);`;
}

function getActiveDataRowId(stepConfig) {
    if (!stepConfig) return null;
    if (stepConfig.targetDataRowId) return stepConfig.targetDataRowId;
    if (stepConfig.destination && stepConfig.destination.startsWith('tube_')) return stepConfig.destination;
    if (stepConfig.source && stepConfig.source.startsWith('tube_')) return stepConfig.source;
    if (stepConfig.source === 'unknownBottle' || stepConfig.step >= 77) return 'unknown';
    return null;
}

function enrichPlayfulSafetyMessage(message, type) {
    if (type !== 'error' || !message) return message;
    if (message.includes('Cross-contamination prevented!')) {
        return `Safety Catch: ${message}`;
    }
    if (message.includes('must be rinsed')) {
        return `Carryover Alert: ${message}`;
    }
    return message;
}

export function showFeedback(message, type = 'info') {
    const el = uiElements.feedbackEl;
    const displayMsg = enrichPlayfulSafetyMessage(message, type);

    if (el) {
        el.textContent = displayMsg;
        el.classList.remove('feedback--success', 'feedback--error', 'feedback--info', 'stage-feedback--subtle');

        // Re-trigger shake animation cleanly on repeated errors
        if (type === 'error') {
            el.classList.remove('stage-feedback--visible');
            void el.offsetWidth;
        }

        if (type === 'success') {
            el.classList.add('feedback--success');
        } else if (type === 'error') {
            el.classList.add('feedback--error');
        } else {
            el.classList.add('feedback--info');
        }

        const isWelcomeDefault = displayMsg.startsWith('Welcome!');
        if (displayMsg && !isWelcomeDefault) {
            el.classList.add('stage-feedback--visible');
            if (feedbackFadeTimer) clearTimeout(feedbackFadeTimer);
            const holdMs = type === 'error' ? 5800 : 3400;
            feedbackFadeTimer = setTimeout(() => {
                if (el) {
                    el.classList.remove('stage-feedback--visible');
                }
                feedbackFadeTimer = null;
            }, holdMs);
        } else {
            el.classList.remove('stage-feedback--visible');
        }
    }
    setStateVariable('feedback', { message, type });
    if (typeof feedbackEventCallback === 'function') {
        feedbackEventCallback(message, type);
    }
}

export function updateUI() {
    if (!uiElements.instructionEl) return;

    try {
        const state = getState();
        const stepConfig = instructions[state.currentStep];
        const totalActionableSteps = instructions.length - 1; // 83

        // Instructions & Integrated Progress Rail
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

        const isChallengeHidden =
            scaffoldMode === 'challenge' &&
            state.currentStep < totalActionableSteps &&
            challengePeekStep !== state.currentStep;

        if (stepConfig && stepConfig.action) {
            if (isChallengeHidden) {
                uiElements.instructionEl.innerHTML = `${getChallengePhaseGoal(state.currentStep)} <button type="button" class="button button--ghost button--small" data-peek-step="1" style="margin-left:6px;padding:2px 8px;font-size:11px;">Peek Step</button>`;
                const peekBtn = uiElements.instructionEl.querySelector('[data-peek-step]');
                if (peekBtn) peekBtn.addEventListener('click', peekChallengeStep);
                setStateVariable('highlights', []);
            } else {
                uiElements.instructionEl.innerHTML = stepConfig.text;
                setStateVariable('highlights', stepConfig.highlight ? [...stepConfig.highlight] : []);
            }
        } else if (stepConfig) {
            uiElements.instructionEl.innerHTML = `<strong>${stepConfig.text}</strong>`;
            setStateVariable('highlights', []);
        } else {
            uiElements.instructionEl.innerHTML = '<strong>Experiment Complete! Analysis finished.</strong>';
            setStateVariable('highlights', []);
        }

        // Subtle panel highlights on analysis steps
        const curHighlights = getState().highlights;
        if (uiElements.dataPanelEl) {
            uiElements.dataPanelEl.classList.toggle('panel--highlight', curHighlights.includes('data-panel'));
        }
        if (uiElements.graphPanelEl) {
            uiElements.graphPanelEl.classList.toggle('panel--highlight', curHighlights.includes('graph-panel'));
        }

        // Update Data Table (exact 6 columns & rounding precision + swatches, %T bars & click-to-inspect!)
        const activeRowId = isChallengeHidden ? null : getActiveDataRowId(stepConfig);
        if (uiElements.resultsTbody) {
            uiElements.resultsTbody.innerHTML = '';
            state.dataTableData.forEach((row) => {
                const tr = document.createElement('tr');
                const isMeasured = row.measuredPercentT !== null;
                if (isMeasured) {
                    tr.classList.add('data-table__row--measured', 'data-table__row--inspectable');
                    tr.title = `Click to inspect ${row.solution} inside the 630 nm Quantum Photon Lab`;
                    tr.addEventListener('click', () => {
                        if (typeof inspectRowCallback === 'function') inspectRowCallback(row);
                    });
                }
                if (row.id === 'unknown') tr.classList.add('data-table__row--unknown');
                if (activeRowId && row.id === activeRowId && state.currentStep < totalActionableSteps) {
                    tr.classList.add('data-table__row--active');
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

                const dashHtml = '<span class="data-table__dash">—</span>';
                const pctNum = isMeasured ? Math.max(0, Math.min(100, parseFloat(row.measuredPercentT))) : 0;
                const percentTCellHtml = isMeasured
                    ? `<div class="trans-bar-cell">
                           <span>${row.measuredPercentT}</span>
                           <div class="trans-bar" aria-hidden="true"><div class="trans-bar__fill" style="width:${pctNum}%;"></div></div>
                       </div>`
                    : dashHtml;
                const checkSvg = '<span class="solution-check" title="Measured"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg></span>';

                tr.innerHTML = `
                    <td class="data-table__cell data-table__cell--label">
                        <span class="solution-label">
                            <span class="solution-swatch" style="${getSolutionSwatchStyle(row)}" aria-hidden="true"></span>
                            <span>${row.solution}</span>
                            ${isMeasured ? checkSvg : ''}
                        </span>
                    </td>
                    <td class="data-table__cell">${row.dilution}</td>
                    <td class="data-table__cell data-table__cell--mono">${displayConc === '--' ? dashHtml : displayConc}</td>
                    <td class="data-table__cell data-table__cell--mono">${percentTCellHtml}</td>
                    <td class="data-table__cell data-table__cell--mono">${row.T !== null ? row.T : dashHtml}</td>
                    <td class="data-table__cell data-table__cell--mono">${displayAbs === '--' ? dashHtml : displayAbs}</td>
                `;
                uiElements.resultsTbody.appendChild(tr);
            });
        }

        // Update Slope Display (balanced with live R² linearity pill)
        const measureCompleteStep = instructions.findIndex((instr) => instr.id === 'graph_analysis');
        if (uiElements.slopeDisplayEl) {
            if (measureCompleteStep > -1 && state.currentStep >= measureCompleteStep) {
                const r2 = getCurrentLinearityR2();
                const r2Txt = r2 !== null ? `R² = ${r2.toFixed(4)} — strong Beer-Lambert linearity` : 'Linear Beer-Lambert fit verified';
                uiElements.slopeDisplayEl.innerHTML = `
                    <strong>Calibration Line Slope (Abs/µM) ≈ ${config.KNOWN_SLOPE}</strong>
                    <br><small style="font-weight:500;opacity:0.9;">Molar absorptivity ε ≈ 1.36 × 10⁵ M⁻¹·cm⁻¹ · b = 1.00 cm @ 630 nm</small>
                    <br><span class="slope-verify-tag">Fit Quality: <strong>${r2Txt}</strong></span>
                `;
                uiElements.slopeDisplayEl.hidden = false;
            } else {
                uiElements.slopeDisplayEl.textContent = '';
                uiElements.slopeDisplayEl.hidden = true;
            }
        }

        // Update Unknown Result Display + Real-World Sports Drink Decoder!
        if (uiElements.unknownResultEl) {
            const unknownRow = state.dataTableData.find((r) => r.id === 'unknown');
            if (unknownRow && unknownRow.negLogT !== null && config.KNOWN_SLOPE > 0) {
                if (isFinite(unknownRow.negLogT)) {
                    const measuredAbs = parseFloat(unknownRow.negLogT);
                    const calculatedConc = measuredAbs / config.KNOWN_SLOPE;
                    const mgPerLiter = (calculatedConc * BLUE1_MOLAR_MASS) / 1000;
                    uiElements.unknownResultEl.innerHTML = `
                        <strong>Unknown Drink Conc. ≈ ${calculatedConc.toFixed(3)} µM</strong>
                        <br><small>Calc: c = A / m = ${measuredAbs.toFixed(4)} / ${config.KNOWN_SLOPE}</small>
                        <br><span class="drink-decoder-tag">Real-World Decode: <strong>${mgPerLiter.toFixed(2)} mg/L</strong> FD&amp;C Blue #1 — authentic blue sports-drink range</span>
                    `;
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

        // Update Compact Pipette Chips (inside bottom bench tray)
        if (uiElements.pipetteChips) {
            const activePipId = isChallengeHidden ? null : (stepConfig?.pipette || null);
            Object.entries(uiElements.pipetteChips).forEach(([pid, el]) => {
                if (!el) return;
                const obj = state.labObjects.find((o) => o.id === pid);
                el.classList.toggle('pipette-chip--active', activePipId === pid);
                el.classList.toggle('pipette-chip--selected', state.selectedObjectId === pid);
                const volSpan = el.querySelector('.pipette-chip__vol');
                if (volSpan && obj) {
                    volSpan.textContent = obj.currentVolume > 0 ? `${obj.currentVolume.toFixed(0)} mL` : '0 mL';
                }
                const fillBar = el.querySelector('.pipette-chip__fill');
                if (fillBar && obj) {
                    const fillPct = obj.maxVolume > 0 ? Math.min(100, (obj.currentVolume / obj.maxVolume) * 100) : 0;
                    fillBar.style.width = `${fillPct}%`;
                }
            });
        }

        // Update Spec 20 quick status readout pill & micro-LEDs
        if (uiElements.specQuickReadoutEl) {
            uiElements.specQuickReadoutEl.textContent = `${state.spec20State.reading} • ${state.spec20State.wavelength} nm`;
        }
        if (uiElements.specLedZeroEl) {
            uiElements.specLedZeroEl.classList.toggle('hud-led--on', Boolean(state.spec20State.isZeroed));
        }
        if (uiElements.specLedCuvEl) {
            uiElements.specLedCuvEl.classList.toggle('hud-led--cyan', Boolean(state.spec20State.cuvetteInsideId));
        }

        // Update Undo button
        if (uiElements.undoButton) {
            uiElements.undoButton.disabled = state.historyStack.length === 0;
        }

        // Sync 3D scene visuals
        if (typeof sceneSyncCallback === 'function') {
            sceneSyncCallback();
        }

        // Sync Educational Studio panels
        if (typeof eduSyncCallback === 'function') {
            eduSyncCallback();
        }
    } catch (error) {
        console.error('Error during updateUI:', error);
        showFeedback('An error occurred updating the interface. Check console.', 'error');
    }
}
