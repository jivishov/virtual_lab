// actions.js - Action validation and execution

import {
    getState, setStateVariable, saveState, findObjectById, findObjectsByType,
    updateLabObject, updateBalanceState, updateSpecState,
    updateNotebookData, addMeasurement, updatePipetteRegistry,
    updateCuvetteRegistry, updateEquipmentCount, getEquipmentCount,
    addLabObject, removeLabObject, generateId, getNextPipetteSerial, getNextCuvetteSerial
} from './state.js';
import instructions, { getStepConfig } from './instructions.js';
import * as config from './config.js';
import { showFeedback, updateUI } from './ui.js';
import { getContentColor, getContentLabel } from './graphics.js';
import { t } from './i18n/i18n.js';

// =============================================
// VALIDATION HELPERS
// =============================================

function validateStep(expectedAction) {
    const state = getState();
    const stepConfig = getStepConfig(state.currentStep);

    if (!stepConfig) {
        showFeedback(t('messages.labComplete'), 'info');
        return null;
    }

    if (stepConfig.action !== expectedAction) {
        showFeedback(t('messages.invalidInteraction'), 'error');
        return null;
    }

    return stepConfig;
}

function advanceStep() {
    const state = getState();
    setStateVariable('currentStep', state.currentStep + 1);
}

// =============================================
// EQUIPMENT PLACEMENT
// =============================================

export function tryPlaceEquipment(equipmentType, x, y) {
    const stepConfig = validateStep('placeEquipment');
    if (!stepConfig) return false;

    // Validate correct equipment type
    if (stepConfig.equipment !== equipmentType) {
        showFeedback(t('messages.wrongEquipment', { expected: t(`equipment.${stepConfig.equipment}`) }), 'error');
        return false;
    }

    // Check singleton limit
    if (config.SINGLETONS.includes(equipmentType)) {
        if (getEquipmentCount(equipmentType) >= 1) {
            showFeedback(t('messages.alreadyPlaced'), 'error');
            return false;
        }
    }

    // Execute placement
    saveState();
    updateEquipmentCount(equipmentType, 1);

    // Create the object
    const id = generateId(equipmentType);
    const obj = createLabObject(equipmentType, id, x, y, stepConfig);
    addLabObject(obj);

    // Special handling for pipette assignment
    if (equipmentType === 'pipette' && stepConfig.assignAs) {
        updatePipetteRegistry(id, stepConfig.assignAs);
    }

    advanceStep();
    showFeedback(t('messages.equipmentPlaced', { equipment: t(`equipment.${equipmentType}`) }), 'success');
    updateUI();
    return true;
}

function createLabObject(type, id, x, y, stepConfig) {
    const baseObj = {
        id,
        type,
        x,
        y,
        props: {}
    };

    switch (type) {
        case 'balance':
            baseObj.props = { reading: '0.000' };
            break;
        case 'brass':
            baseObj.props = { weighed: false };
            break;
        case 'beaker':
            baseObj.props = { vol: 0, color: 'transparent', hasBrass: false, reacting: false, content: null };
            break;
        case 'flask':
            baseObj.props = { vol: 0, color: 'transparent', content: null, molarity: null };
            break;
        case 'pipette':
            baseObj.props = {
                vol: 0,
                color: 'transparent',
                content: null,
                serial: getNextPipetteSerial(),
                assignedTo: stepConfig?.assignAs || null
            };
            break;
        case 'acid':
        case 'water':
        case 'std1':
        case 'std2':
        case 'std4':
            baseObj.type = 'bottle';
            baseObj.props = {
                sourceType: type,
                label: getBottleLabel(type),
                color: getBottleColor(type)
            };
            break;
        case 'spec':
            baseObj.props = {};
            break;
        case 'rack':
            baseObj.props = {};
            break;
        case 'waste':
            baseObj.props = { vol: 10, disposedPipettes: [] };
            break;
        case 'cuvette':
            baseObj.props = {
                vol: 0,
                color: 'transparent',
                content: null,
                serial: getNextCuvetteSerial(),
                assignedTo: stepConfig?.assignAs || null
            };
            break;
    }

    return baseObj;
}

function getBottleLabel(type) {
    const labels = {
        acid: 'HNO₃',
        water: 'H₂O',
        std1: '0.1M',
        std2: '0.2M',
        std4: '0.4M'
    };
    return labels[type] || type;
}

function getBottleColor(type) {
    const colors = {
        acid: config.COLORS.acid,
        water: config.COLORS.water,
        std1: config.COLORS.standard,
        std2: config.COLORS.standard,
        std4: config.COLORS.standard
    };
    return colors[type] || config.COLORS.water;
}

// =============================================
// WEIGHING
// =============================================

export function tryWeighBrass(brassId, balanceId) {
    const stepConfig = validateStep('weighBrass');
    if (!stepConfig) return false;

    const brass = findObjectById(brassId);
    const balance = findObjectById(balanceId);

    if (!brass || brass.type !== 'brass') {
        showFeedback(t('messages.dragBrassToBalance'), 'error');
        return false;
    }

    if (!balance || balance.type !== 'balance') {
        showFeedback(t('messages.dropOnBalance'), 'error');
        return false;
    }

    saveState();

    // Update balance reading
    const state = getState();
    const mass = state.notebookData.brassMass;
    updateLabObject(balanceId, 'props.reading', mass.toFixed(3));
    updateLabObject(brassId, 'props.weighed', true);
    updateBalanceState('reading', mass.toFixed(3));
    updateBalanceState('hasBrass', true);

    // Position brass on the balance pan (center of the pan)
    updateLabObject(brassId, 'x', balance.x + 55);  // Center on pan
    updateLabObject(brassId, 'y', balance.y - 5);   // On top of pan

    advanceStep();
    showFeedback(t('messages.brassMassRecorded', { mass: mass.toFixed(3) }), 'success');
    updateUI();
    return true;
}

// =============================================
// BRASS TRANSFER
// =============================================

export function tryTransferBrass(brassId, beakerId) {
    const stepConfig = validateStep('transferBrass');
    if (!stepConfig) return false;

    const brass = findObjectById(brassId);
    const beaker = findObjectById(beakerId);

    if (!brass || brass.type !== 'brass') {
        showFeedback(t('messages.dragBrassSample'), 'error');
        return false;
    }

    if (!beaker || beaker.type !== 'beaker') {
        showFeedback(t('messages.dropIntoBeaker'), 'error');
        return false;
    }

    if (!brass.props.weighed) {
        showFeedback(t('messages.weighFirst'), 'error');
        return false;
    }

    saveState();

    updateLabObject(beakerId, 'props.hasBrass', true);
    // Hide brass (it's now in beaker)
    updateLabObject(brassId, 'props.inBeaker', true);
    updateBalanceState('hasBrass', false);
    updateBalanceState('reading', '0.000');

    advanceStep();
    showFeedback(t('messages.brassTransferred'), 'success');
    updateUI();
    return true;
}

// =============================================
// PIPETTE OPERATIONS
// =============================================

export function tryFillPipette(pipetteId, sourceObjId) {
    const stepConfig = validateStep('fillPipette');
    if (!stepConfig) return false;

    const pipette = findObjectById(pipetteId);
    const source = findObjectById(sourceObjId);

    if (!pipette || pipette.type !== 'pipette') {
        showFeedback(t('messages.usePipetteToFill'), 'error');
        return false;
    }

    if (!source) {
        showFeedback(t('messages.sourceNotFound'), 'error');
        return false;
    }

    // Check pipette is empty
    if (pipette.props.vol > 0) {
        showFeedback(t('messages.pipetteAlreadyFull'), 'error');
        return false;
    }

    // Determine source type from object
    let sourceType;
    if (source.type === 'bottle') {
        sourceType = source.props.sourceType;
    } else if (source.type === 'beaker' && source.props.content === 'copper') {
        sourceType = 'copper';
    } else if (source.type === 'beaker') {
        sourceType = 'beaker';
    } else if (source.type === 'flask' && source.props.content) {
        // Flask with diluted unknown solution
        sourceType = 'unknown';
    } else if (source.type === 'flask') {
        sourceType = 'flask';
    } else {
        sourceType = source.type;
    }

    // Validate correct source for this step
    const expectedSource = stepConfig.source;

    // Check if source matches expectation
    if (expectedSource === 'beaker' && source.type !== 'beaker') {
        showFeedback(t('messages.fillFromBeaker'), 'error');
        return false;
    }
    if (expectedSource === 'flask' && source.type !== 'flask') {
        showFeedback(t('messages.fillFromFlask'), 'error');
        return false;
    }
    if (expectedSource !== 'beaker' && expectedSource !== 'flask' && source.type === 'bottle' && source.props.sourceType !== expectedSource) {
        showFeedback(t('messages.usePipetteToFill'), 'error');
        return false;
    }

    // Check cross-contamination with pipette assignment
    const assigned = pipette.props.assignedTo;
    if (assigned) {
        const validSources = {
            'acid': ['acid'],
            'copper': ['copper', 'beaker', 'unknown'],
            'water': ['water', 'std1', 'std2', 'std4']  // Water pipette can also handle standards (aqueous solutions)
        };

        if (validSources[assigned] && !validSources[assigned].includes(sourceType)) {
            showFeedback(t('messages.usePipetteToFill'), 'error');
            return false;
        }
    }

    // If pipette has no assignment, allow any source (for standards, unknown, etc.)
    // This allows using any available pipette for standard solutions

    saveState();

    // Fill pipette
    const color = source.props?.color || getContentColor(sourceType);
    updateLabObject(pipetteId, 'props.vol', 1);
    updateLabObject(pipetteId, 'props.color', color);
    updateLabObject(pipetteId, 'props.content', sourceType);

    advanceStep();
    showFeedback(t('messages.solutionTransferred'), 'success');
    updateUI();
    return true;
}

export function tryDispensePipette(pipetteId, destId) {
    const stepConfig = validateStep('dispensePipette');
    if (!stepConfig) return false;

    const pipette = findObjectById(pipetteId);
    const dest = findObjectById(destId);

    if (!pipette || pipette.type !== 'pipette') {
        showFeedback(t('messages.usePipetteToDispense'), 'error');
        return false;
    }

    if (pipette.props.vol <= 0) {
        showFeedback(t('messages.pipetteEmpty'), 'error');
        return false;
    }

    if (!dest) {
        showFeedback(t('messages.destNotFound'), 'error');
        return false;
    }

    // Validate destination
    const expectedDest = stepConfig.destination;
    if (dest.type !== expectedDest) {
        showFeedback(t('messages.destNotFound'), 'error');
        return false;
    }

    saveState();

    // Update destination
    const content = pipette.props.content;
    const color = pipette.props.color;

    if (dest.type === 'beaker') {
        updateLabObject(destId, 'props.vol', (dest.props.vol || 0) + 20);
        updateLabObject(destId, 'props.color', color);
        updateLabObject(destId, 'props.content', content);

        // Trigger reaction if acid added to beaker with brass
        if (stepConfig.triggerReaction && dest.props.hasBrass && content === 'acid') {
            updateLabObject(destId, 'props.reacting', true);
            // Start dissolution timer immediately (runs in background)
            startDissolutionTimer(destId);
        }
    } else if (dest.type === 'flask') {
        const currentVol = dest.props.vol || 0;
        if (content === 'copper') {
            updateLabObject(destId, 'props.vol', currentVol + 20);
            updateLabObject(destId, 'props.color', color);
            updateLabObject(destId, 'props.content', 'copper');
        } else if (content === 'water') {
            // Diluting to volume
            updateLabObject(destId, 'props.vol', 65); // Visual fill to mark
            updateLabObject(destId, 'props.color', config.COLORS.copperLight);
            updateLabObject(destId, 'props.content', 'unknown');

            // Calculate molarity
            const state = getState();
            const brassMass = state.notebookData.brassMass;
            const molarity = (brassMass * config.BRASS_CU_PERCENT) / config.MOLAR_MASS_CU / config.FLASK_VOLUME;
            updateLabObject(destId, 'props.molarity', molarity);
        }
    }

    // Empty pipette
    updateLabObject(pipetteId, 'props.vol', 0);
    updateLabObject(pipetteId, 'props.color', 'transparent');
    updateLabObject(pipetteId, 'props.content', null);

    advanceStep();
    showFeedback(t('messages.solutionTransferred'), 'success');
    updateUI();

    return true;
}

// =============================================
// PIPETTE DISPOSAL
// =============================================

export function tryDisposePipette(pipetteId, wasteId) {
    const stepConfig = validateStep('disposePipette');
    if (!stepConfig) return false;

    const pipette = findObjectById(pipetteId);
    const waste = findObjectById(wasteId);

    if (!pipette || pipette.type !== 'pipette') {
        showFeedback(t('messages.selectPipetteToDispose'), 'error');
        return false;
    }

    if (!waste || waste.type !== 'waste') {
        showFeedback(t('messages.dropPipetteInWaste'), 'error');
        return false;
    }

    // Check if this is the correct pipette (by assignment)
    if (stepConfig.pipetteAssignment) {
        if (pipette.props.assignedTo !== stepConfig.pipetteAssignment) {
            showFeedback(t('messages.selectPipetteToDispose'), 'error');
            return false;
        }
    }

    saveState();

    // Store pipette info in waste beaker
    const pipetteInfo = {
        serial: pipette.props.serial,
        assignment: pipette.props.assignedTo,
        color: pipette.props.color || 'transparent'
    };

    // Get current disposedPipettes array and add this one
    const disposedPipettes = [...(waste.props.disposedPipettes || []), pipetteInfo];
    updateLabObject(wasteId, 'props.disposedPipettes', disposedPipettes);

    // Remove pipette from workbench
    removeLabObject(pipetteId);

    // Update pipette count
    updateEquipmentCount('pipette', -1);

    advanceStep();
    showFeedback(t('messages.pipetteDisposed'), 'success');
    updateUI();

    // Check if next step is waitReaction and auto-trigger it
    checkAutoTriggerReaction();

    return true;
}

// =============================================
// REACTION
// =============================================

// Start dissolution timer - runs independently of step progression
function startDissolutionTimer(beakerId) {
    setTimeout(() => {
        const beaker = findObjectById(beakerId);
        if (!beaker || !beaker.props.reacting) return;

        updateLabObject(beakerId, 'props.reacting', false);
        updateLabObject(beakerId, 'props.hasBrass', false);
        updateLabObject(beakerId, 'props.color', config.COLORS.copper);
        updateLabObject(beakerId, 'props.content', 'copper');
        updateNotebookData('condition', 'Dissolved');

        showFeedback(t('messages.brassDissolvedReady'), 'success');
        updateUI();

        // If user is on waitReaction step, advance it
        const state = getState();
        const stepConfig = getStepConfig(state.currentStep);
        if (stepConfig?.action === 'waitReaction') {
            setStateVariable('currentStep', state.currentStep + 1);
            updateUI();
        }
    }, 1000);
}

export function tryWaitReaction() {
    const state = getState();
    const stepConfig = getStepConfig(state.currentStep);

    if (stepConfig?.action !== 'waitReaction') {
        return false;
    }

    const beaker = state.labObjects.find(o => o.type === 'beaker');

    // If already dissolved, just advance
    if (beaker && !beaker.props.reacting && beaker.props.content === 'copper') {
        setStateVariable('currentStep', state.currentStep + 1);
        updateUI();
        return true;
    }

    // If still reacting, wait (timer will advance when done)
    if (beaker && beaker.props.reacting) {
        showFeedback(t('messages.reactionInProgress'), 'info');
        return true;
    }

    showFeedback(t('messages.addAcidFirst'), 'error');
    return false;
}

// Check if we should auto-trigger the waitReaction step
export function checkAutoTriggerReaction() {
    const state = getState();
    const stepConfig = getStepConfig(state.currentStep);

    if (stepConfig?.action === 'waitReaction') {
        const beaker = state.labObjects.find(o => o.type === 'beaker');
        if (beaker && (beaker.props.reacting || beaker.props.content === 'copper')) {
            // Auto-trigger the reaction after a short delay (handles both in-progress and already-dissolved cases)
            setTimeout(() => tryWaitReaction(), 300);
        }
    }
}

// =============================================
// CUVETTE OPERATIONS
// =============================================

export function tryGetCuvette(rackId) {
    const stepConfig = validateStep('getCuvette');
    if (!stepConfig) return false;

    const rack = findObjectById(rackId);
    if (!rack || rack.type !== 'rack') {
        showFeedback(t('messages.clickCuvetteRack'), 'error');
        return false;
    }

    saveState();

    // Create new cuvette
    const cuvetteId = `cuvette_${stepConfig.assignAs}`;
    const cuvette = {
        id: cuvetteId,
        type: 'cuvette',
        x: rack.x + 50,
        y: rack.y + 60,
        props: {
            vol: 0,
            color: 'transparent',
            content: null,
            serial: getNextCuvetteSerial(),
            assignedTo: stepConfig.assignAs
        }
    };

    addLabObject(cuvette);
    updateCuvetteRegistry(cuvetteId, stepConfig.assignAs);

    advanceStep();
    showFeedback(t('messages.cuvetteReady', { type: stepConfig.assignAs }), 'success');
    updateUI();
    return true;
}

export function tryDispenseToCuvette(pipetteId, cuvetteId) {
    const stepConfig = validateStep('dispenseToCuvette');
    if (!stepConfig) return false;

    const pipette = findObjectById(pipetteId);
    const cuvette = findObjectById(cuvetteId);

    // Validate pipette has liquid
    if (!pipette || pipette.type !== 'pipette') {
        showFeedback(t('messages.usePipetteForCuvette'), 'error');
        return false;
    }

    if (pipette.props.vol <= 0) {
        showFeedback(t('messages.fillPipetteFirst'), 'error');
        return false;
    }

    // Validate cuvette
    if (!cuvette || cuvette.type !== 'cuvette') {
        showFeedback(t('messages.dispenseToCuvette'), 'error');
        return false;
    }

    // Validate correct cuvette for this step
    if (cuvette.props.assignedTo !== stepConfig.cuvetteType) {
        showFeedback(t('messages.dispenseToCuvette'), 'error');
        return false;
    }

    // Validate cuvette is empty
    if (cuvette.props.vol > 0) {
        showFeedback(t('messages.cuvetteAlreadyFilled'), 'error');
        return false;
    }

    saveState();

    // Determine cuvette content based on pipette content
    let content;
    const pipetteContent = pipette.props.content;
    if (pipetteContent === 'water') {
        content = 'blank';
    } else if (pipetteContent === 'unknown') {
        content = 'unknown';
    } else {
        content = stepConfig.cuvetteType;  // std_0.1, std_0.2, std_0.4
    }

    // Transfer from pipette to cuvette
    updateLabObject(cuvetteId, 'props.vol', 40);
    updateLabObject(cuvetteId, 'props.color', pipette.props.color);
    updateLabObject(cuvetteId, 'props.content', content);

    // Empty pipette
    updateLabObject(pipetteId, 'props.vol', 0);
    updateLabObject(pipetteId, 'props.color', 'transparent');
    updateLabObject(pipetteId, 'props.content', null);

    advanceStep();
    showFeedback(t('messages.cuvetteFilled'), 'success');
    updateUI();
    return true;
}

// =============================================
// SPECTROPHOTOMETER OPERATIONS
// =============================================

export function tryToggleLid() {
    const stepConfig = validateStep('toggleLid');
    if (!stepConfig) return false;

    const state = getState();
    const currentOpen = state.specState.open;
    const targetOpen = stepConfig.targetState === 'open';

    if (currentOpen === targetOpen) {
        showFeedback(t('messages.lidAlready', { state: targetOpen ? 'open' : 'closed' }), 'info');
        return false;
    }

    saveState();

    updateSpecState('open', targetOpen);

    // If closing lid after inserting cuvette, this might be part of calibrate step
    // Don't advance here - let calibrate handle it

    advanceStep();
    showFeedback(t('messages.lidToggled', { state: targetOpen ? 'opened' : 'closed' }), 'success');
    updateUI();
    return true;
}

export function tryInsertCuvette(cuvetteId) {
    const stepConfig = validateStep('insertCuvette');
    if (!stepConfig) return false;

    const state = getState();

    if (!state.specState.open) {
        showFeedback(t('messages.openLidFirst'), 'error');
        return false;
    }

    if (state.specState.hasCuvette) {
        showFeedback(t('messages.removeCuvetteFirst'), 'error');
        return false;
    }

    const cuvette = findObjectById(cuvetteId);
    if (!cuvette || cuvette.type !== 'cuvette') {
        showFeedback(t('messages.dragCuvetteToSpec'), 'error');
        return false;
    }

    if (cuvette.props.vol <= 0) {
        showFeedback(t('messages.fillCuvetteFirst'), 'error');
        return false;
    }

    // Validate correct cuvette for this step
    if (cuvette.props.assignedTo !== stepConfig.cuvetteType) {
        showFeedback(t('messages.dragCuvetteToSpec'), 'error');
        return false;
    }

    saveState();

    updateSpecState('hasCuvette', true);
    updateSpecState('cuvetteId', cuvetteId);
    updateSpecState('reading', '---');

    // Hide cuvette (it's in spec now)
    updateLabObject(cuvetteId, 'props.inSpec', true);

    advanceStep();
    showFeedback(t('messages.cuvetteInserted'), 'success');
    updateUI();
    return true;
}

export function tryRemoveCuvette() {
    const stepConfig = validateStep('removeCuvette');
    if (!stepConfig) return false;

    const state = getState();

    if (!state.specState.open) {
        // Auto-open lid for removal
        updateSpecState('open', true);
    }

    if (!state.specState.hasCuvette) {
        showFeedback(t('messages.noCuvetteToRemove'), 'info');
        return false;
    }

    saveState();

    const cuvetteId = state.specState.cuvetteId;
    if (cuvetteId) {
        updateLabObject(cuvetteId, 'props.inSpec', false);
    }

    updateSpecState('hasCuvette', false);
    updateSpecState('cuvetteId', null);
    updateSpecState('reading', '---');
    updateSpecState('open', true);

    advanceStep();
    showFeedback(t('messages.cuvetteRemoved'), 'success');
    updateUI();
    return true;
}

export function tryCalibrateSpec() {
    const stepConfig = validateStep('calibrateSpec');
    if (!stepConfig) return false;

    const state = getState();

    if (!state.specState.hasCuvette) {
        showFeedback(t('messages.insertBlankFirst'), 'error');
        return false;
    }

    const cuvetteId = state.specState.cuvetteId;
    const cuvette = findObjectById(cuvetteId);

    if (!cuvette || cuvette.props.content !== 'blank') {
        showFeedback(t('messages.useBlankToCalibrate'), 'error');
        return false;
    }

    saveState();

    // Close lid if open
    updateSpecState('open', false);
    updateSpecState('isCalibrated', true);
    updateSpecState('reading', '0.000');

    advanceStep();
    showFeedback(t('messages.specCalibrated'), 'success');
    updateUI();
    return true;
}

export function tryMeasure() {
    const stepConfig = validateStep('measure');
    if (!stepConfig) return false;

    const state = getState();

    if (!state.specState.isCalibrated) {
        showFeedback(t('messages.calibrateFirst'), 'error');
        return false;
    }

    if (!state.specState.hasCuvette) {
        showFeedback(t('messages.insertCuvetteFirst'), 'error');
        return false;
    }

    saveState();

    // Auto-close lid if open (user clicked lid to measure)
    if (state.specState.open) {
        updateSpecState('open', false);
    }

    // Calculate absorbance
    let absorbance;
    if (stepConfig.concentration === -1) {
        // Unknown - calculate from brass molarity
        const flask = state.labObjects.find(o => o.type === 'flask');
        const molarity = flask?.props?.molarity || 0.14;
        absorbance = config.getSimulatedAbsorbance(molarity);
    } else {
        absorbance = config.getSimulatedAbsorbance(stepConfig.concentration);
    }

    const reading = absorbance.toFixed(3);
    updateSpecState('reading', reading);

    // Record in notebook
    addMeasurement(stepConfig.sample, parseFloat(reading));

    advanceStep();
    showFeedback(t('messages.absorbanceReading', { reading }), 'success');
    updateUI();
    return true;
}

// =============================================
// FINAL CALCULATION
// =============================================

export function trySubmitCalculation(userAnswer) {
    // Clear previous feedback
    showFeedback(t('messages.checking'), 'info');

    const stepConfig = validateStep('submitCalculation');
    if (!stepConfig) return false;

    const state = getState();
    const brassMass = state.notebookData.brassMass;

    // Find unknown measurement
    const unknownMeasurement = state.notebookData.measurements.find(m => m.sample === 'Unknown');
    if (!unknownMeasurement) {
        showFeedback(t('messages.measureUnknownFirst'), 'error');
        return false;
    }

    const absorbance = unknownMeasurement.absorbance;
    const concentration = config.calculateConcentration(absorbance);
    const expectedPercent = config.calculateMassPercent(concentration, brassMass);

    // Debug logging
    console.log('Calculation check:', {
        absorbance,
        concentration: concentration.toFixed(4),
        brassMass,
        expectedPercent: expectedPercent.toFixed(1),
        userAnswer,
        diff: Math.abs(userAnswer - expectedPercent).toFixed(2)
    });

    // Check answer (allow ±2% tolerance)
    const tolerance = 2;
    if (Math.abs(userAnswer - expectedPercent) <= tolerance) {
        showFeedback(t('messages.correct', { percent: expectedPercent.toFixed(1) }), 'success');
        advanceStep();
        updateUI();
        return true;
    } else {
        showFeedback(t('messages.incorrect', { percent: expectedPercent.toFixed(1) }), 'error');
        return false;
    }
}

// =============================================
// CLEANING CHECKLIST
// =============================================

export function tryCleaningChecklist() {
    const stepConfig = validateStep('cleaningChecklist');
    if (!stepConfig) return false;

    const checkboxes = document.querySelectorAll('.cleanup-item');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);

    if (!allChecked) {
        showFeedback(t('messages.completeCleanupFirst'), 'error');
        return false;
    }

    saveState();
    advanceStep();
    showFeedback(t('messages.cleanupComplete'), 'success');
    updateUI();
    return true;
}

// =============================================
// UNDO
// =============================================

export function tryUndo() {
    const state = getState();
    if (state.historyStack.length === 0) {
        showFeedback(t('messages.nothingToUndo'), 'info');
        return false;
    }

    const snapshot = state.historyStack.pop();
    if (snapshot) {
        // Manually restore without using restoreState to avoid double feedback
        setStateVariable('currentStep', snapshot.currentStep);
        setStateVariable('labObjects', snapshot.labObjects);
        // ... restore other state
        showFeedback(t('messages.undoSuccessful'), 'info');
        updateUI();
        return true;
    }
    return false;
}
