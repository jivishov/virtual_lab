// actions.js - Core Chemistry Engine, Validation & Dedicated Pipette Anti-Contamination Rules
import {
    getState,
    setStateVariable,
    saveState,
    findObjectById,
    updateLabObject,
    updateDataTableRow,
    updateSpec20State,
} from './state.js';
import * as config from './config.js';
import instructions from './instructions.js';
import { updateUI, showFeedback } from './ui.js';
import { drawGraph } from './graph.js';

let actionEffectHandler = null;

export function setActionEffectHandler(fn) {
    actionEffectHandler = fn;
}

function emitEffect(type, payload = {}) {
    if (typeof actionEffectHandler === 'function') {
        try {
            actionEffectHandler(type, payload);
        } catch (err) {
            console.warn('3D action effect error:', err);
        }
    }
}

// --- Chemistry Helpers (Exact match to original simulation) ---
export function calculateConcentration(stockVol, waterVol) {
    const totalVol = stockVol + waterVol;
    if (totalVol <= 0) return 0;
    return (Number(config.STOCK_CONCENTRATION) * Number(stockVol)) / Number(totalVol);
}

function getSimulatedPercentT(concentration) {
    if (concentration === -1) return 39.0; // Unknown drink exact %T
    const concPoints = Object.keys(config.TRANSMITTANCE_LOOKUP)
        .map(Number)
        .sort((a, b) => a - b);

    if (concentration <= concPoints[0]) return config.TRANSMITTANCE_LOOKUP[concPoints[0]];
    if (concentration >= concPoints[concPoints.length - 1]) {
        return config.TRANSMITTANCE_LOOKUP[concPoints[concPoints.length - 1]];
    }

    let lowerConc = concPoints[0];
    let upperConc = concPoints[1];
    for (let i = 0; i < concPoints.length - 1; i++) {
        if (concentration >= concPoints[i] && concentration <= concPoints[i + 1]) {
            lowerConc = concPoints[i];
            upperConc = concPoints[i + 1];
            break;
        }
    }
    if (upperConc === lowerConc) return config.TRANSMITTANCE_LOOKUP[lowerConc];
    const lowerT = config.TRANSMITTANCE_LOOKUP[lowerConc];
    const upperT = config.TRANSMITTANCE_LOOKUP[upperConc];
    const ratio = (concentration - lowerConc) / (upperConc - lowerConc);
    return lowerT + (upperT - lowerT) * ratio;
}

// --- Internal Step Processor (Exact match to original simulation) ---
export function checkAndProcessInternalStep() {
    const state = getState();
    if (!instructions || state.currentStep < 0 || state.currentStep >= instructions.length) {
        return;
    }

    let currentStepIndex = state.currentStep;
    let stepConfig = instructions[currentStepIndex];
    let processedInternal = false;

    while (stepConfig && (stepConfig.action === 'info' || stepConfig.action === 'setUnknownFlag')) {
        processedInternal = true;
        saveState();

        let internalActionSuccess = true;
        if (stepConfig.action === 'setUnknownFlag') {
            internalActionSuccess = trySetUnknownFlag(stepConfig.cuvette);
        }

        if (internalActionSuccess) {
            currentStepIndex++;
        } else {
            console.error(`Internal action ${stepConfig.action} failed at step ${currentStepIndex}.`);
            return;
        }

        stepConfig = currentStepIndex < instructions.length ? instructions[currentStepIndex] : null;
    }

    if (processedInternal) {
        setStateVariable('currentStep', currentStepIndex);
        updateUI();
        drawGraph();
    }
}

// --- Action Implementations ---
export function tryZeroSpec() {
    const state = getState();
    const stepConfig = instructions[state.currentStep];
    emitEffect('buttonPress', { button: 'zero' });

    if (!stepConfig?.action || stepConfig.action !== 'zeroSpec') {
        showFeedback(`Incorrect action. ${stepConfig?.hint || 'Follow the current step instructions.'}`, 'error');
        return false;
    }

    const cuvette = state.spec20State.cuvetteInsideId ? findObjectById(state.spec20State.cuvetteInsideId) : null;
    if (!cuvette || Math.abs(cuvette.concentration - 0) > 0.0001) {
        showFeedback('Cannot zero. Insert Blank (0 µM) cuvette first.', 'error');
        return false;
    }

    saveState();
    updateSpec20State('isZeroed', true);
    const units = state.spec20State.absorbanceMode ? ' Abs' : ' %T';
    updateSpec20State('reading', state.spec20State.absorbanceMode ? '0.000' + units : '100.0' + units);
    setStateVariable('currentStep', state.currentStep + 1);
    setStateVariable('selectedObjectId', null);
    showFeedback('Spectrophotometer zeroed at 630 nm (100.0 %T / 0.000 Abs).', 'success');
    emitEffect('zeroSpec', {});
    checkAndProcessInternalStep();
    updateUI();
    return true;
}

export function tryFillPipette(pipetteId, sourceId) {
    const state = getState();
    const stepConfig = instructions[state.currentStep];
    const pipette = findObjectById(pipetteId);
    const source = findObjectById(sourceId);

    if (!pipette || !source) {
        showFeedback('Internal error: Pipette or source not found.', 'error');
        return false;
    }

    // Dedicated pipette anti-contamination check (gives clear chemistry guidance!)
    const requiredForSource = config.getRequiredPipetteForSource(sourceId);
    if (requiredForSource && requiredForSource.id !== pipetteId) {
        showFeedback(
            `Cross-contamination prevented! Use the dedicated ${requiredForSource.label} for ${source.label} (not ${pipette.label}).`,
            'error'
        );
        return false;
    }

    if (
        !stepConfig?.action ||
        stepConfig.action !== 'fillPipette' ||
        stepConfig.pipette !== pipetteId ||
        stepConfig.source !== sourceId
    ) {
        if (stepConfig?.action === 'fillPipette' && stepConfig.pipette !== pipetteId) {
            const expectedPip = findObjectById(stepConfig.pipette);
            showFeedback(
                `Wrong pipette for this step. Use the ${expectedPip?.label || stepConfig.pipette} to avoid cross-contamination.`,
                'error'
            );
        } else {
            showFeedback(`Incorrect action. ${stepConfig?.hint || 'Follow the current step instructions.'}`, 'error');
        }
        return false;
    }

    const targetVolume = stepConfig.volume;
    if (pipette.currentVolume > 0) {
        showFeedback(`${pipette.label} must be empty before filling.`, 'error');
        return false;
    }
    if (source.currentVolume < targetVolume) {
        showFeedback(`Not enough liquid in ${source.label}. Need ${targetVolume}mL.`, 'error');
        return false;
    }

    saveState();
    updateLabObject(pipetteId, 'currentVolume', targetVolume);
    updateLabObject(pipetteId, 'contentsConcentration', source.concentration);
    updateLabObject(sourceId, 'currentVolume', source.currentVolume - targetVolume);
    setStateVariable('currentStep', state.currentStep + 1);
    setStateVariable('selectedObjectId', null);
    showFeedback(`${pipette.label} filled with ${targetVolume} mL from ${source.label}.`, 'success');
    emitEffect('fillPipette', {
        pipetteId,
        sourceId,
        volume: targetVolume,
        concentration: source.concentration,
    });
    checkAndProcessInternalStep();
    updateUI();
    return true;
}

export function tryDispensePipette(pipetteId, destId, volume) {
    const state = getState();
    const stepConfig = instructions[state.currentStep];
    const pipette = findObjectById(pipetteId);
    const dest = findObjectById(destId);

    if (!pipette || !dest) {
        showFeedback('Internal error: Pipette or destination not found.', 'error');
        return false;
    }

    if (
        !stepConfig?.action ||
        stepConfig.action !== 'dispensePipette' ||
        stepConfig.pipette !== pipetteId ||
        stepConfig.destination !== destId
    ) {
        showFeedback(`Incorrect action. ${stepConfig?.hint || 'Follow the current step instructions.'}`, 'error');
        return false;
    }

    if (stepConfig.volume && Math.abs(volume - stepConfig.volume) > 0.01) {
        showFeedback(`Incorrect volume dispensed. Expected ${stepConfig.volume} mL.`, 'error');
        return false;
    }
    if (pipette.currentVolume < volume - 0.001) {
        showFeedback(`Not enough liquid in ${pipette.label}.`, 'error');
        return false;
    }
    if (dest.currentVolume + volume > dest.maxVolume + 0.001) {
        showFeedback(`${dest.label} will overflow.`, 'error');
        return false;
    }

    saveState();
    const initialDestVol = dest.currentVolume;
    const initialDestConc = dest.concentration;
    const addedVol = volume;
    const addedConc = pipette.contentsConcentration;
    const finalVol = initialDestVol + addedVol;

    let finalConc = 0;
    if (finalVol > 0.001) {
        if (initialDestConc === null || initialDestConc === undefined || initialDestVol < 0.001) {
            finalConc = addedConc;
        } else if (addedConc === null || addedConc === undefined) {
            finalConc = initialDestConc;
        } else if (dest.type === 'cuvette' && initialDestConc === 0 && addedConc === 0) {
            finalConc = 0;
        } else {
            finalConc = (initialDestConc * initialDestVol + addedConc * addedVol) / finalVol;
        }
    }

    updateLabObject(destId, 'currentVolume', finalVol);
    updateLabObject(destId, 'concentration', finalConc);
    updateLabObject(pipetteId, 'currentVolume', pipette.currentVolume - addedVol);

    const updatedPipette = findObjectById(pipetteId);
    if (updatedPipette.currentVolume < 0.001) {
        updateLabObject(pipetteId, 'currentVolume', 0);
        updateLabObject(pipetteId, 'contentsConcentration', 0);
    }

    setStateVariable('currentStep', state.currentStep + 1);
    setStateVariable('selectedObjectId', null);
    showFeedback(`Dispensed ${volume.toFixed(1)} mL from ${pipette.label} into ${dest.label}.`, 'success');
    emitEffect('dispensePipette', {
        pipetteId,
        destId,
        volume: addedVol,
        concentration: addedConc,
    });
    checkAndProcessInternalStep();
    updateUI();
    return true;
}

export function tryRemoveCuvetteFromSpec(cuvetteId) {
    const state = getState();
    const cuvette = findObjectById(cuvetteId);
    if (!cuvette || !cuvette.isInSpec) return false;

    saveState();
    updateLabObject(cuvetteId, 'isInSpec', false);
    updateSpec20State('cuvetteInsideId', null);
    updateSpec20State('reading', state.spec20State.absorbanceMode ? '-- Abs' : '-- %T');
    emitEffect('removeCuvette', { cuvetteId });
    return true;
}

export function tryEmptyCuvette(cuvetteId, wasteId, autoExtractFromSpec = false) {
    const state = getState();
    const stepConfig = instructions[state.currentStep];
    if (wasteId !== 'wasteBeaker') {
        showFeedback('Can only empty into Waste Beaker.', 'error');
        return false;
    }

    const cuvette = findObjectById(cuvetteId);
    const waste = findObjectById(wasteId);
    if (!cuvette || !waste) {
        showFeedback('Internal error: Cuvette or Waste not found.', 'error');
        return false;
    }

    if (cuvette.isInSpec && !autoExtractFromSpec) {
        showFeedback('Cannot empty cuvette while inside the Spectrophotometer. Drag it out first.', 'error');
        return false;
    }
    if (cuvette.currentVolume <= 0) {
        showFeedback('Cuvette is already empty.', 'info');
        return false;
    }

    let stepCompleted = false;
    if (stepConfig?.action === 'emptyCuvette' && stepConfig.cuvette === cuvetteId && stepConfig.destination === wasteId) {
        stepCompleted = true;
    }

    const pouredConc = cuvette.concentration;
    const pouredVol = cuvette.currentVolume;

    saveState();
    if (cuvette.isInSpec) {
        updateLabObject(cuvetteId, 'isInSpec', false);
        updateSpec20State('cuvetteInsideId', null);
        updateSpec20State('reading', state.spec20State.absorbanceMode ? '-- Abs' : '-- %T');
    }

    updateLabObject(wasteId, 'currentVolume', Math.min(waste.maxVolume, waste.currentVolume + pouredVol));
    updateLabObject(cuvetteId, 'currentVolume', 0);
    updateLabObject(cuvetteId, 'concentration', 0);

    if (stepCompleted && stepConfig?.markClean === true) {
        updateLabObject(cuvetteId, 'isClean', true);
    } else {
        updateLabObject(cuvetteId, 'isClean', false);
    }

    setStateVariable('selectedObjectId', null);
    const isCleanNow = findObjectById(cuvetteId).isClean;

    if (stepCompleted) {
        setStateVariable('currentStep', state.currentStep + 1);
        showFeedback(`Cuvette emptied into Waste. ${isCleanNow ? 'Cuvette is now clean!' : 'Rinse required before next sample.'}`, 'success');
        emitEffect('emptyCuvette', { cuvetteId, wasteId, concentration: pouredConc, volume: pouredVol });
        checkAndProcessInternalStep();
    } else {
        showFeedback(`Cuvette emptied into Waste. ${isCleanNow ? 'It is now clean.' : ''}`, 'success');
        emitEffect('emptyCuvette', { cuvetteId, wasteId, concentration: pouredConc, volume: pouredVol });
    }
    updateUI();
    return true;
}

export function tryInsertCuvette(cuvetteId, specId) {
    const state = getState();
    const stepConfig = instructions[state.currentStep];
    if (
        !stepConfig?.action ||
        stepConfig.action !== 'insertCuvette' ||
        stepConfig.cuvette !== cuvetteId ||
        stepConfig.destination !== specId
    ) {
        showFeedback(`Incorrect action. ${stepConfig?.hint || 'Follow the current step instructions.'}`, 'error');
        return false;
    }

    const cuvette = findObjectById(cuvetteId);
    const spec = findObjectById(specId);
    if (!cuvette || !spec) {
        showFeedback('Internal error: Cuvette or Spectrophotometer not found.', 'error');
        return false;
    }
    if (state.spec20State.cuvetteInsideId) {
        showFeedback('Spectrophotometer already contains a cuvette.', 'error');
        return false;
    }
    if (cuvette.isInSpec) {
        showFeedback('Cuvette is already in the Spectrophotometer.', 'error');
        return false;
    }
    if (cuvette.currentVolume <= 0 && !stepConfig.allowEmpty) {
        showFeedback('Cannot insert an empty cuvette at this step.', 'error');
        return false;
    }
    if (!cuvette.isClean && !stepConfig.allowDirtyInsert) {
        showFeedback('Cuvette must be rinsed before adding a new sample.', 'error');
        return false;
    }

    saveState();
    updateLabObject(cuvetteId, 'isInSpec', true);
    updateSpec20State('cuvetteInsideId', cuvetteId);
    updateSpec20State('reading', state.spec20State.absorbanceMode ? '-- Abs' : '-- %T');
    setStateVariable('currentStep', state.currentStep + 1);
    setStateVariable('selectedObjectId', null);
    showFeedback('Cuvette inserted into Spectronic 20D+ sample chamber.', 'success');
    emitEffect('insertCuvette', { cuvetteId, specId });
    checkAndProcessInternalStep();
    updateUI();
    return true;
}

export function tryMeasure() {
    const state = getState();
    const stepConfig = instructions[state.currentStep];
    emitEffect('buttonPress', { button: 'measure' });

    if (!stepConfig?.action || stepConfig.action !== 'measure') {
        showFeedback(`Incorrect action. ${stepConfig?.hint || 'Follow the current step instructions.'}`, 'error');
        return false;
    }
    if (!state.spec20State.cuvetteInsideId) {
        showFeedback('Cannot measure. No cuvette in Spectrophotometer.', 'error');
        return false;
    }
    if (!state.spec20State.isZeroed) {
        showFeedback('Cannot measure. Spectrophotometer must be zeroed first.', 'error');
        return false;
    }

    const cuvette = findObjectById(state.spec20State.cuvetteInsideId);
    if (!cuvette) {
        showFeedback('Internal error: Cuvette not found.', 'error');
        return false;
    }
    if (Math.abs(cuvette.concentration - 0) < 0.0001 && !stepConfig.allowBlankMeasure) {
        showFeedback('Cannot measure the blank again at this step.', 'error');
        return false;
    }

    const concentration = cuvette.concentration;
    const percentT = getSimulatedPercentT(concentration);
    let absorbance = -Math.log10(percentT / 100);
    if (isNaN(absorbance) || !isFinite(absorbance)) absorbance = Infinity;

    if (absorbance > config.MAX_ABS) {
        updateSpec20State('reading', state.spec20State.absorbanceMode ? `>${config.MAX_ABS.toFixed(1)} Abs` : '0.0 %T');
        showFeedback(`Absorbance too high (> ${config.MAX_ABS.toFixed(1)}) to measure accurately.`, 'error');
        updateUI();
        return false;
    }

    saveState();
    if (state.spec20State.absorbanceMode) {
        updateSpec20State('reading', absorbance === Infinity || absorbance > 10 ? '>10 Abs' : absorbance.toFixed(3) + ' Abs');
    } else {
        updateSpec20State('reading', percentT.toFixed(1) + ' %T');
    }

    const dataRowId = stepConfig.targetDataRowId || 'unknown';
    updateDataTableRow(dataRowId, 'measuredPercentT', percentT.toFixed(1));
    updateDataTableRow(dataRowId, 'T', (percentT / 100).toFixed(3));
    updateDataTableRow(
        dataRowId,
        'negLogT',
        absorbance === Infinity || absorbance > 10 ? Infinity : parseFloat(absorbance.toFixed(4))
    );

    setStateVariable('currentStep', state.currentStep + 1);
    setStateVariable('selectedObjectId', null);
    showFeedback(`Measurement complete: ${getState().spec20State.reading}.`, 'success');
    emitEffect('measure', { percentT, absorbance, dataRowId });
    checkAndProcessInternalStep();
    updateUI();
    drawGraph();
    return true;
}

export function tryToggleMode() {
    const state = getState();
    emitEffect('buttonPress', { button: 'mode' });

    const newMode = !state.spec20State.absorbanceMode;
    updateSpec20State('absorbanceMode', newMode);
    const currentReading = state.spec20State.reading;

    if (
        state.spec20State.cuvetteInsideId &&
        currentReading !== '-- %T' &&
        currentReading !== '-- Abs' &&
        !currentReading.startsWith('>')
    ) {
        const currentValue = parseFloat(currentReading.split(' ')[0]);
        if (!newMode) {
            const percentT = Math.pow(10, -currentValue) * 100;
            updateSpec20State('reading', percentT.toFixed(1) + ' %T');
        } else {
            let absorbance = -Math.log10(currentValue / 100);
            if (isNaN(absorbance) || !isFinite(absorbance)) absorbance = Infinity;
            updateSpec20State('reading', absorbance === Infinity || absorbance > 10 ? '>10 Abs' : absorbance.toFixed(3) + ' Abs');
        }
    } else if (
        state.spec20State.isZeroed &&
        state.spec20State.cuvetteInsideId &&
        findObjectById(state.spec20State.cuvetteInsideId)?.concentration === 0
    ) {
        updateSpec20State('reading', newMode ? '0.000 Abs' : '100.0 %T');
    } else if (currentReading.startsWith('>')) {
        updateSpec20State('reading', newMode ? `>${config.MAX_ABS.toFixed(1)} Abs` : '0.0 %T');
    } else {
        updateSpec20State('reading', newMode ? '-- Abs' : '-- %T');
    }

    showFeedback(`Display mode switched to ${newMode ? 'Absorbance (Abs)' : '% Transmittance (%T)'}.`, 'info');
    updateUI();
}

export function trySetUnknownFlag(cuvetteId) {
    const cuvette = findObjectById(cuvetteId);
    if (!cuvette) {
        console.error('Internal error: Cuvette not found for unknown flag step.');
        showFeedback('Internal simulation error setting unknown flag.', 'error');
        return false;
    }
    updateLabObject(cuvetteId, 'concentration', -1);
    return true;
}
