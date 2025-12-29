// main.js - Application entry point and orchestration

import { initializeState, getState, popHistory, restoreState } from './state.js';
import { initializeUI, updateUI, showFeedback, buildStepTracker } from './ui.js';
import { initializeInteraction, setupNativeDrag, setupPointerDrag, refreshShelf } from './interaction.js';
import * as actions from './actions.js';
import * as GFX from './graphics.js';
import { initLanguage, setLanguage, getCurrentLang, t } from './i18n/i18n.js';

// Make GFX available globally for shelf icons
window.GFX = GFX;

// =============================================
// APPLICATION CLASS
// =============================================

class BrassLabApp {
    constructor() {
        this.workbench = document.getElementById('workbench');
        this.shelf = document.getElementById('shelf');
        this.undoBtn = document.getElementById('undo-btn');
        this.ffBtn = document.getElementById('ff-btn');
        this.toggleBtn = document.getElementById('toggle-steps');
        this.stepTrackerPanel = document.getElementById('step-tracker');
        this.stepList = document.getElementById('step-list');
        this.langSelect = document.getElementById('lang-select');

        this.init();
    }

    async init() {
        // Initialize i18n first
        await initLanguage();

        // Set language selector to saved value
        if (this.langSelect) {
            this.langSelect.value = getCurrentLang();
        }

        // Initialize state
        initializeState();

        // Initialize UI
        initializeUI();

        // Build step tracker
        if (this.stepList) {
            buildStepTracker(this.stepList);
        }

        // Initialize interaction handlers
        initializeInteraction(this.workbench, this.shelf);

        // Setup control buttons
        this.setupControls();

        // Setup language selector
        this.setupLanguageSelector();

        // Listen for language changes
        document.addEventListener('languageChanged', () => {
            this.updateHTMLTranslations();

            // Rebuild step tracker with translated instructions
            if (this.stepList) {
                buildStepTracker(this.stepList);
            }

            // Refresh shelf equipment labels
            refreshShelf();

            updateUI();
        });

        // Setup draggable panels
        this.setupDraggablePanel();
        this.setupDraggableNotebook();

        // Update HTML translations
        this.updateHTMLTranslations();

        // Initial UI update
        updateUI();

        console.log('Brass Lab initialized');
    }

    setupLanguageSelector() {
        if (this.langSelect) {
            this.langSelect.addEventListener('change', async (e) => {
                await setLanguage(e.target.value);
            });
        }
    }

    updateHTMLTranslations() {
        // Update static HTML elements
        const sidebarHeader = document.querySelector('.sidebar-header');
        if (sidebarHeader) sidebarHeader.textContent = t('ui.labEquipment');

        const labTitle = document.querySelector('.lab-title');
        if (labTitle) labTitle.textContent = t('ui.brassLab');

        const nbHeader = document.querySelector('.nb-header span');
        if (nbHeader) nbHeader.textContent = t('ui.labNotebook');

        // Notebook sections
        const sampleDataLabel = document.querySelector('.nb-body > p:first-of-type strong');
        if (sampleDataLabel) sampleDataLabel.textContent = t('ui.sampleData');

        const spectroLabel = document.querySelector('.nb-body > p:nth-of-type(2) strong');
        if (spectroLabel) spectroLabel.textContent = t('ui.spectrophotometry');

        // Update table headers
        const tableHeaders = document.querySelectorAll('#nb-table thead th');
        if (tableHeaders.length >= 2) {
            tableHeaders[0].textContent = t('ui.sample');
            tableHeaders[1].textContent = t('ui.abs');
        }

        // Calibration curve label
        const graphLabel = document.querySelector('#graph-area > p');
        if (graphLabel) graphLabel.textContent = t('ui.calibrationCurve');

        // Cleanup checklist
        const cleanupTitle = document.querySelector('#cleaning-area > p');
        if (cleanupTitle) cleanupTitle.textContent = t('ui.cleanupChecklist');

        const cleanupLabels = document.querySelectorAll('#cleaning-area label');
        const cleanupItems = ['cleanupItem1', 'cleanupItem2', 'cleanupItem3', 'cleanupItem4'];
        cleanupLabels.forEach((label, i) => {
            if (cleanupItems[i]) {
                const checkbox = label.querySelector('input');
                if (checkbox) {
                    label.innerHTML = '';
                    label.appendChild(checkbox);
                    label.appendChild(document.createTextNode(' ' + t(`ui.${cleanupItems[i]}`)));
                }
            }
        });

        const cleanupBtn = document.querySelector('#cleaning-area .btn');
        if (cleanupBtn) cleanupBtn.textContent = t('ui.completeCleanup');

        // Calculation area
        const calcLabel = document.querySelector('#result-area label');
        if (calcLabel) calcLabel.textContent = t('ui.calcMassPercent');

        const hintBtn = document.querySelector('.btn-hint');
        if (hintBtn) {
            const hint = document.getElementById('formula-hint');
            hintBtn.textContent = hint?.style.display === 'none' ? t('ui.showHint') : t('ui.hideHint');
        }

        const formulaHint = document.getElementById('formula-hint');
        if (formulaHint) {
            formulaHint.innerHTML = `<strong>${t('ui.formulaTitle')}</strong><br>${t('ui.formulaConc')}<br>${t('ui.formulaMass')}`;
        }

        const checkBtn = document.querySelector('#result-area .btn:not(.btn-hint)');
        if (checkBtn) checkBtn.textContent = t('ui.check');

        const calcInput = document.getElementById('user-calc');
        if (calcInput) calcInput.placeholder = t('ui.percentPlaceholder');

        // Button titles
        if (this.undoBtn) this.undoBtn.title = t('ui.undo');
        if (this.ffBtn) this.ffBtn.title = t('ui.autoForward');
        if (this.toggleBtn) this.toggleBtn.title = t('ui.toggleList');

        // Page title
        document.title = t('ui.pageTitle');
    }

    setupControls() {
        // Undo button
        if (this.undoBtn) {
            this.undoBtn.addEventListener('click', () => this.undo());
        }

        // Forward/Auto-step button
        if (this.ffBtn) {
            this.ffBtn.addEventListener('click', () => this.autoStep());
        }

        // Toggle step list button
        if (this.toggleBtn && this.stepList) {
            this.toggleBtn.addEventListener('click', () => this.toggleStepList());
        }
    }

    toggleStepList() {
        if (this.stepList) {
            this.stepList.classList.toggle('collapsed');
            this.stepTrackerPanel?.classList.toggle('collapsed');
        }
    }

    setupDraggablePanel() {
        const panel = this.stepTrackerPanel;
        if (!panel) return;

        const header = panel.querySelector('.step-tracker-header');
        if (!header) return;

        let isDragging = false;
        let startX, startY, initialX, initialY;

        // Make panel absolutely positioned for dragging
        const initPosition = () => {
            if (panel.style.position !== 'absolute') {
                const rect = panel.getBoundingClientRect();
                const parentRect = panel.parentElement.getBoundingClientRect();
                panel.style.position = 'absolute';
                panel.style.left = (rect.left - parentRect.left) + 'px';
                panel.style.top = (rect.top - parentRect.top) + 'px';
                panel.style.margin = '0';
            }
        };

        header.style.cursor = 'grab';

        header.addEventListener('mousedown', (e) => {
            // Don't drag if clicking on buttons or language selector
            if (e.target.closest('.icon-btn') || e.target.closest('.lang-select')) return;

            initPosition();
            isDragging = true;
            panel.classList.add('dragging');

            startX = e.clientX;
            startY = e.clientY;
            initialX = parseInt(panel.style.left) || 0;
            initialY = parseInt(panel.style.top) || 0;

            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            panel.style.left = (initialX + dx) + 'px';
            panel.style.top = (initialY + dy) + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                panel.classList.remove('dragging');
            }
        });
    }

    setupDraggableNotebook() {
        const notebook = document.getElementById('notebook');
        if (!notebook) return;

        const header = notebook.querySelector('.nb-header');
        if (!header) return;

        let isDragging = false;
        let startX, startY, initialX, initialY;

        const initPosition = () => {
            if (notebook.style.position !== 'absolute') {
                const rect = notebook.getBoundingClientRect();
                const parentRect = notebook.parentElement.getBoundingClientRect();
                notebook.style.position = 'absolute';
                notebook.style.left = (rect.left - parentRect.left) + 'px';
                notebook.style.top = (rect.top - parentRect.top) + 'px';
                notebook.style.margin = '0';
            }
        };

        header.style.cursor = 'grab';

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            initPosition();
            isDragging = true;
            notebook.classList.add('dragging');
            startX = e.clientX;
            startY = e.clientY;
            initialX = parseInt(notebook.style.left) || 0;
            initialY = parseInt(notebook.style.top) || 0;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            notebook.style.left = (initialX + e.clientX - startX) + 'px';
            notebook.style.top = (initialY + e.clientY - startY) + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                notebook.classList.remove('dragging');
            }
        });
    }

    undo() {
        const snapshot = popHistory();
        if (snapshot) {
            restoreState(snapshot);
            showFeedback(t('messages.undoSuccessful'), 'info');
            updateUI();
        } else {
            showFeedback(t('messages.nothingToUndo'), 'info');
        }
    }

    autoStep() {
        // Auto-complete current step for debugging/demo
        const state = getState();
        const step = state.currentStep;

        // Map steps to auto actions
        this.performAutoStep(step);
    }

    performAutoStep(stepIdx) {
        const state = getState();

        // Helper to ensure equipment exists
        const ensure = (type, x, y) => {
            let obj = state.labObjects.find(o => o.type === type || o.props?.sourceType === type);
            if (!obj) {
                actions.tryPlaceEquipment(type, x, y);
                return state.labObjects[state.labObjects.length - 1];
            }
            return obj;
        };

        switch (stepIdx) {
            case 0: // Balance
                actions.tryPlaceEquipment('balance', 420, 360);
                break;
            case 1: // Brass
                actions.tryPlaceEquipment('brass', 300, 300);
                break;
            case 2: // Weigh brass
                const brass = state.labObjects.find(o => o.type === 'brass');
                const balance = state.labObjects.find(o => o.type === 'balance');
                if (brass && balance) {
                    actions.tryWeighBrass(brass.id, balance.id);
                }
                break;
            case 3: // Beaker
                actions.tryPlaceEquipment('beaker', 360, 280);
                break;
            case 4: // Transfer brass
                const brass2 = state.labObjects.find(o => o.type === 'brass');
                const beaker = state.labObjects.find(o => o.type === 'beaker');
                if (brass2 && beaker) {
                    actions.tryTransferBrass(brass2.id, beaker.id);
                }
                break;
            // Add more auto-steps as needed for debugging
            default:
                showFeedback(`Auto-step not implemented for step ${stepIdx}`, 'info');
        }
    }
}

// =============================================
// GLOBAL HANDLERS
// =============================================

// Toggle spec lid (called from SVG onclick)
window.toggleLid = function() {
    const state = getState();
    import('./state.js').then(stateModule => {
        stateModule.updateSpecState('open', !state.specState.open);

        // If closing with cuvette and calibrated, this might trigger measure
        if (!state.specState.open && state.specState.hasCuvette && state.specState.isCalibrated) {
            const stepConfig = import('./instructions.js').then(inst => {
                const cfg = inst.getStepConfig(state.currentStep);
                if (cfg?.action === 'measure') {
                    actions.tryMeasure();
                }
            });
        }

        updateUI();
    });
};

// Calibrate spec (called from SVG onclick)
window.calibrate = function() {
    actions.tryCalibrateSpec();
};

// Check result (called from notebook)
window.checkResult = function() {
    const input = document.getElementById('user-calc');
    if (!input) return;

    const userAnswer = parseFloat(input.value);
    if (isNaN(userAnswer)) {
        showFeedback(t('messages.enterNumeric'), 'error');
        return;
    }

    actions.trySubmitCalculation(userAnswer);
};

// Submit cleaning checklist (called from notebook)
window.submitCleaningChecklist = function() {
    actions.tryCleaningChecklist();
};

// Toggle formula hint (called from notebook)
window.toggleFormulaHint = function() {
    const hint = document.getElementById('formula-hint');
    const btn = document.querySelector('.btn-hint');
    if (hint.style.display === 'none') {
        hint.style.display = 'block';
        btn.textContent = t('ui.hideHint');
    } else {
        hint.style.display = 'none';
        btn.textContent = t('ui.showHint');
    }
};

// =============================================
// CLEANUP CHECKLIST ANIMATIONS
// =============================================

// Track if handlers have been initialized to prevent duplicates
let cleanupHandlersInitialized = false;

// Initialize cleanup checkbox handlers
window.initCleanupHandlers = function() {
    if (cleanupHandlersInitialized) return;

    const checkboxes = document.querySelectorAll('.cleanup-item');
    checkboxes.forEach((cb, index) => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) {
                handleCleanupAction(index);
            }
        });
    });

    cleanupHandlersInitialized = true;
};

function handleCleanupAction(index) {
    switch(index) {
        case 0: // Discard liquid from cuvettes
            animateEmptyCuvettes();
            break;
        case 1: // Rinse cuvettes (visual feedback only)
            showFeedback(t('messages.cuvettesRinsed'), 'info');
            break;
        case 2: // Discard pipettes
            animateDisposePipettes();
            break;
        case 3: // Wash hands (no visual action)
            showFeedback(t('messages.handsWashed'), 'info');
            break;
    }
}

function animateEmptyCuvettes() {
    import('./state.js').then(stateModule => {
        const state = stateModule.getState();
        const cuvettes = state.labObjects.filter(o => o.type === 'cuvette' && !o.props.inSpec);
        const rack = state.labObjects.find(o => o.type === 'rack');

        if (!rack || cuvettes.length === 0) {
            showFeedback(t('messages.noCuvettesToEmpty'), 'info');
            return;
        }

        showFeedback(t('messages.emptyingCuvettes'), 'info');

        // Stack cuvettes in a row next to the rack
        cuvettes.forEach((cuvette, i) => {
            setTimeout(() => {
                // Empty the cuvette
                stateModule.updateLabObject(cuvette.id, 'props.vol', 0);
                stateModule.updateLabObject(cuvette.id, 'props.color', 'transparent');

                // Position in a row next to rack (30px spacing)
                const stackX = rack.x + 100 + (i * 30);
                const stackY = rack.y + 40;
                stateModule.updateLabObject(cuvette.id, 'x', stackX);
                stateModule.updateLabObject(cuvette.id, 'y', stackY);

                updateUI();

                // Show completion message on last cuvette
                if (i === cuvettes.length - 1) {
                    showFeedback(t('messages.cuvetteEmptied'), 'success');
                }
            }, i * 300); // 300ms delay between each cuvette
        });
    });
}

function animateDisposePipettes() {
    import('./state.js').then(stateModule => {
        const state = stateModule.getState();
        const pipettes = state.labObjects.filter(o => o.type === 'pipette');
        const waste = state.labObjects.find(o => o.type === 'waste');

        if (!waste) {
            showFeedback(t('messages.noWasteBeaker'), 'error');
            return;
        }

        if (pipettes.length === 0) {
            showFeedback(t('messages.noPipettesToDispose'), 'info');
            return;
        }

        showFeedback(t('messages.disposingPipettes'), 'info');

        pipettes.forEach((pipette, i) => {
            setTimeout(() => {
                // Store pipette info in waste beaker
                const pipetteInfo = {
                    serial: pipette.props.serial,
                    assignment: pipette.props.assignedTo,
                    color: pipette.props.color || 'transparent'
                };

                const currentWaste = stateModule.findObjectById(waste.id);
                const disposedPipettes = [...(currentWaste.props.disposedPipettes || []), pipetteInfo];
                stateModule.updateLabObject(waste.id, 'props.disposedPipettes', disposedPipettes);

                // Remove pipette from workbench
                stateModule.removeLabObject(pipette.id);
                stateModule.updateEquipmentCount('pipette', -1);

                updateUI();

                // Show completion message on last pipette
                if (i === pipettes.length - 1) {
                    showFeedback(t('messages.pipetteDisposed'), 'success');
                }
            }, i * 300); // 300ms delay between each pipette
        });
    });
}

// DEBUG: Test calculation without redoing steps
// Usage in console: testCalc() or testCalc(76.2)
window.testCalc = function(userAnswer) {
    import('./config.js').then(config => {
        const state = getState();
        const brassMass = state.notebookData.brassMass || 1.431;
        const unknownMeasurement = state.notebookData.measurements.find(m => m.sample === 'Unknown');
        const absorbance = unknownMeasurement?.absorbance || 0.411;

        const concentration = config.calculateConcentration(absorbance);
        const expectedPercent = config.calculateMassPercent(concentration, brassMass);

        console.log('=== CALCULATION DEBUG ===');
        console.log('Brass Mass:', brassMass, 'g');
        console.log('Unknown Absorbance:', absorbance);
        console.log('Y_INTERCEPT:', config.Y_INTERCEPT);
        console.log('MOLAR_ABSORPTIVITY (slope):', config.MOLAR_ABSORPTIVITY);
        console.log('Concentration:', concentration.toFixed(4), 'M');
        console.log('Expected Mass % Cu:', expectedPercent.toFixed(2), '%');
        console.log('========================');

        if (userAnswer !== undefined) {
            const diff = Math.abs(userAnswer - expectedPercent);
            console.log('Your answer:', userAnswer);
            console.log('Difference:', diff.toFixed(2));
            console.log('Within tolerance (±2)?', diff <= 2 ? 'YES ✓' : 'NO ✗');
        }

        return expectedPercent;
    });
};

// =============================================
// INITIALIZATION
// =============================================

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BrassLabApp();
});
