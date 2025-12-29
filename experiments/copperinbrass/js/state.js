// state.js - Centralized state management

import * as config from './config.js';

// Module-scoped state variables
let currentStep = 0;
let labObjects = [];
let balanceState = { reading: '0.000', hasBrass: false };
let specState = {
    open: false,
    hasCuvette: false,
    cuvetteId: null,
    isCalibrated: false,
    reading: '---'
};
let notebookData = {
    brassMass: null,
    condition: 'Solid',
    measurements: []  // {sample: string, absorbance: number}
};
let pipetteRegistry = {};   // pipetteId -> substance type
let cuvetteRegistry = {};   // cuvetteId -> sample type
let equipmentCounts = {};   // track singleton equipment
let historyStack = [];
let feedback = { message: 'Welcome! Follow the instructions.', type: 'info' };
let highlights = [];
let isDragging = false;
let draggedObject = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let idCounter = 0;
let pipetteSerial = 1;
let cuvetteSerial = 1;

// Get current state snapshot (read-only reference)
export function getState() {
    return {
        currentStep,
        labObjects,
        balanceState,
        specState,
        notebookData,
        pipetteRegistry,
        cuvetteRegistry,
        equipmentCounts,
        historyStack,
        feedback,
        highlights,
        isDragging,
        draggedObject,
        dragOffsetX,
        dragOffsetY,
        idCounter,
        pipetteSerial,
        cuvetteSerial
    };
}

// Set top-level state variable
export function setStateVariable(key, value) {
    switch (key) {
        case 'currentStep': currentStep = value; break;
        case 'labObjects': labObjects = value; break;
        case 'feedback': feedback = value; break;
        case 'highlights': highlights = value; break;
        case 'isDragging': isDragging = value; break;
        case 'draggedObject': draggedObject = value; break;
        case 'dragOffsetX': dragOffsetX = value; break;
        case 'dragOffsetY': dragOffsetY = value; break;
        case 'idCounter': idCounter = value; break;
        case 'pipetteSerial': pipetteSerial = value; break;
        case 'cuvetteSerial': cuvetteSerial = value; break;
        default:
            console.warn(`Unknown state variable: ${key}`);
    }
}

// Update a property of a lab object by ID
export function updateLabObject(id, property, value) {
    const obj = labObjects.find(o => o.id === id);
    if (obj) {
        if (property.includes('.')) {
            // Handle nested properties like 'props.vol'
            const parts = property.split('.');
            let target = obj;
            for (let i = 0; i < parts.length - 1; i++) {
                target = target[parts[i]];
            }
            target[parts[parts.length - 1]] = value;
        } else {
            obj[property] = value;
        }
    } else {
        console.warn(`Lab object not found: ${id}`);
    }
}

// Update balance state
export function updateBalanceState(property, value) {
    if (balanceState.hasOwnProperty(property)) {
        balanceState[property] = value;
    } else {
        console.warn(`Unknown balance property: ${property}`);
    }
}

// Update spectrophotometer state
export function updateSpecState(property, value) {
    if (specState.hasOwnProperty(property)) {
        specState[property] = value;
    } else {
        console.warn(`Unknown spec property: ${property}`);
    }
}

// Update notebook data
export function updateNotebookData(property, value) {
    if (property === 'measurements') {
        notebookData.measurements = value;
    } else if (notebookData.hasOwnProperty(property)) {
        notebookData[property] = value;
    } else {
        console.warn(`Unknown notebook property: ${property}`);
    }
}

// Add measurement to notebook
export function addMeasurement(sample, absorbance) {
    notebookData.measurements.push({ sample, absorbance });
}

// Update pipette registry
export function updatePipetteRegistry(pipetteId, substance) {
    pipetteRegistry[pipetteId] = substance;
}

// Update cuvette registry
export function updateCuvetteRegistry(cuvetteId, sampleType) {
    cuvetteRegistry[cuvetteId] = sampleType;
}

// Update equipment count
export function updateEquipmentCount(type, delta) {
    if (!equipmentCounts[type]) {
        equipmentCounts[type] = 0;
    }
    equipmentCounts[type] += delta;
}

// Get equipment count
export function getEquipmentCount(type) {
    return equipmentCounts[type] || 0;
}

// Find object by ID
export function findObjectById(id) {
    return labObjects.find(obj => obj.id === id);
}

// Find objects by type
export function findObjectsByType(type) {
    return labObjects.filter(obj => obj.type === type);
}

// Add object to lab
export function addLabObject(obj) {
    labObjects.push(obj);
}

// Remove object from lab
export function removeLabObject(id) {
    const index = labObjects.findIndex(o => o.id === id);
    if (index > -1) {
        labObjects.splice(index, 1);
    }
}

// Generate unique ID
export function generateId(prefix = 'obj') {
    return `${prefix}_${idCounter++}`;
}

// Get next pipette serial
export function getNextPipetteSerial() {
    return `P${pipetteSerial++}`;
}

// Get next cuvette serial
export function getNextCuvetteSerial() {
    return `C${cuvetteSerial++}`;
}

// Deep clone for history snapshots
function cloneState() {
    return JSON.parse(JSON.stringify({
        currentStep,
        labObjects,
        balanceState,
        specState,
        notebookData,
        pipetteRegistry,
        cuvetteRegistry,
        equipmentCounts,
        idCounter,
        pipetteSerial,
        cuvetteSerial
    }));
}

// Save current state to history
export function saveState() {
    if (historyStack.length >= config.MAX_HISTORY) {
        historyStack.shift();
    }
    historyStack.push(cloneState());
}

// Pop last state from history
export function popHistory() {
    if (historyStack.length > 0) {
        return historyStack.pop();
    }
    return null;
}

// Restore state from snapshot
export function restoreState(snapshot) {
    currentStep = snapshot.currentStep;
    labObjects = snapshot.labObjects;
    balanceState = snapshot.balanceState;
    specState = snapshot.specState;
    notebookData = snapshot.notebookData;
    pipetteRegistry = snapshot.pipetteRegistry;
    cuvetteRegistry = snapshot.cuvetteRegistry;
    equipmentCounts = snapshot.equipmentCounts;
    idCounter = snapshot.idCounter;
    pipetteSerial = snapshot.pipetteSerial;
    cuvetteSerial = snapshot.cuvetteSerial;

    // Clear transient state
    highlights = [];
    draggedObject = null;
    isDragging = false;
    feedback = { message: 'Undo successful.', type: 'info' };
}

// Initialize state (called on app start)
export function initializeState() {
    currentStep = 0;
    labObjects = [];
    balanceState = { reading: '0.000', hasBrass: false };
    specState = {
        open: false,
        hasCuvette: false,
        cuvetteId: null,
        isCalibrated: false,
        reading: '---'
    };

    // Generate random brass mass (1.30 - 1.70 g)
    const brassMass = (1.30 + Math.random() * 0.4).toFixed(3);
    notebookData = {
        brassMass: parseFloat(brassMass),
        condition: 'Solid',
        measurements: []
    };

    pipetteRegistry = {};
    cuvetteRegistry = {};
    equipmentCounts = {};
    historyStack = [];
    feedback = { message: 'Welcome! Follow the instructions to complete the lab.', type: 'info' };
    highlights = [];
    isDragging = false;
    draggedObject = null;
    idCounter = 0;
    pipetteSerial = 1;
    cuvetteSerial = 1;

    console.log('State initialized. Brass mass:', brassMass, 'g');
}

// Check if history is available for undo
export function hasHistory() {
    return historyStack.length > 0;
}
