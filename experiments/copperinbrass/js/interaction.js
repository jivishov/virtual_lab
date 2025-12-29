// interaction.js - Drag-drop and pointer event handling

import {
    getState, setStateVariable, findObjectById, findObjectsByType,
    addLabObject, getEquipmentCount, updateEquipmentCount
} from './state.js';
import { getStepConfig } from './instructions.js';
import * as config from './config.js';
import * as actions from './actions.js';
import { showFeedback, updateUI, renderLabObject, updateShelfItemStatus, setDragSetupCallback } from './ui.js';
import { t } from './i18n/i18n.js';

let workbenchEl = null;
let shelfEl = null;
let draggedObject = null;
let dragSource = null;  // 'shelf' or 'workbench'
let dragOffsetX = 0;
let dragOffsetY = 0;
let pointerDragging = false;

// =============================================
// INITIALIZATION
// =============================================

export function initializeInteraction(workbench, shelf) {
    workbenchEl = workbench;
    shelfEl = shelf;

    // Register drag setup callback for ui.js
    setDragSetupCallback(setupNativeDrag);

    if (workbenchEl) {
        workbenchEl.addEventListener('dragover', handleDragOver);
        workbenchEl.addEventListener('drop', handleDrop);
        workbenchEl.addEventListener('click', handleWorkbenchClick);
    }

    populateShelf();
}

// =============================================
// SHELF POPULATION
// =============================================

function populateShelf() {
    if (!shelfEl) return;

    const items = [
        { type: 'balance' },
        { type: 'brass' },
        { type: 'pipette' },
        { type: 'waste' },
        { type: 'beaker' },
        { type: 'acid' },
        { type: 'flask' },
        { type: 'water' },
        { type: 'spec' },
        { type: 'rack' },
        { type: 'std1' },
        { type: 'std2' },
        { type: 'std4' }
    ];

    shelfEl.innerHTML = items.map(item => `
        <div class="shelf-item" data-type="${item.type}" draggable="true">
            <div class="shelf-icon">${getShelfIcon(item.type)}</div>
            <div class="shelf-label">${t(`equipment.${item.type}`)}</div>
        </div>
    `).join('');

    // Add drag event listeners to shelf items
    shelfEl.querySelectorAll('.shelf-item').forEach(el => {
        el.addEventListener('dragstart', handleShelfDragStart);
        el.addEventListener('dragend', handleDragEnd);
    });
}

// Export for language change updates
export function refreshShelf() {
    populateShelf();
}

function getShelfIcon(type) {
    // Import graphics dynamically to avoid circular dependency
    const GFX = window.GFX || {};

    switch (type) {
        case 'balance':
            return `<svg width="50" height="35" viewBox="0 0 140 100">
                <path d="M10,65 L130,65 L125,95 L15,95 Z" fill="#4b5563"/>
                <rect x="35" y="70" width="70" height="20" rx="3" fill="#1f2933"/>
                <ellipse cx="70" cy="35" rx="48" ry="5" fill="#f6f8fa" stroke="#bdc3c7"/>
            </svg>`;
        case 'brass':
            return `<svg width="30" height="30" viewBox="0 0 30 30">
                <circle cx="15" cy="15" r="10" fill="#f1c40f" stroke="#a67c00"/>
            </svg>`;
        case 'beaker':
            return `<svg width="40" height="50" viewBox="0 0 70 110">
                <path d="M10,12 L10,92 Q10,102 35,102 Q60,102 60,92 L60,12" fill="#e8eef5" opacity="0.7" stroke="#c7d2e2"/>
            </svg>`;
        case 'flask':
            return `<svg width="40" height="50" viewBox="0 0 80 120">
                <path d="M36,5 L36,40 L18,86 Q40,115 62,96 Q74,86 66,78 L50,40 L50,5 Z" fill="#e8eef5" stroke="#c7d2e2"/>
            </svg>`;
        case 'pipette':
            return `<svg width="20" height="50" viewBox="0 0 40 120">
                <circle cx="20" cy="18" r="12" fill="#e84c3c"/>
                <rect x="17" y="30" width="6" height="70" rx="3" fill="#eef2f7" stroke="#aebccc"/>
            </svg>`;
        case 'spec':
            return `<svg width="60" height="40" viewBox="0 0 170 115">
                <rect x="8" y="25" width="154" height="82" rx="8" fill="#34434f"/>
                <rect x="20" y="38" width="52" height="22" fill="#0b1218"/>
            </svg>`;
        case 'rack':
            return `<svg width="50" height="25" viewBox="0 0 110 50">
                <rect x="6" y="18" width="98" height="24" rx="6" fill="#6b7b8c"/>
                <circle cx="24" cy="18" r="7" fill="#4b5563"/>
                <circle cx="55" cy="18" r="7" fill="#4b5563"/>
                <circle cx="86" cy="18" r="7" fill="#4b5563"/>
            </svg>`;
        case 'waste':
            return `<svg width="40" height="50" viewBox="0 0 70 110">
                <path d="M10,12 L10,92 Q10,102 35,102 Q60,102 60,92 L60,12" fill="#5e4b35" stroke="#3e2b15"/>
            </svg>`;
        case 'acid':
            return `<svg width="25" height="45" viewBox="0 0 42 85">
                <rect x="14" y="2" width="14" height="11" fill="#7f8c8d"/>
                <rect x="6" y="13" width="30" height="70" rx="3" fill="#e74c3c"/>
            </svg>`;
        case 'water':
            return `<svg width="25" height="45" viewBox="0 0 42 85">
                <rect x="14" y="2" width="14" height="11" fill="#7f8c8d"/>
                <rect x="6" y="13" width="30" height="70" rx="3" fill="#3498db"/>
            </svg>`;
        case 'std1':
        case 'std2':
        case 'std4':
            return `<svg width="25" height="45" viewBox="0 0 42 85">
                <rect x="14" y="2" width="14" height="11" fill="#7f8c8d"/>
                <rect x="6" y="13" width="30" height="70" rx="3" fill="#2980b9"/>
            </svg>`;
        default:
            return '';
    }
}

// =============================================
// DRAG EVENT HANDLERS
// =============================================

function handleShelfDragStart(e) {
    const type = e.currentTarget.getAttribute('data-type');
    dragSource = 'shelf';
    e.dataTransfer.setData('src', 'shelf');
    e.dataTransfer.setData('type', type);
    e.currentTarget.style.opacity = '0.5';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
    e.preventDefault();

    const rect = workbenchEl.getBoundingClientRect();
    let x = e.clientX - rect.left - 30;
    let y = safeY(e.clientY - rect.top - 30);

    const src = e.dataTransfer.getData('src');

    if (src === 'shelf') {
        const type = e.dataTransfer.getData('type');
        handlePlaceFromShelf(type, x, y);
    } else if (src === 'workbench') {
        const id = e.dataTransfer.getData('id');
        handleMoveOnWorkbench(id, x, y, e.target);
    }
}

function handleDragEnd(e) {
    e.currentTarget.style.opacity = '1';
    draggedObject = null;
    dragSource = null;

    // Remove all drag-target highlights
    document.querySelectorAll('.drag-target').forEach(el => {
        el.classList.remove('drag-target');
    });
}

// =============================================
// PLACEMENT HANDLERS
// =============================================

function handlePlaceFromShelf(type, x, y) {
    // Try the place equipment action
    const success = actions.tryPlaceEquipment(type, x, y);

    if (success) {
        // Mark shelf item as taken for singletons
        if (config.SINGLETONS.includes(type)) {
            updateShelfItemStatus(type, true);
        }
    }
}

function handleMoveOnWorkbench(id, x, y, dropTarget) {
    const obj = findObjectById(id);
    if (!obj) return;

    // Check if dropped on another object
    const targetObj = findDropTarget(x, y, id);

    if (targetObj) {
        handleInteraction(obj, targetObj);
    } else {
        // Just move the object
        obj.x = x;
        obj.y = safeY(y);
        renderLabObject(obj);
    }
}

// =============================================
// INTERACTION HANDLERS
// =============================================

function handleInteraction(srcObj, tgtObj) {
    const state = getState();
    const stepConfig = getStepConfig(state.currentStep);

    // Brass onto Balance
    if (srcObj.type === 'brass' && tgtObj.type === 'balance') {
        actions.tryWeighBrass(srcObj.id, tgtObj.id);
        return;
    }

    // Brass into Beaker
    if (srcObj.type === 'brass' && tgtObj.type === 'beaker') {
        actions.tryTransferBrass(srcObj.id, tgtObj.id);
        return;
    }

    // Pipette onto Bottle/Beaker/Flask (fill)
    if (srcObj.type === 'pipette' && (tgtObj.type === 'bottle' || tgtObj.type === 'beaker' || tgtObj.type === 'flask')) {
        if (srcObj.props.vol === 0) {
            // Filling - pass the target object ID
            actions.tryFillPipette(srcObj.id, tgtObj.id);
        } else {
            // Dispensing
            if (tgtObj.type !== 'bottle') {
                actions.tryDispensePipette(srcObj.id, tgtObj.id);
            } else {
                showFeedback(t('messages.cannotDispenseBack'), 'error');
            }
        }
        return;
    }

    // Pipette onto Cuvette - dispense if pipette has liquid
    if (srcObj.type === 'pipette' && tgtObj.type === 'cuvette') {
        if (srcObj.props.vol > 0) {
            actions.tryDispenseToCuvette(srcObj.id, tgtObj.id);
        } else {
            showFeedback(t('messages.fillPipetteFirst'), 'error');
        }
        return;
    }

    // Pipette onto Waste Beaker - dispose pipette
    if (srcObj.type === 'pipette' && tgtObj.type === 'waste') {
        actions.tryDisposePipette(srcObj.id, tgtObj.id);
        return;
    }

    // Bottle onto Cuvette - not allowed (must use pipette)
    if (srcObj.type === 'bottle' && tgtObj.type === 'cuvette') {
        showFeedback(t('messages.usePipette'), 'error');
        return;
    }

    // Cuvette onto Bottle - not allowed (must use pipette)
    if (srcObj.type === 'cuvette' && tgtObj.type === 'bottle') {
        showFeedback(t('messages.usePipette'), 'error');
        return;
    }

    // Cuvette onto Spec
    if (srcObj.type === 'cuvette' && tgtObj.type === 'spec') {
        actions.tryInsertCuvette(srcObj.id);
        return;
    }

    // Cuvette onto Waste
    if (srcObj.type === 'cuvette' && tgtObj.type === 'waste') {
        // Empty cuvette into waste
        if (srcObj.props.vol > 0) {
            srcObj.props.vol = 0;
            srcObj.props.color = 'transparent';
            tgtObj.props.vol = Math.min(80, (tgtObj.props.vol || 0) + 5);
            renderLabObject(srcObj);
            renderLabObject(tgtObj);
            showFeedback(t('messages.cuvetteEmptied'), 'info');
        }
        return;
    }

    // Default: show hint
    showFeedback(t('messages.invalidInteraction'), 'error');
}

function findDropTarget(x, y, excludeId) {
    const state = getState();

    for (const obj of state.labObjects) {
        if (obj.id === excludeId) continue;

        const el = document.getElementById(obj.id);
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        const wbRect = workbenchEl.getBoundingClientRect();

        const objX = rect.left - wbRect.left;
        const objY = rect.top - wbRect.top;
        const objW = rect.width;
        const objH = rect.height;

        if (x >= objX - 20 && x <= objX + objW + 20 &&
            y >= objY - 20 && y <= objY + objH + 20) {
            return obj;
        }
    }

    return null;
}

// =============================================
// WORKBENCH CLICK HANDLER
// =============================================

function handleWorkbenchClick(e) {
    const target = e.target.closest('.lab-obj');
    if (!target) return;

    const id = target.id;
    const obj = findObjectById(id);
    if (!obj) return;

    const state = getState();
    const stepConfig = getStepConfig(state.currentStep);

    // Handle rack click (get cuvette)
    if (obj.type === 'rack' && stepConfig?.action === 'getCuvette') {
        actions.tryGetCuvette(id);
        return;
    }

    // Note: Cuvette click-to-fill removed - students must use pipette workflow
    // (fillPipette from source, then dispenseToCuvette)

    // Handle spec lid click
    if (obj.type === 'spec') {
        const lidEl = e.target.closest('.spec-lid');
        const calibrateEl = e.target.closest('.spec-calibrate');

        if (lidEl) {
            if (stepConfig?.action === 'toggleLid') {
                actions.tryToggleLid();
            } else if (stepConfig?.action === 'removeCuvette') {
                actions.tryRemoveCuvette();
            } else if (stepConfig?.action === 'calibrateSpec') {
                // Close lid and calibrate
                actions.tryCalibrateSpec();
            } else if (stepConfig?.action === 'measure') {
                // Close lid and measure
                actions.tryMeasure();
            } else {
                // Just toggle lid
                const currentOpen = state.specState.open;
                import('./state.js').then(stateModule => {
                    stateModule.updateSpecState('open', !currentOpen);
                    updateUI();
                });
            }
            return;
        }

        if (calibrateEl) {
            if (stepConfig?.action === 'calibrateSpec') {
                actions.tryCalibrateSpec();
            } else if (stepConfig?.action === 'measure') {
                actions.tryMeasure();
            }
            return;
        }
    }
}

// =============================================
// POINTER DRAG (FALLBACK)
// =============================================

export function setupPointerDrag(objEl, obj) {
    objEl.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();

        pointerDragging = true;
        draggedObject = obj;

        const rect = objEl.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;

        objEl.style.zIndex = '1000';
        objEl.setPointerCapture(e.pointerId);

        const onMove = (moveE) => {
            if (!pointerDragging) return;

            const wbRect = workbenchEl.getBoundingClientRect();
            const x = moveE.clientX - wbRect.left - dragOffsetX;
            const y = safeY(moveE.clientY - wbRect.top - dragOffsetY);

            obj.x = x;
            obj.y = y;
            objEl.style.left = x + 'px';
            objEl.style.top = y + 'px';

            // Highlight potential drop targets
            highlightDropTargets(x, y, obj.id);
        };

        const onUp = (upE) => {
            pointerDragging = false;
            objEl.releasePointerCapture(upE.pointerId);
            objEl.removeEventListener('pointermove', onMove);
            objEl.removeEventListener('pointerup', onUp);

            // Check for drop target
            const wbRect = workbenchEl.getBoundingClientRect();
            const x = upE.clientX - wbRect.left - dragOffsetX;
            const y = safeY(upE.clientY - wbRect.top - dragOffsetY);

            const target = findDropTarget(x, y, obj.id);
            if (target) {
                handleInteraction(obj, target);
            }

            // Clear highlights
            document.querySelectorAll('.drag-target').forEach(el => {
                el.classList.remove('drag-target');
            });

            draggedObject = null;
            updateUI();
        };

        objEl.addEventListener('pointermove', onMove);
        objEl.addEventListener('pointerup', onUp);
    });
}

function highlightDropTargets(x, y, excludeId) {
    document.querySelectorAll('.drag-target').forEach(el => {
        el.classList.remove('drag-target');
    });

    const target = findDropTarget(x, y, excludeId);
    if (target) {
        const el = document.getElementById(target.id);
        if (el) el.classList.add('drag-target');
    }
}

// =============================================
// HELPERS
// =============================================

function safeY(y) {
    // Allow objects to be placed anywhere on the workbench
    // Just ensure Y is not negative
    return Math.max(y, 0);
}

// =============================================
// NATIVE DRAG FOR WORKBENCH OBJECTS
// =============================================

export function setupNativeDrag(objEl, obj) {
    objEl.draggable = true;

    objEl.addEventListener('dragstart', (e) => {
        dragSource = 'workbench';
        draggedObject = obj;
        e.dataTransfer.setData('src', 'workbench');
        e.dataTransfer.setData('id', obj.id);
        setTimeout(() => objEl.style.opacity = '0.5', 0);
    });

    objEl.addEventListener('dragend', (e) => {
        objEl.style.opacity = '1';
        draggedObject = null;
        dragSource = null;
    });

    objEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (draggedObject && draggedObject.id !== obj.id) {
            objEl.classList.add('drag-target');
        }
    });

    objEl.addEventListener('dragleave', () => {
        objEl.classList.remove('drag-target');
    });

    objEl.addEventListener('drop', (e) => {
        e.stopPropagation();
        objEl.classList.remove('drag-target');

        if (draggedObject && draggedObject.id !== obj.id) {
            handleInteraction(draggedObject, obj);
        }
    });
}
