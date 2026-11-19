// state.js - Central Lab State Store, Dedicated Pipettes & History Stack
import * as config from './config.js';

let currentStep = 0;
let labObjects = [];
let dataTableData = [];
let spec20State = {};
let historyStack = [];
let draggedObject = null;
let selectedObjectId = null;
let hoveredObjectId = null;
let feedback = { message: '', type: 'info' };
let highlights = [];
let isDragging = false;
let undoButtonRef = null;

function calcInitialConc(stockVol, waterVol) {
    const totalVol = stockVol + waterVol;
    if (totalVol <= 0) return 0;
    return (Number(config.STOCK_CONCENTRATION) * Number(stockVol)) / Number(totalVol);
}

export function getState() {
    return {
        currentStep,
        labObjects,
        dataTableData,
        spec20State,
        historyStack,
        draggedObject,
        selectedObjectId,
        hoveredObjectId,
        feedback,
        highlights,
        isDragging,
    };
}

export function setStateVariable(key, value) {
    switch (key) {
        case 'currentStep': currentStep = value; break;
        case 'labObjects': labObjects = value; break;
        case 'draggedObject': draggedObject = value; break;
        case 'selectedObjectId': selectedObjectId = value; break;
        case 'hoveredObjectId': hoveredObjectId = value; break;
        case 'feedback': feedback = value; break;
        case 'highlights': highlights = value; break;
        case 'isDragging': isDragging = value; break;
        default: console.error('Attempted to set unknown state variable:', key);
    }
}

export function updateLabObject(id, property, value) {
    const objIndex = labObjects.findIndex((o) => o.id === id);
    if (objIndex > -1) {
        labObjects[objIndex][property] = value;
    } else {
        console.error(`Cannot update object: ID ${id} not found.`);
    }
}

export function updateDataTableRow(id, property, value) {
    const rowIndex = dataTableData.findIndex((row) => row.id === id);
    if (rowIndex > -1) {
        dataTableData[rowIndex][property] = value;
    } else {
        console.error(`Cannot update data table: Row ID ${id} not found.`);
    }
}

export function updateSpec20State(property, value) {
    if (Object.prototype.hasOwnProperty.call(spec20State, property)) {
        spec20State[property] = value;
    } else {
        console.error(`Cannot update spec20 state: Property ${property} not found.`);
    }
}

export function initializeState(undoButtonElement) {
    if (undoButtonElement !== undefined) {
        undoButtonRef = undoButtonElement;
    }

    currentStep = 0;
    feedback = { message: 'Welcome! Follow the instructions. Drag (or click) a dedicated pipette onto a reagent bottle.', type: 'info' };
    historyStack = [];
    draggedObject = null;
    selectedObjectId = null;
    hoveredObjectId = null;
    highlights = [];
    isDragging = false;

    const stockBottle = {
        id: 'stockBottle',
        type: 'bottle',
        label: 'Stock Blue #1',
        liquidType: 'stock',
        concentration: config.STOCK_CONCENTRATION,
        maxVolume: 1000,
        currentVolume: 1000,
        isDraggable: false,
        isDropTarget: true,
    };

    const waterBottle = {
        id: 'waterBottle',
        type: 'bottle',
        label: 'Distilled H₂O',
        liquidType: 'water',
        concentration: 0,
        maxVolume: 1000,
        currentVolume: 1000,
        isDraggable: false,
        isDropTarget: true,
    };

    const unknownBottle = {
        id: 'unknownBottle',
        type: 'bottle',
        label: 'Unknown Drink',
        liquidType: 'unknown',
        concentration: -1,
        maxVolume: 500,
        currentVolume: 500,
        isDraggable: false,
        isDropTarget: true,
    };

    // Separate dedicated pipettes for each liquid type
    const pipettes = [
        {
            id: 'pipette_stock',
            type: 'pipette',
            label: 'Blue #1 Pipette',
            shortLabel: 'Blue #1',
            liquidType: 'stock',
            accentHex: config.PIPETTE_ROLES.pipette_stock.accentHex,
            maxVolume: 10,
            currentVolume: 0,
            contentsConcentration: 0,
            isDraggable: true,
            isDropTarget: false,
        },
        {
            id: 'pipette_water',
            type: 'pipette',
            label: 'Water (H₂O) Pipette',
            shortLabel: 'H₂O',
            liquidType: 'water',
            accentHex: config.PIPETTE_ROLES.pipette_water.accentHex,
            maxVolume: 10,
            currentVolume: 0,
            contentsConcentration: 0,
            isDraggable: true,
            isDropTarget: false,
        },
        {
            id: 'pipette_unknown',
            type: 'pipette',
            label: 'Unknown Pipette',
            shortLabel: 'Unknown',
            liquidType: 'unknown',
            accentHex: config.PIPETTE_ROLES.pipette_unknown.accentHex,
            maxVolume: 10,
            currentVolume: 0,
            contentsConcentration: 0,
            isDraggable: true,
            isDropTarget: false,
        },
    ];

    const tubes = [
        { id: 'tube_10_0', type: 'testTube', label: '10/0',         liquidType: 'stock', maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true },
        { id: 'tube_8_2',  type: 'testTube', label: '8/2',          liquidType: 'stock', maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true },
        { id: 'tube_6_4',  type: 'testTube', label: '6/4',          liquidType: 'stock', maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true },
        { id: 'tube_4_6',  type: 'testTube', label: '4/6',          liquidType: 'stock', maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true },
        { id: 'tube_2_8',  type: 'testTube', label: '2/8',          liquidType: 'stock', maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true },
        { id: 'tube_0_10', type: 'testTube', label: '0/10 (Blank)', liquidType: 'water', maxVolume: 10, currentVolume: 0, concentration: 0, isDraggable: false, isDropTarget: true },
    ];

    const cuvette = {
        id: 'cuvette',
        type: 'cuvette',
        label: 'Optical Cuvette',
        maxVolume: 4,
        currentVolume: 0,
        concentration: 0,
        isClean: true,
        isDraggable: true,
        isDropTarget: true,
        isInSpec: false,
    };

    const wasteBeaker = {
        id: 'wasteBeaker',
        type: 'beaker',
        label: 'Waste Beaker',
        maxVolume: 250,
        currentVolume: 0,
        concentration: null,
        isDraggable: false,
        isDropTarget: true,
    };

    const spec20 = {
        id: 'spec20',
        type: 'spectrophotometer',
        label: 'Spectronic 20D+',
        isDraggable: false,
        isDropTarget: true,
    };

    labObjects = [
        stockBottle,
        waterBottle,
        unknownBottle,
        ...pipettes,
        ...tubes,
        cuvette,
        wasteBeaker,
        spec20,
    ];

    dataTableData = [
        { id: 'tube_10_0', solution: '1 (Stock)',     dilution: '10 / 0', conc: calcInitialConc(10, 0), measuredPercentT: null, T: null, negLogT: null },
        { id: 'tube_8_2',  solution: '2',             dilution: '8 / 2',  conc: calcInitialConc(8, 2),  measuredPercentT: null, T: null, negLogT: null },
        { id: 'tube_6_4',  solution: '3',             dilution: '6 / 4',  conc: calcInitialConc(6, 4),  measuredPercentT: null, T: null, negLogT: null },
        { id: 'tube_4_6',  solution: '4',             dilution: '4 / 6',  conc: calcInitialConc(4, 6),  measuredPercentT: null, T: null, negLogT: null },
        { id: 'tube_2_8',  solution: '5',             dilution: '2 / 8',  conc: calcInitialConc(2, 8),  measuredPercentT: null, T: null, negLogT: null },
        { id: 'tube_0_10', solution: '6 (Blank)',     dilution: '0 / 10', conc: 0,                      measuredPercentT: null, T: null, negLogT: null },
        { id: 'unknown',   solution: 'Unknown Drink', dilution: 'N/A',    conc: null,                   measuredPercentT: null, T: null, negLogT: null },
    ];

    spec20State = {
        cuvetteInsideId: null,
        reading: '-- %T',
        wavelength: config.TARGET_WAVELENGTH,
        isZeroed: false,
        absorbanceMode: false,
    };

    if (undoButtonRef) undoButtonRef.disabled = true;
}

function cloneState() {
    return JSON.parse(JSON.stringify({
        currentStep,
        labObjects,
        dataTableData,
        spec20State,
    }));
}

export function restoreState(stateToRestore) {
    currentStep = stateToRestore.currentStep;
    labObjects = stateToRestore.labObjects;
    dataTableData = stateToRestore.dataTableData;
    spec20State = stateToRestore.spec20State;
    highlights = [];
    draggedObject = null;
    selectedObjectId = null;
    isDragging = false;
    feedback = { message: 'Undo successful.', type: 'info' };
}

export function saveState() {
    if (historyStack.length >= 60) {
        historyStack.shift();
    }
    historyStack.push(cloneState());
    if (undoButtonRef) undoButtonRef.disabled = false;
}

export function findObjectById(id) {
    return labObjects.find((obj) => obj.id === id);
}

export function popHistory() {
    if (historyStack.length > 0) {
        return historyStack.pop();
    }
    return null;
}
