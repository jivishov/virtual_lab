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
import { updateUI, showFeedback } from './ui.js?v=11';
import { drawGraph } from './graph.js?v=11';
import {
    getCamera,
    getControls,
    getDomElement,
    getPickTargets,
    getWorldMouthPosition,
    getScreenPoint,
    setDragVisualState,
    setCameraPreset,
    setHoveredLabelId,
    syncSceneFromState,
} from './scene3d.js?v=16';

let actions = {};
let hoverInfoEl = null;
let undoButton = null;
let resetButton = null;
let onResetCallback = null;
let onUndoCallback = null;

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const planeIntersect = new THREE.Vector3();
const _camForward = new THREE.Vector3();
const _dragPlaneAnchor = new THREE.Vector3(0, 0.14, 0.02);

// Screen-space magnetic proximity assist (makes hand-gesture grabbing & dropping feel effortless!)
function findNearestScreenTarget(clientX, clientY, candidateIds, maxRadiusPx = 56, preferredIds = []) {
    let bestId = null;
    let bestScore = Infinity;
    for (const id of candidateIds) {
        const pt = getScreenPoint(id);
        if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
        const d = Math.hypot(clientX - pt.x, clientY - pt.y);
        if (d <= maxRadiusPx) {
            const bonus = preferredIds.includes(id) ? -14 : 0;
            const score = d + bonus;
            if (score < bestScore) {
                bestScore = score;
                bestId = id;
            }
        }
    }
    return bestId;
}

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

    // When the cuvette is seated inside Spec 20D+, prioritize grabbing/selecting it even though
    // the ray crosses the outer Spec 20D+ drop-target collider box first!
    if (!excludeId) {
        const cuvObj = findObjectById('cuvette');
        if (cuvObj?.isInSpec) {
            for (const h of hits) {
                if (h.object.userData?.interactId === 'cuvette') {
                    return {
                        interactId: 'cuvette',
                        specButton: null,
                        point: h.point,
                    };
                }
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
    if (!hit) return 'Drag or click a pipette or cuvette • Drag bench to orbit';

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
            let hoverObj = hoverHit ? findObjectById(hoverHit.interactId) : null;
            let validDrop = Boolean(hoverObj && isValidDropCandidate(actor, hoverObj));

            // Magnetic screen-space drop assist when using spatial hand gestures (or near a valid vessel mouth!)
            if (!validDrop && e.isVirtualHand) {
                const validIds = state.labObjects
                    .filter((o) => o.id !== activeDragId && isValidDropCandidate(actor, o))
                    .map((o) => o.id);
                const snapId = findNearestScreenTarget(e.clientX, e.clientY, validIds, 68, state.highlights || []);
                if (snapId) {
                    hoverObj = findObjectById(snapId);
                    validDrop = Boolean(hoverObj);
                }
            }

            currentDropHoverId = validDrop ? hoverObj.id : null;

            // Compute 1:1 cursor-locked 3D drag position (magnetically aligns over valid targets,
            // or glides on a camera-facing vertical plane anchored at the apparatus bench line so the
            // pipette/cuvette NEVER drifts away from the glowing cursor at any screen elevation!)
            const targetPos = new THREE.Vector3();
            if (validDrop) {
                const mouth = getWorldMouthPosition(hoverObj.id);
                targetPos.copy(mouth);
                targetPos.y += actor.type === 'pipette' ? 0.040 : 0.060;
            } else {
                const cam = getCamera();
                if (cam) {
                    cam.getWorldDirection(_camForward);
                    _camForward.y = 0;
                    if (_camForward.lengthSq() < 1e-4) _camForward.set(0, 0, -1);
                    _camForward.normalize();
                    _dragPlaneAnchor.set(0, 0.14, actor.type === 'cuvette' ? 0.06 : -0.02);
                    dragPlane.setFromNormalAndCoplanarPoint(_camForward, _dragPlaneAnchor);
                    raycaster.setFromCamera(ndc, cam);
                    if (raycaster.ray.intersectPlane(dragPlane, planeIntersect)) {
                        targetPos.copy(planeIntersect);
                        // Subtract object grip-center height so the middle of the pipette/cuvette sits DEAD-CENTER under the cursor!
                        const gripOffsetY = actor.type === 'pipette' ? 0.135 : 0.038;
                        targetPos.y = Math.max(0.03, Math.min(0.32, targetPos.y - gripOffsetY));
                        targetPos.x = Math.max(-0.68, Math.min(0.66, targetPos.x));
                        targetPos.z = Math.max(-0.26, Math.min(0.26, targetPos.z));
                    }
                }
            }

            setDragVisualState(activeDragId, targetPos, currentDropHoverId);
            updateHoverHud(describeObjectForHud(validDrop ? { interactId: hoverObj.id } : hoverHit, activeDragId));
            return;
        }
    }

    // Standard hover feedback (cursor + inspector HUD + smart 3D callout elevation)
    const hit = raycastScene(null, true);
    setHoveredLabelId(hit?.interactId || null);
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
        const clickedObj = findObjectById(pressedObjId);
        // If user clicks an already-loaded, already-selected pipette out of habit, keep it ready in hand instead of dropping it!
        const keepLoadedSelected =
            state.selectedObjectId === pressedObjId &&
            clickedObj?.type === 'pipette' &&
            clickedObj.currentVolume > 0;
        const newSel = keepLoadedSelected
            ? pressedObjId
            : state.selectedObjectId === pressedObjId
            ? null
            : pressedObjId;
        setStateVariable('selectedObjectId', newSel);
        if (newSel && clickedObj) {
            const hint =
                clickedObj.type === 'pipette'
                    ? clickedObj.currentVolume > 0
                        ? `${clickedObj.label} ready (${clickedObj.currentVolume} mL) — click or drag directly to destination tube or cuvette.`
                        : `${clickedObj.label} selected — click a source bottle or test tube to fill.`
                    : clickedObj.isInSpec
                    ? 'Cuvette selected in Spec 20 — click Waste Beaker to empty, or click empty bench to remove.'
                    : 'Cuvette selected — click Spec 20 to insert or Waste Beaker to empty.';
            showFeedback(hint, 'info');
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
    updateHoverHud(describeObjectForHud(raycastScene(null, true), getState().selectedObjectId));
}

// ---------------------------------------------------------------------------
// Undo, Reset & Keyboard Shortcuts
// ---------------------------------------------------------------------------

export function handleUndoClick() {
    const prevState = popHistory();
    if (prevState) {
        restoreState(prevState);
        // If undo returns to a step right after aspirating, keep the loaded pipette ready in hand!
        const loadedPip = getState().labObjects.find((o) => o.type === 'pipette' && o.currentVolume > 0);
        if (loadedPip) {
            setStateVariable('selectedObjectId', loadedPip.id);
        }
        if (typeof onUndoCallback === 'function') {
            onUndoCallback(getState().currentStep);
        }
        syncSceneFromState(true);
        updateUI();
        drawGraph();
    }
    if (undoButton) undoButton.disabled = getState().historyStack.length === 0;
}

export function handleResetClick() {
    initializeState(undoButton);
    if (typeof onResetCallback === 'function') {
        onResetCallback();
    }
    syncSceneFromState(true);
    updateUI();
    drawGraph();
    setCameraPreset('overview');
    document.querySelectorAll('.cam-btn').forEach((b) => {
        b.classList.toggle('cam-btn--active', b.dataset.preset === 'overview');
    });
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
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
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

export function initInteraction3D({ undoBtn, resetBtn, hoverEl, actionFunctions, onReset = null, onUndo = null }) {
    undoButton = undoBtn;
    resetButton = resetBtn;
    hoverInfoEl = hoverEl;
    actions = actionFunctions;
    onResetCallback = onReset;
    onUndoCallback = onUndo;

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

// ---------------------------------------------------------------------------
// Virtual Spatial Hand Gesture Pointer & Camera Control Hooks
// ---------------------------------------------------------------------------
// Reuses the exact 3D raycaster, magnetic drop snapping, direct pipette flow,
// Spec 20D+ button priority, and cuvette extraction logic as native mouse input.

function setNdcFromClient(clientX, clientY) {
    const dom = getDomElement();
    if (!dom) return false;
    const rect = dom.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return true;
}

export function inspectAtClientPoint(clientX, clientY) {
    if (!setNdcFromClient(clientX, clientY)) return null;
    const state = getState();
    let hit = raycastScene(activeDragId || null, !activeDragId);

    // Gentle screen-space proximity assist for spatial hand hovering (makes aiming at thin pipettes/cuvette effortless!)
    if (!hit) {
        const candidates = activeDragId
            ? state.labObjects
                  .filter((o) => o.id !== activeDragId && isValidDropCandidate(findObjectById(activeDragId), o))
                  .map((o) => o.id)
            : ['pipette_stock', 'pipette_water', 'pipette_unknown', 'cuvette', 'btn_zero', 'btn_measure', 'btn_mode'];
        const nearId = findNearestScreenTarget(clientX, clientY, candidates, activeDragId ? 66 : 44, state.highlights || []);
        if (nearId) {
            hit = nearId.startsWith('btn_')
                ? { interactId: nearId, specButton: nearId.replace('btn_', '') }
                : { interactId: nearId };
        }
    }

    if (!hit) {
        return {
            hitId: null,
            label: '',
            role: 'empty',
            objectType: null,
            isCuvette: false,
            isDraggable: false,
            isDropTarget: false,
            isValidDrop: false,
            isHighlighted: false,
            isButton: false,
            selectedObjectId: state.selectedObjectId || null,
            activeDragId: activeDragId || null,
        };
    }

    if (hit.specButton) {
        const btnNames = { zero: 'ZERO (100%T)', measure: 'MEASURE', mode: '%T / ABS' };
        return {
            hitId: hit.interactId,
            label: btnNames[hit.specButton] || 'Spec 20D+ Button',
            role: 'button',
            objectType: 'button',
            isCuvette: false,
            isDraggable: false,
            isDropTarget: false,
            isValidDrop: false,
            isHighlighted: (state.highlights || []).includes(hit.interactId),
            isButton: true,
            selectedObjectId: state.selectedObjectId || null,
            activeDragId: activeDragId || null,
        };
    }

    const obj = findObjectById(hit.interactId);
    const activeActorId = activeDragId || state.selectedObjectId;
    const actor = activeActorId ? findObjectById(activeActorId) : null;
    const validDrop = Boolean(actor && obj && isValidDropCandidate(actor, obj));

    return {
        hitId: hit.interactId,
        label: obj?.label || hit.interactId,
        role: validDrop ? 'drop' : obj?.isDraggable ? 'draggable' : 'target',
        objectType: obj?.type || null,
        isCuvette: hit.interactId === 'cuvette',
        isDraggable: Boolean(obj?.isDraggable),
        isDropTarget: Boolean(obj?.isDropTarget),
        isValidDrop: validDrop,
        isHighlighted: (state.highlights || []).includes(hit.interactId),
        isButton: false,
        selectedObjectId: state.selectedObjectId || null,
        activeDragId: activeDragId || null,
    };
}

export function handleVirtualPointerDown(clientX, clientY) {
    let targetX = clientX;
    let targetY = clientY;
    // If spatial cursor is within proximity of a draggable pipette/cuvette or Spec button, snap down onto its exact screen center!
    if (setNdcFromClient(clientX, clientY) && !raycastScene(null, true)) {
        const state = getState();
        const candidates = ['pipette_stock', 'pipette_water', 'pipette_unknown', 'cuvette', 'btn_zero', 'btn_measure', 'btn_mode'];
        const nearId = findNearestScreenTarget(clientX, clientY, candidates, 48, state.highlights || []);
        if (nearId) {
            const pt = getScreenPoint(nearId);
            if (pt) {
                targetX = pt.x;
                targetY = pt.y;
            }
        }
    }
    onPointerDown({ button: 0, clientX: targetX, clientY: targetY, isVirtualHand: true });
    return {
        captured: Boolean(pressedObjId || pressedSpecButton || pressedTargetId),
        pressedObjId,
        pressedSpecButton,
        pressedTargetId,
    };
}

export function handleVirtualPointerMove(clientX, clientY) {
    onPointerMove({ clientX, clientY, isVirtualHand: true });
    return {
        isDragging: Boolean(activeDragId),
        activeDragId,
        currentDropHoverId,
        hoverInfo: inspectAtClientPoint(clientX, clientY),
    };
}

export function handleVirtualPointerUp(clientX, clientY) {
    onPointerUp({ button: 0, clientX, clientY, isVirtualHand: true });
}

export function cancelVirtualPointer() {
    if (!pointerDown && !activeDragId) return;
    const dom = getDomElement();
    const controls = getControls();
    if (controls) controls.enabled = true;
    if (dom) {
        dom.classList.remove('viewport--dragging');
        dom.style.cursor = 'default';
    }
    pointerDown = false;
    pointerMoved = false;
    pressedObjId = null;
    pressedSpecButton = null;
    pressedTargetId = null;
    activeDragId = null;
    currentDropHoverId = null;
    setDragVisualState(null, null, null);
    setStateVariable('isDragging', false);
    setStateVariable('draggedObject', null);
}

const _orbitOffset = new THREE.Vector3();
const _orbitSpherical = new THREE.Spherical();

export function orbitCameraByDelta(dxNorm, dyNorm) {
    const cam = getCamera();
    const controls = getControls();
    if (!cam || !controls) return;
    // Smooth, weighty, clamped angular rate (prevents jitter or abrupt camera whipping during hand-pinch orbit!)
    const dTheta = Math.max(-0.045, Math.min(0.045, dxNorm * 1.28));
    const dPhi = Math.max(-0.032, Math.min(0.032, dyNorm * 0.88));
    _orbitOffset.copy(cam.position).sub(controls.target);
    _orbitSpherical.setFromVector3(_orbitOffset);
    _orbitSpherical.theta -= dTheta;
    _orbitSpherical.phi = Math.max(
        controls.minPolarAngle || 0.14,
        Math.min(controls.maxPolarAngle || Math.PI * 0.47, _orbitSpherical.phi - dPhi)
    );
    _orbitOffset.setFromSpherical(_orbitSpherical);
    cam.position.copy(controls.target).add(_orbitOffset);
    cam.lookAt(controls.target);
    controls.update();
}

export function zoomCameraByScale(scaleFactor) {
    const cam = getCamera();
    const controls = getControls();
    if (!cam || !controls || !Number.isFinite(scaleFactor) || scaleFactor <= 0) return;
    _orbitOffset.copy(cam.position).sub(controls.target);
    const curDist = _orbitOffset.length();
    const minD = controls.minDistance || 0.28;
    const maxD = controls.maxDistance || 1.85;
    const nextDist = Math.max(minD, Math.min(maxD, curDist * scaleFactor));
    _orbitOffset.setLength(nextDist);
    cam.position.copy(controls.target).add(_orbitOffset);
    controls.update();
}
