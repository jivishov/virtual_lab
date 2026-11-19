// interaction3d.js - 3D Raycasting, Drag-and-Drop, Click-to-Act, Spec 20 Buttons & Camera Presets
import * as THREE from 'three';
import {
    getState,
    setStateVariable,
    findObjectById,
    popHistory,
    restoreState,
    initializeState,
} from './state.js';
import { updateUI, showFeedback } from './ui.js';
import { drawGraph } from './graph.js';
import {
    getCamera,
    getControls,
    getDomElement,
    getPickTargets,
    getWorldMouthPosition,
    setDragVisualState,
    setCameraPreset,
    syncSceneFromState,
} from './scene3d.js';

let actions = {};
let hoverInfoEl = null;
let undoButton = null;
let resetButton = null;

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.22);
const planeIntersect = new THREE.Vector3();

// Pointer tracking state
let pointerDown = false;
let pointerStartX = 0;
let pointerStartY = 0;
let pointerMoved = false;
let pressedObjId = null;
let pressedSpecButton = null;
let pressedTargetId = null;
let activeDragId = null;
let currentDropHoverId = null;

function setNdcFromEvent(e) {
    const dom = getDomElement();
    if (!dom) return false;
    const rect = dom.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    return true;
}

function raycastScene(excludeId = null, preferButtons = true) {
    const cam = getCamera();
    if (!cam) return null;
    raycaster.setFromCamera(ndc, cam);
    const hits = raycaster.intersectObjects(getPickTargets(), false);

    // Prioritize clickable Spec 20 buttons when not dragging
    if (preferButtons) {
        for (const h of hits) {
            if (h.object.userData?.specButton) {
                return {
                    interactId: h.object.userData.interactId,
                    specButton: h.object.userData.specButton,
                    point: h.point,
                };
            }
        }
    }

    for (const h of hits) {
        const id = h.object.userData?.interactId;
        if (!id) continue;
        if (h.object.userData?.specButton && !preferButtons) continue;
        if (excludeId && id === excludeId) continue;
        return {
            interactId: id,
            specButton: h.object.userData?.specButton || null,
            point: h.point,
        };
    }
    return null;
}

function isValidDropCandidate(actorObj, targetObj) {
    if (!actorObj || !targetObj || actorObj.id === targetObj.id) return false;
    if (!targetObj.isDropTarget) return false;
    if (actorObj.type === 'pipette') {
        if (actorObj.currentVolume === 0) {
            return targetObj.type === 'bottle' || targetObj.type === 'testTube';
        }
        return targetObj.type === 'testTube' || targetObj.type === 'cuvette' || targetObj.type === 'beaker';
    }
    if (actorObj.type === 'cuvette') {
        return targetObj.id === 'wasteBeaker' || targetObj.type === 'spectrophotometer';
    }
    return false;
}

function describeObjectForHud(hit, activeActorId = null) {
    if (!hit) return 'Drag (or click) a dedicated pipette or cuvette to interact • Drag empty space to orbit';

    if (hit.specButton) {
        const labels = {
            zero: 'Spectronic 20D+ — Click ZERO to calibrate 100.0 %T / 0.000 Abs with Blank',
            measure: 'Spectronic 20D+ — Click MEASURE to record optical reading at 630 nm',
            mode: 'Spectronic 20D+ — Click %T / ABS to toggle display units',
        };
        return labels[hit.specButton] || 'Spectronic 20D+ Button';
    }

    const obj = findObjectById(hit.interactId);
    if (!obj) return '';

    if (activeActorId && activeActorId !== obj.id) {
        const actor = findObjectById(activeActorId);
        if (actor && isValidDropCandidate(actor, obj)) {
            if (actor.type === 'pipette' && actor.currentVolume === 0) {
                return `Drop / Click to fill ${actor.label} from ${obj.label}`;
            }
            if (actor.type === 'pipette' && actor.currentVolume > 0) {
                return `Drop / Click to dispense ${actor.currentVolume.toFixed(0)} mL into ${obj.label}`;
            }
            if (actor.type === 'cuvette' && obj.id === 'wasteBeaker') {
                return `Drop / Click to empty Cuvette into Waste Beaker`;
            }
            if (actor.type === 'cuvette' && obj.id === 'spec20') {
                return `Drop / Click to insert Cuvette into Spectronic 20D+`;
            }
        }
    }

    if (obj.type === 'pipette') {
        const fillTxt = obj.currentVolume > 0 ? `Loaded: ${obj.currentVolume.toFixed(1)} mL` : 'Empty';
        return `${obj.label} (${fillTxt}) — Drag or click to pick up`;
    }
    if (obj.type === 'bottle') {
        const concTxt = obj.concentration === -1 ? 'Unknown conc.' : `${obj.concentration.toFixed(2)} µM`;
        return `${obj.label} — ${obj.currentVolume.toFixed(0)} mL remaining (${concTxt})`;
    }
    if (obj.type === 'testTube') {
        const concTxt = obj.currentVolume > 0 ? ` • ${obj.concentration.toFixed(3)} µM` : '';
        return `Test Tube ${obj.label} — ${obj.currentVolume.toFixed(1)} / ${obj.maxVolume} mL${concTxt}`;
    }
    if (obj.type === 'cuvette') {
        const cleanTxt = obj.isClean ? 'Clean' : 'Needs Rinse';
        const locTxt = obj.isInSpec ? 'In Spec 20' : 'In Holder';
        return `Optical Cuvette (${locTxt}, ${cleanTxt}) — ${obj.currentVolume.toFixed(1)} / ${obj.maxVolume} mL`;
    }
    if (obj.type === 'beaker') {
        return `Waste Beaker — ${obj.currentVolume.toFixed(1)} / ${obj.maxVolume} mL`;
    }
    if (obj.type === 'spectrophotometer') {
        const st = getState().spec20State;
        return `Spectronic 20D+ (${st.reading} @ ${st.wavelength} nm) — Click buttons or insert cuvette`;
    }
    return obj.label || '';
}

function updateHoverHud(text) {
    if (hoverInfoEl && hoverInfoEl.textContent !== text) {
        hoverInfoEl.textContent = text;
    }
}

function executeInteractionPair(actorId, targetId, isFromDrag = false) {
    const actor = findObjectById(actorId);
    const target = targetId ? findObjectById(targetId) : null;
    if (!actor) return;

    if (actor.type === 'pipette') {
        if (!target) return;
        if (actor.currentVolume === 0) {
            if (target.type === 'bottle' || target.type === 'testTube') {
                actions.tryFillPipette(actor.id, target.id);
            } else {
                showFeedback(`${actor.label} is empty. Fill it from a source bottle or test tube first.`, 'info');
            }
        } else {
            if (target.type === 'testTube' || target.type === 'cuvette' || target.type === 'beaker') {
                actions.tryDispensePipette(actor.id, target.id, actor.currentVolume);
            } else {
                showFeedback(`${actor.label} is already filled (${actor.currentVolume} mL). Dispense it first.`, 'info');
            }
        }
        return;
    }

    if (actor.type === 'cuvette') {
        if (actor.isInSpec) {
            if (target && target.id === 'wasteBeaker') {
                // Seamless single drag/click from Spec 20 straight to Waste!
                actions.tryEmptyCuvette(actor.id, target.id, true);
                return;
            }
            if (!target || target.id !== 'spec20') {
                // Removed from spec back onto bench/holder
                actions.tryRemoveCuvetteFromSpec(actor.id);
                setStateVariable('selectedObjectId', null);
                showFeedback('Cuvette removed from Spectrophotometer.', 'info');
                updateUI();
                return;
            }
            if (isFromDrag) {
                showFeedback('Drag cuvette to Waste Beaker to empty it.', 'info');
            }
            return;
        }

        if (!target) return;
        if (target.id === 'wasteBeaker') {
            actions.tryEmptyCuvette(actor.id, target.id, false);
        } else if (target.type === 'spectrophotometer') {
            actions.tryInsertCuvette(actor.id, target.id);
        }
    }
}

// ---------------------------------------------------------------------------
// Pointer Event Handlers
// ---------------------------------------------------------------------------

function onPointerDown(e) {
    if (e.button !== 0) return; // Left mouse / primary touch only (right-drag still orbits/pans)
    if (!setNdcFromEvent(e)) return;

    const state = getState();
    const hit = raycastScene(null, true);
    const controls = getControls();

    pointerDown = true;
    pointerStartX = e.clientX;
    pointerStartY = e.clientY;
    pointerMoved = false;
    pressedObjId = null;
    pressedSpecButton = null;
    pressedTargetId = null;
    activeDragId = null;
    currentDropHoverId = null;

    if (!hit) return;

    // 1. Direct Spec 20 button press
    if (hit.specButton) {
        pressedSpecButton = hit.specButton;
        if (controls) controls.enabled = false;
        return;
    }

    const clickedObj = findObjectById(hit.interactId);
    if (!clickedObj) return;

    // 2. If a filled pipette is currently selected AND user clicks cuvette, treat cuvette as dispense destination!
    if (state.selectedObjectId && state.selectedObjectId.startsWith('pipette_')) {
        const selPip = findObjectById(state.selectedObjectId);
        if (selPip && selPip.currentVolume > 0 && clickedObj.id === 'cuvette') {
            pressedTargetId = 'cuvette';
            if (controls) controls.enabled = false;
            return;
        }
    }

    // 3. Draggable object (any of the 3 pipettes or the cuvette)
    if (clickedObj.isDraggable) {
        pressedObjId = clickedObj.id;
        if (controls) controls.enabled = false;
        const dom = getDomElement();
        if (dom) dom.classList.add('viewport--dragging');
        return;
    }

    // 4. Click on a drop target while an object is selected (click-to-act mode!)
    if (state.selectedObjectId && clickedObj.isDropTarget) {
        pressedTargetId = clickedObj.id;
        if (controls) controls.enabled = false;
    }
}

function onPointerMove(e) {
    if (!setNdcFromEvent(e)) return;
    const dom = getDomElement();
    const state = getState();

    if (pointerDown) {
        const dist = Math.hypot(e.clientX - pointerStartX, e.clientY - pointerStartY);
        if (dist > 6) pointerMoved = true;

        // Active 3D drag of a pipette or cuvette
        if (pressedObjId && pointerMoved) {
            if (!activeDragId) {
                activeDragId = pressedObjId;
                setStateVariable('isDragging', true);
                setStateVariable('draggedObject', findObjectById(activeDragId));
                setStateVariable('selectedObjectId', activeDragId);
            }

            const actor = findObjectById(activeDragId);
            const hoverHit = raycastScene(activeDragId, false);
            const hoverObj = hoverHit ? findObjectById(hoverHit.interactId) : null;
            const validDrop = hoverObj && isValidDropCandidate(actor, hoverObj);

            currentDropHoverId = validDrop ? hoverObj.id : null;

            // Compute smooth 3D world drag coordinate (magnetically aligns over valid targets!)
            const targetPos = new THREE.Vector3();
            if (validDrop) {
                const mouth = getWorldMouthPosition(hoverObj.id);
                targetPos.copy(mouth);
                targetPos.y += actor.type === 'pipette' ? 0.045 : 0.065;
            } else {
                const planeY = actor.type === 'pipette' ? 0.14 : 0.15;
                dragPlane.constant = -planeY;
                raycaster.setFromCamera(ndc, getCamera());
                if (raycaster.ray.intersectPlane(dragPlane, planeIntersect)) {
                    targetPos.copy(planeIntersect);
                    // Clamp neatly above the lab bench bounds
                    targetPos.x = Math.max(-0.68, Math.min(0.66, targetPos.x));
                    targetPos.z = Math.max(-0.28, Math.min(0.28, targetPos.z));
                }
            }

            setDragVisualState(activeDragId, targetPos, currentDropHoverId);
            updateHoverHud(describeObjectForHud(hoverHit, activeDragId));
            return;
        }
    }

    // Standard hover feedback (cursor + inspector HUD)
    const hit = raycastScene(null, true);
    updateHoverHud(describeObjectForHud(hit, state.selectedObjectId));

    if (dom) {
        if (activeDragId) {
            dom.style.cursor = 'grabbing';
        } else if (hit?.specButton) {
            dom.style.cursor = 'pointer';
        } else if (hit) {
            const obj = findObjectById(hit.interactId);
            if (obj?.isDraggable) {
                dom.style.cursor = 'grab';
            } else if (state.selectedObjectId && obj?.isDropTarget) {
                dom.style.cursor = 'pointer';
            } else {
                dom.style.cursor = 'default';
            }
        } else {
            dom.style.cursor = 'default';
        }
    }
}

function onPointerUp(e) {
    if (!pointerDown) return;
    setNdcFromEvent(e);

    const dom = getDomElement();
    const controls = getControls();
    if (controls) controls.enabled = true;
    if (dom) {
        dom.classList.remove('viewport--dragging');
        dom.style.cursor = 'default';
    }

    const wasDragging = Boolean(activeDragId);
    const finishedDragId = activeDragId;
    const state = getState();

    // Case 1: Clicked a 3D button on Spec 20
    if (pressedSpecButton && !pointerMoved) {
        if (pressedSpecButton === 'zero') actions.tryZeroSpec();
        else if (pressedSpecButton === 'measure') actions.tryMeasure();
        else if (pressedSpecButton === 'mode') actions.tryToggleMode();
    }
    // Case 2: Dropped a dragged 3D object
    else if (wasDragging && finishedDragId) {
        const dropHit = raycastScene(finishedDragId, false);
        const dropId = currentDropHoverId || dropHit?.interactId || null;
        setDragVisualState(null, null, null);
        setStateVariable('isDragging', false);
        setStateVariable('draggedObject', null);
        executeInteractionPair(finishedDragId, dropId, true);
    }
    // Case 3: Click-to-select a draggable (pipette or cuvette) without dragging
    else if (pressedObjId && !pointerMoved) {
        const newSel = state.selectedObjectId === pressedObjId ? null : pressedObjId;
        setStateVariable('selectedObjectId', newSel);
        if (newSel) {
            const obj = findObjectById(newSel);
            if (obj) {
                const hint =
                    obj.type === 'pipette'
                        ? obj.currentVolume > 0
                            ? `${obj.label} selected (${obj.currentVolume} mL) — click destination tube or cuvette to dispense.`
                            : `${obj.label} selected — click a source bottle or test tube to fill.`
                        : obj.isInSpec
                        ? 'Cuvette selected in Spec 20 — click Waste Beaker to empty, or click empty bench to remove.'
                        : 'Cuvette selected — click Spec 20 to insert or Waste Beaker to empty.';
                showFeedback(hint, 'info');
            }
        }
        updateUI();
    }
    // Case 4: Click-to-act onto a destination while an object was selected
    else if (pressedTargetId && !pointerMoved && state.selectedObjectId) {
        executeInteractionPair(state.selectedObjectId, pressedTargetId, false);
    }
    // Case 5: Quick click on empty space -> deselect (or remove cuvette from Spec if selected!)
    else if (!pointerMoved && !pressedObjId && !pressedSpecButton && !pressedTargetId && state.selectedObjectId) {
        const selObj = findObjectById(state.selectedObjectId);
        if (selObj?.id === 'cuvette' && selObj.isInSpec) {
            executeInteractionPair('cuvette', null, false);
        } else {
            setStateVariable('selectedObjectId', null);
            updateUI();
        }
    }

    pointerDown = false;
    pointerMoved = false;
    pressedObjId = null;
    pressedSpecButton = null;
    pressedTargetId = null;
    activeDragId = null;
    currentDropHoverId = null;
    setDragVisualState(null, null, null);
}

// ---------------------------------------------------------------------------
// Undo, Reset & Keyboard Shortcuts
// ---------------------------------------------------------------------------

export function handleUndoClick() {
    const prevState = popHistory();
    if (prevState) {
        restoreState(prevState);
        syncSceneFromState(true);
        updateUI();
        drawGraph();
    }
    if (undoButton) undoButton.disabled = getState().historyStack.length === 0;
}

export function handleResetClick() {
    initializeState(undoButton);
    syncSceneFromState(true);
    updateUI();
    drawGraph();
    setCameraPreset('overview');
    showFeedback('Lab bench reset to Step 1. Ready to begin!', 'info');
}

function onKeyDown(e) {
    if (e.key === 'Escape') {
        if (getState().selectedObjectId) {
            setStateVariable('selectedObjectId', null);
            updateUI();
        }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndoClick();
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const presetKeys = ['overview', 'reagents', 'rack', 'spec20'];
        const idx = parseInt(e.key, 10) - 1;
        if (idx >= 0 && idx < presetKeys.length) {
            setCameraPreset(presetKeys[idx]);
            document.querySelectorAll('.cam-btn').forEach((b) => {
                b.classList.toggle('cam-btn--active', b.dataset.preset === presetKeys[idx]);
            });
        }
    }
}

export function initInteraction3D({ undoBtn, resetBtn, hoverEl, actionFunctions }) {
    undoButton = undoBtn;
    resetButton = resetBtn;
    hoverInfoEl = hoverEl;
    actions = actionFunctions;

    const dom = getDomElement();
    if (!dom) {
        console.error('Interaction3D requires initialized WebGL canvas.');
        return;
    }

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);

    if (undoButton) undoButton.addEventListener('click', handleUndoClick);
    if (resetButton) resetButton.addEventListener('click', handleResetClick);
}
