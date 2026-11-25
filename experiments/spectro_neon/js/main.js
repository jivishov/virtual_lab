// main.js - 3D Photorealistic Spectrophotometry Simulation, Dual-Theme Manager & Scaffolded Studio Entry Point
import * as config from './config.js';
import * as state from './state.js';
import * as actions from './actions.js?v=12';
import * as ui from './ui.js?v=11';
import * as graph from './graph.js?v=11';
import * as edu from './edu.js?v=12';
import * as audio from './audio.js?v=9';
import instructions from './instructions.js';
import {
    initScene3D,
    syncSceneFromState,
    triggerActionEffect,
    setCameraPreset,
    setLabelsVisible,
    getLabelsVisible,
    getScreenPoint,
    getObject3D,
} from './scene3d.js?v=16';
import {
    initInteraction3D,
    handleUndoClick,
    handleResetClick,
    inspectAtClientPoint,
    handleVirtualPointerDown,
    handleVirtualPointerMove,
    handleVirtualPointerUp,
    cancelVirtualPointer,
    orbitCameraByDelta,
    zoomCameraByScale,
} from './interaction3d.js?v=22';
import {
    initHandGestures,
    startHandGestures,
    stopHandGestures,
    toggleHandGestures,
    startVirtualHandMode,
    getHandGestureStatus,
    feedSyntheticHand,
} from './handGestures.js?v=3';
import {
    initVoiceAssistant,
    speakNatural,
    stopSpeaking,
    isVoiceSpeaking,
    toggleVoiceListening,
    stopVoiceListening,
    handleVoiceTranscript,
    getVoiceStatus,
} from './voiceAssistant.js?v=1';

document.addEventListener('DOMContentLoaded', async () => {
    const getEl = (id) => document.getElementById(id);

    const simulationAreaEl = getEl('simulation-area');
    const viewportEl = getEl('viewport-3d');
    const labelsEl = getEl('labels-overlay');
    const loadingEl = getEl('loading-overlay');
    const loadingBarEl = getEl('loading-bar-fill');
    const loadingPctEl = getEl('loading-pct');

    const instructionEl = getEl('instruction-text');
    const stepBadgeEl = getEl('step-badge');
    const progressFillEl = getEl('progress-fill');
    const feedbackEl = getEl('stage-feedback') || document.querySelector('.feedback');
    const resultsTbody = getEl('results-tbody');
    const slopeDisplayEl = getEl('slope-display');
    const unknownResultEl = getEl('unknown-result');
    const undoButton = getEl('undo-button');
    const resetButton = getEl('reset-button');
    const focusStepBtn = getEl('focus-step-btn');
    const demoStepBtn = getEl('demo-step-btn');
    const whyToggleBtn = getEl('why-toggle-btn');
    const insightDrawerEl = getEl('insight-drawer');
    const graphCanvas = getEl('graph-canvas');
    const hoverInfoEl = getEl('hover-info');
    const specQuickReadoutEl = getEl('spec-quick-readout');
    const specLedZeroEl = getEl('spec-led-zero');
    const specLedCuvEl = getEl('spec-led-cuv');
    const labelsToggleBtn = getEl('labels-toggle-btn');
    const xrayToggleBtn = getEl('xray-toggle-btn');
    const soundToggleBtn = getEl('sound-toggle-btn');
    const soundIconOn = getEl('sound-icon-on');
    const soundIconOff = getEl('sound-icon-off');
    const theaterToggleBtn = getEl('theater-toggle-btn');
    const pipOpticsCard = getEl('pip-optics-card');
    const dataPanelEl = getEl('data-panel');
    const graphPanelEl = getEl('graph-panel');
    const studioDockEl = getEl('studio-dock');
    const studioCollapseBtn = getEl('studio-collapse-btn');
    const studioCollapseLabel = getEl('studio-collapse-label');
    const studioCollapseIcon = getEl('studio-collapse-icon');

    const themeLightBtn = getEl('theme-light-btn');
    const themeDarkBtn = getEl('theme-dark-btn');
    const scaffoldGuidedBtn = getEl('scaffold-guided-btn');
    const scaffoldChallengeBtn = getEl('scaffold-challenge-btn');
    const helpToggleBtn = getEl('help-toggle-btn');
    const helpModal = getEl('help-modal');
    const closeHelpBtn = getEl('close-help-btn');
    const helpDoneBtn = getEl('help-done-btn');

    // Immersive Mode & Hand Gesture DOM references
    const immersiveToggleBtn = getEl('immersive-toggle-btn');
    const immersiveToggleLabel = getEl('immersive-toggle-label');
    const immIconEnter = getEl('imm-icon-enter');
    const immIconExit = getEl('imm-icon-exit');
    const gestureToggleBtn = getEl('gesture-toggle-btn');

    const immProcEl = getEl('immersive-procedure-hud');
    const immPhaseLabelEl = getEl('imm-phase-label');
    const immStepBadgeEl = getEl('imm-step-badge');
    const immInstructionEl = getEl('imm-instruction-text');
    const immProgressFillEl = getEl('imm-progress-fill');
    const immSpeakBtn = getEl('imm-speak-btn');
    const immMicBtn = getEl('imm-mic-btn');
    const immWhyBtn = getEl('imm-why-btn');
    const immWhySpeakBtn = getEl('imm-why-speak-btn');
    const immWhyStripEl = getEl('imm-why-strip');
    const immCoachTagEl = getEl('imm-coach-tag');
    const immCoachTipEl = getEl('imm-coach-tip');
    const immCoachFormulaEl = getEl('imm-coach-formula');
    const immStepsBtn = getEl('imm-steps-btn');
    const immDemoBtn = getEl('imm-demo-btn');
    const immFocusBtn = getEl('imm-focus-btn');
    const immUndoBtn = getEl('imm-undo-btn');
    const immMinimizeBtn = getEl('imm-minimize-btn');

    const immDrawerEl = getEl('imm-steps-drawer');
    const immDrawerTabSteps = getEl('imm-drawer-tab-steps');
    const immDrawerTabData = getEl('imm-drawer-tab-data');
    const immDrawerClose = getEl('imm-drawer-close');
    const immDrawerStepsPane = getEl('imm-drawer-steps-pane');
    const immDrawerDataPane = getEl('imm-drawer-data-pane');
    const immDrawerPhasesEl = getEl('imm-drawer-phases');
    const immStepsListEl = getEl('imm-steps-list');
    const immDataTbodyEl = getEl('imm-data-tbody');
    const immDataCountEl = getEl('imm-data-count');
    const immDataSummaryEl = getEl('imm-data-summary');

    const IMM_PHASES = [
        { num: 1, label: 'Dilutions', start: 0, end: 19 },
        { num: 2, label: 'Blank', start: 20, end: 27 },
        { num: 3, label: 'Standards', start: 28, end: 75 },
        { num: 4, label: 'Curve', start: 76, end: 76 },
        { num: 5, label: 'Unknown', start: 77, end: 83 },
    ];

    let immersiveActive = false;
    let gesturesActive = false;
    let enteredNativeFullscreen = false;
    let immDrawerOpen = false;
    let immDrawerTab = 'steps';
    let immMinimized = false;
    let immWhyOpen = false;
    let immStepsBuiltMode = null;

    let isBootingAutoMode = false;
    const syncAetherMode = (withSound = true) => {
        const shouldBeAether = immersiveActive && gesturesActive;
        const wasAether = document.body.classList.contains('aether-mode');
        document.body.classList.toggle('aether-mode', shouldBeAether);
        if (shouldBeAether && !wasAether && withSound && !isBootingAutoMode) {
            audio.playLabSound('themeSwitch');
        }
    };

    const buildImmersiveStepsList = (isChallenge) => {
        if (!immStepsListEl) return;
        immStepsListEl.innerHTML = '';
        const totalActionable = instructions.length - 1;
        for (let i = 0; i < totalActionable; i++) {
            const item = instructions[i];
            const li = document.createElement('li');
            li.className = 'imm-step-item';
            li.dataset.stepIndex = String(i);
            const cleanTxt = String(item.text || '').replace(/<[^>]+>/g, '');
            li.innerHTML = `<span class="imm-step-item__num">${i + 1}</span><span class="imm-step-item__txt">${isChallenge ? `Step ${i + 1} (Challenge Mode)` : cleanTxt}</span>`;
            immStepsListEl.appendChild(li);
        }
        immStepsBuiltMode = isChallenge ? 'challenge' : 'guided';
    };

    const syncImmersiveHud = () => {
        const st = state.getState();
        const totalActionable = instructions.length - 1;
        const curStep = st.currentStep;
        const pct = Math.min(100, Math.round((curStep / totalActionable) * 100));

        // 1. Active phase pill
        const activePhase =
            IMM_PHASES.find((p) => curStep >= p.start && curStep <= p.end) || IMM_PHASES[IMM_PHASES.length - 1];
        if (immPhaseLabelEl && activePhase) {
            immPhaseLabelEl.textContent = `${activePhase.num} · ${activePhase.label}`;
        }

        // 2. Step badge, progress rail & instruction text (including Challenge Mode Peek button)
        if (immStepBadgeEl && stepBadgeEl) {
            immStepBadgeEl.textContent = stepBadgeEl.textContent;
            immStepBadgeEl.classList.toggle('imm-proc__step--done', curStep >= totalActionable);
        }
        if (immProgressFillEl) {
            immProgressFillEl.style.width = `${pct}%`;
        }
        if (immInstructionEl && instructionEl) {
            immInstructionEl.innerHTML = instructionEl.innerHTML;
            const peekBtn = immInstructionEl.querySelector('[data-peek-step]');
            if (peekBtn) peekBtn.addEventListener('click', ui.peekChallengeStep);
        }

        // 3. Chemistry "Why?" strip mirror
        const srcTag = getEl('coach-tag');
        const srcTip = getEl('coach-tip');
        const srcFormula = getEl('coach-formula');
        if (immCoachTagEl && srcTag) immCoachTagEl.textContent = srcTag.textContent;
        if (immCoachTipEl && srcTip) immCoachTipEl.textContent = srcTip.textContent;
        if (immCoachFormulaEl && srcFormula) immCoachFormulaEl.textContent = srcFormula.textContent;

        // 4. Action button parity
        if (immUndoBtn && undoButton) immUndoBtn.disabled = undoButton.disabled;
        if (immDemoBtn && demoStepBtn) immDemoBtn.style.display = demoStepBtn.style.display;

        // 5. Measured count badge
        const measuredCount = st.dataTableData.filter((r) => r.measuredPercentT !== null).length;
        if (immDataCountEl) immDataCountEl.textContent = `${measuredCount}/${st.dataTableData.length}`;

        // 6. Side Drawer: 5-phase rail + Checklist + Live Data mini-table
        if (immDrawerPhasesEl) {
            immDrawerPhasesEl.innerHTML = IMM_PHASES.map((p) => {
                const isDone = curStep > p.end;
                const isAct = curStep >= p.start && curStep <= p.end;
                const cls = isDone ? 'imm-phase-chip--done' : isAct ? 'imm-phase-chip--active' : '';
                return `<div class="imm-phase-chip ${cls}"><span>${isDone ? '✓' : p.num}</span><span>${p.label}</span></div>`;
            }).join('');
        }

        const isChallenge = ui.getScaffoldMode() === 'challenge';
        if (immStepsListEl) {
            if (immStepsBuiltMode !== (isChallenge ? 'challenge' : 'guided')) {
                buildImmersiveStepsList(isChallenge);
            }
            const items = immStepsListEl.children;
            for (let i = 0; i < items.length; i++) {
                const li = items[i];
                const isDone = i < curStep;
                const isCur = i === curStep;
                li.classList.toggle('imm-step-item--done', isDone);
                li.classList.toggle('imm-step-item--current', isCur);
                const numEl = li.querySelector('.imm-step-item__num');
                if (numEl) numEl.textContent = isDone ? '✓' : String(i + 1);
                if (isChallenge && isDone) {
                    const txtEl = li.querySelector('.imm-step-item__txt');
                    if (txtEl && instructions[i]) {
                        txtEl.textContent = String(instructions[i].text || '').replace(/<[^>]+>/g, '');
                    }
                }
            }
            if (immDrawerOpen && immDrawerTab === 'steps') {
                const curLi = items[Math.min(curStep, items.length - 1)];
                if (curLi && typeof curLi.scrollIntoView === 'function') {
                    curLi.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
            }
        }

        if (immDataTbodyEl) {
            immDataTbodyEl.innerHTML = st.dataTableData
                .map((row) => {
                    const isMeasured = row.measuredPercentT !== null;
                    let concTxt = row.conc !== null ? row.conc.toFixed(2) : '—';
                    let absTxt = '—';
                    if (row.id === 'unknown' && row.negLogT !== null && isFinite(row.negLogT) && config.KNOWN_SLOPE > 0) {
                        concTxt = (row.negLogT / config.KNOWN_SLOPE).toFixed(3);
                        absTxt = parseFloat(row.negLogT).toFixed(4);
                    } else if (row.negLogT !== null && isFinite(row.negLogT)) {
                        absTxt = parseFloat(row.negLogT).toFixed(4);
                    }
                    const pctTxt = isMeasured ? `${row.measuredPercentT}%` : '—';
                    return `<tr class="${isMeasured ? 'imm-data-row--measured' : ''}"><td>${row.solution}</td><td>${concTxt}</td><td>${pctTxt}</td><td>${absTxt}</td></tr>`;
                })
                .join('');
        }

        if (immDataSummaryEl) {
            const unk = st.dataTableData.find((r) => r.id === 'unknown');
            if (unk && unk.negLogT !== null && isFinite(unk.negLogT)) {
                const c = parseFloat(unk.negLogT) / config.KNOWN_SLOPE;
                immDataSummaryEl.innerHTML = `<strong>Slope m:</strong> ${config.KNOWN_SLOPE} Abs/µM<br><strong>Unknown Drink:</strong> ${c.toFixed(3)} µM (A = ${parseFloat(unk.negLogT).toFixed(4)})`;
            } else if (measuredCount > 0) {
                immDataSummaryEl.innerHTML = `<strong>${measuredCount} / 7</strong> samples measured at λ = 630 nm. Continue through standards to lock Beer-Lambert slope.`;
            } else {
                immDataSummaryEl.textContent = 'Measure standards in Spec 20D+ to see live slope & unknown calculation here.';
            }
        }
    };

    const setImmersiveWhyOpen = (open) => {
        immWhyOpen = Boolean(open);
        if (immWhyStripEl) immWhyStripEl.hidden = !immWhyOpen;
        if (immWhyBtn) {
            immWhyBtn.classList.toggle('imm-proc__btn--active', immWhyOpen);
            immWhyBtn.setAttribute('aria-expanded', immWhyOpen ? 'true' : 'false');
        }
        document.body.classList.toggle('imm-why-open', immWhyOpen && !immMinimized);
    };

    const setImmersiveMinimized = (minimized) => {
        immMinimized = Boolean(minimized);
        if (immProcEl) immProcEl.classList.toggle('imm-proc--minimized', immMinimized);
        document.body.classList.toggle('imm-proc-min', immMinimized);
        document.body.classList.toggle('imm-why-open', immWhyOpen && !immMinimized);
        if (immMinimizeBtn) {
            immMinimizeBtn.setAttribute('aria-expanded', immMinimized ? 'false' : 'true');
            immMinimizeBtn.title = immMinimized ? 'Expand procedure bar' : 'Minimize procedure bar for pure view';
        }
    };

    const setImmersiveDrawerTab = (tab) => {
        immDrawerTab = tab === 'data' ? 'data' : 'steps';
        if (immDrawerTabSteps) {
            immDrawerTabSteps.classList.toggle('imm-drawer__tab--active', immDrawerTab === 'steps');
            immDrawerTabSteps.setAttribute('aria-selected', immDrawerTab === 'steps' ? 'true' : 'false');
        }
        if (immDrawerTabData) {
            immDrawerTabData.classList.toggle('imm-drawer__tab--active', immDrawerTab === 'data');
            immDrawerTabData.setAttribute('aria-selected', immDrawerTab === 'data' ? 'true' : 'false');
        }
        if (immDrawerStepsPane) immDrawerStepsPane.hidden = immDrawerTab !== 'steps';
        if (immDrawerDataPane) immDrawerDataPane.hidden = immDrawerTab !== 'data';
        if (immDrawerOpen && immDrawerTab === 'steps') {
            syncImmersiveHud();
        }
    };

    const setImmersiveDrawerOpen = (open) => {
        immDrawerOpen = Boolean(open);
        document.body.classList.toggle('imm-drawer-open', immDrawerOpen && immersiveActive);
        if (immDrawerEl) {
            immDrawerEl.classList.toggle('imm-drawer--open', immDrawerOpen);
            immDrawerEl.setAttribute('aria-hidden', immDrawerOpen ? 'false' : 'true');
        }
        if (immStepsBtn) {
            immStepsBtn.classList.toggle('imm-proc__btn--active', immDrawerOpen);
            immStepsBtn.setAttribute('aria-expanded', immDrawerOpen ? 'true' : 'false');
        }
        if (immDrawerOpen) syncImmersiveHud();
    };

    const dispatchStageResizeBurst = () => {
        window.dispatchEvent(new Event('resize'));
        setTimeout(() => window.dispatchEvent(new Event('resize')), 140);
        setTimeout(() => window.dispatchEvent(new Event('resize')), 320);
    };

    const setImmersiveMode = (enabled, requestNativeFs = true) => {
        const next = Boolean(enabled);
        if (next === immersiveActive) return;
        immersiveActive = next;
        document.body.classList.toggle('immersive-mode', immersiveActive);

        if (immersiveToggleBtn) {
            immersiveToggleBtn.setAttribute('aria-pressed', immersiveActive ? 'true' : 'false');
            immersiveToggleBtn.title = immersiveActive
                ? 'Exit Full-Screen Immersive Mode (Key: F or Esc)'
                : 'Enter Full-Screen Immersive Mode (Key: F)';
            immersiveToggleBtn.blur();
        }
        if (immersiveToggleLabel) {
            immersiveToggleLabel.textContent = immersiveActive ? 'Exit' : 'Immersive';
        }
        if (immIconEnter) immIconEnter.hidden = immersiveActive;
        if (immIconExit) immIconExit.hidden = !immersiveActive;

        if (!immersiveActive) {
            setImmersiveDrawerOpen(false);
            stopSpeaking();
            stopVoiceListening(true);
            if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
                enteredNativeFullscreen = false;
                document.exitFullscreen().catch(() => {});
            } else {
                enteredNativeFullscreen = false;
            }
        } else {
            syncImmersiveHud();
            if (requestNativeFs && !document.fullscreenElement && document.documentElement.requestFullscreen) {
                document.documentElement
                    .requestFullscreen()
                    .then(() => {
                        enteredNativeFullscreen = true;
                    })
                    .catch(() => {
                        enteredNativeFullscreen = false;
                    });
            }
        }
        syncAetherMode();
        dispatchStageResizeBurst();
    };

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && enteredNativeFullscreen && immersiveActive) {
            enteredNativeFullscreen = false;
            setImmersiveMode(false, false);
        }
    });

    if (immersiveToggleBtn) {
        immersiveToggleBtn.addEventListener('click', () => setImmersiveMode(!immersiveActive, true));
    }
    if (immWhyBtn) immWhyBtn.addEventListener('click', () => setImmersiveWhyOpen(!immWhyOpen));
    if (immMinimizeBtn) immMinimizeBtn.addEventListener('click', () => setImmersiveMinimized(!immMinimized));
    if (immStepsBtn) immStepsBtn.addEventListener('click', () => setImmersiveDrawerOpen(!immDrawerOpen));
    if (immDrawerClose) immDrawerClose.addEventListener('click', () => setImmersiveDrawerOpen(false));
    if (immDrawerTabSteps) immDrawerTabSteps.addEventListener('click', () => setImmersiveDrawerTab('steps'));
    if (immDrawerTabData) immDrawerTabData.addEventListener('click', () => setImmersiveDrawerTab('data'));

    const pipetteChips = {
        pipette_stock: getEl('chip-pipette-stock'),
        pipette_water: getEl('chip-pipette-water'),
        pipette_unknown: getEl('chip-pipette-unknown'),
    };

    // --- Theme System (Sunlit Light Lab <-> Obsidian Dark Studio) ---
    const getTheme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    const setTheme = (theme, withSound = false) => {
        const next = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.dataset.theme = next;
        try {
            localStorage.setItem('spectro-theme', next);
        } catch {}
        if (themeLightBtn) themeLightBtn.classList.toggle('seg-switch__btn--active', next === 'light');
        if (themeDarkBtn) themeDarkBtn.classList.toggle('seg-switch__btn--active', next === 'dark');
        if (withSound) audio.playLabSound('themeSwitch');
        graph.drawGraph();
        edu.refreshThemeVisuals();
    };
    setTheme(getTheme(), false);
    if (themeLightBtn) themeLightBtn.addEventListener('click', () => setTheme('light', true));
    if (themeDarkBtn) themeDarkBtn.addEventListener('click', () => setTheme('dark', true));

    // --- Scaffold Mode Switcher (Guided <-> Challenge) ---
    const applyScaffoldMode = (mode) => {
        const next = mode === 'challenge' ? 'challenge' : 'guided';
        ui.setScaffoldMode(next);
        if (scaffoldGuidedBtn) scaffoldGuidedBtn.classList.toggle('seg-switch__btn--active', next === 'guided');
        if (scaffoldChallengeBtn) scaffoldChallengeBtn.classList.toggle('seg-switch__btn--active', next === 'challenge');
        if (demoStepBtn) demoStepBtn.style.display = next === 'challenge' ? 'none' : '';
        if (immDemoBtn) immDemoBtn.style.display = next === 'challenge' ? 'none' : '';
        syncImmersiveHud();
    };
    if (scaffoldGuidedBtn) scaffoldGuidedBtn.addEventListener('click', () => applyScaffoldMode('guided'));
    if (scaffoldChallengeBtn) scaffoldChallengeBtn.addEventListener('click', () => applyScaffoldMode('challenge'));

    // --- Collapsible "Why?" Chemistry Insight Drawer ---
    const setInsightOpen = (open) => {
        if (!insightDrawerEl || !whyToggleBtn) return;
        insightDrawerEl.classList.toggle('insight-drawer--open', open);
        whyToggleBtn.classList.toggle('button--accent-active', open);
        whyToggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    if (whyToggleBtn && insightDrawerEl) {
        whyToggleBtn.addEventListener('click', () => {
            const isOpen = insightDrawerEl.classList.contains('insight-drawer--open');
            setInsightOpen(!isOpen);
        });
    }

    // --- Collapsible Educational Studio Dock ---
    let activeStudioTabKey = 'data';
    const setStudioCollapsed = (collapsed) => {
        if (!studioDockEl) return;
        studioDockEl.classList.toggle('studio-dock--collapsed', collapsed);
        if (studioCollapseBtn) studioCollapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        if (studioCollapseLabel) studioCollapseLabel.textContent = collapsed ? 'Show Panels' : 'Hide Panels';
        if (studioCollapseIcon) studioCollapseIcon.style.transform = collapsed ? 'rotate(180deg)' : '';
        edu.setOpticsTabActive(!collapsed && activeStudioTabKey === 'optics');
        if (!collapsed) {
            requestAnimationFrame(() => {
                graph.drawGraph();
                edu.refreshThemeVisuals();
            });
        }
    };
    if (studioCollapseBtn) {
        studioCollapseBtn.addEventListener('click', () => {
            const isCollapsed = studioDockEl?.classList.contains('studio-dock--collapsed');
            setStudioCollapsed(!isCollapsed);
        });
    }

    // --- Help / Quick Guide Modal ---
    const openHelpModal = () => {
        if (!helpModal) return;
        helpModal.hidden = false;
        requestAnimationFrame(() => helpModal.classList.add('report-modal--open'));
    };
    const closeHelpModal = () => {
        if (!helpModal) return;
        helpModal.classList.remove('report-modal--open');
        setTimeout(() => {
            if (helpModal && !helpModal.classList.contains('report-modal--open')) {
                helpModal.hidden = true;
            }
        }, 180);
    };
    if (helpToggleBtn) helpToggleBtn.addEventListener('click', openHelpModal);
    if (closeHelpBtn) closeHelpBtn.addEventListener('click', closeHelpModal);
    if (helpDoneBtn) helpDoneBtn.addEventListener('click', closeHelpModal);
    if (helpModal) {
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) closeHelpModal();
        });
    }

    const setActiveCamButton = (presetKey) => {
        document.querySelectorAll('.cam-btn').forEach((b) =>
            b.classList.toggle('cam-btn--active', b.dataset.preset === presetKey)
        );
    };

    const focusCameraPreset = (presetKey) => {
        setCameraPreset(presetKey);
        setActiveCamButton(presetKey);
    };

    const activateStudioTab = (tabKey, scrollIntoView = false) => {
        activeStudioTabKey = tabKey;
        setStudioCollapsed(false);
        document.querySelectorAll('.studio-tab').forEach((btn) => {
            const active = btn.dataset.tab === tabKey;
            btn.classList.toggle('studio-tab--active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        document.querySelectorAll('.studio-pane').forEach((pane) => {
            pane.classList.toggle('studio-pane--active', pane.id === `pane-${tabKey}`);
        });
        edu.setOpticsTabActive(tabKey === 'optics');
        if (tabKey === 'data') {
            requestAnimationFrame(() => graph.drawGraph());
        }
        if (scrollIntoView) {
            const pane = getEl(`pane-${tabKey}`);
            if (pane) pane.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    };

    try {
        // 1. Initialize State, Default Immersive Boot & Morphing Theme-Aware Calibration Graph
        state.initializeState(undoButton);

        const urlParams = new URLSearchParams(window.location.search);
        const autoStartImmersive = urlParams.get('immersive') !== '0';
        const autoStartHands = urlParams.get('hands') !== '0';
        if (autoStartImmersive) {
            setImmersiveMode(true, false);
        } else {
            document.body.classList.remove('immersive-mode');
        }
        graph.initGraph(graphCanvas, {
            tooltipEl: getEl('graph-tooltip'),
            r2BadgeEl: getEl('graph-r2-badge'),
            eqBadgeEl: getEl('graph-eq-badge'),
        });

        const graphModeAbsBtn = getEl('graph-mode-abs');
        const graphModePctBtn = getEl('graph-mode-pct');
        const graphPredictBtn = getEl('graph-predict-btn');

        const applyGraphMode = (mode, withSound = false) => {
            graph.setGraphPlotMode(mode, true);
            if (graphModeAbsBtn) graphModeAbsBtn.classList.toggle('mode-switch__btn--active', mode === 'abs');
            if (graphModePctBtn) graphModePctBtn.classList.toggle('mode-switch__btn--active', mode === 'pctT');
            if (withSound) audio.playLabSound('morph');
        };
        if (graphModeAbsBtn) graphModeAbsBtn.addEventListener('click', () => applyGraphMode('abs', true));
        if (graphModePctBtn) graphModePctBtn.addEventListener('click', () => applyGraphMode('pctT', true));
        if (graphPredictBtn) {
            graphPredictBtn.addEventListener('click', () => {
                const next = !graph.isPredictOverlayEnabled();
                graph.setPredictOverlayEnabled(next);
                graphPredictBtn.classList.toggle('predict-chip--on', next);
                audio.playLabSound('themeSwitch');
            });
        }

        // 2. Initialize Educational Studio (Phases, Milestones, Quantum Optics, Spatial FX, Solver, Report)
        edu.initEducationStudio({
            getScreenPoint,
            fxCanvas: getEl('fx-canvas'),
            phasePills: {
                prep: getEl('phase-prep'),
                zero: getEl('phase-zero'),
                standards: getEl('phase-standards'),
                calibration: getEl('phase-calibration'),
                unknown: getEl('phase-unknown'),
            },
            onFocusPreset: focusCameraPreset,
            onActivateTab: activateStudioTab,
            onHideFeedback: ui.hideFeedbackBanner,
            onPipVisibilityChange: (visible) => {
                if (xrayToggleBtn) xrayToggleBtn.classList.toggle('hud-icon-btn--active', visible);
            },
            precisionPill: getEl('precision-pill'),
            precisionPillText: getEl('precision-pill-text'),
            progressPctEl: getEl('progress-pct'),
            whyToggleBtn,
            demoStepBtn,
            coachTag: getEl('coach-tag'),
            coachTip: getEl('coach-tip'),
            coachFormula: getEl('coach-formula'),
            milestoneToast: getEl('milestone-toast'),
            milestoneTitle: getEl('milestone-title'),
            milestoneDetail: getEl('milestone-detail'),
            milestoneCta: getEl('milestone-cta'),
            milestoneClose: getEl('milestone-close-btn'),
            dataTabBadge: getEl('data-tab-badge'),
            tabBeamDot: getEl('tab-beam-dot'),
            tabBeamLabel: getEl('tab-beam-label'),
            quizScoreBadge: getEl('quiz-score-badge'),
            pipCard: pipOpticsCard,
            pipCanvas: getEl('pip-optics-canvas'),
            pipReading: getEl('pip-optics-reading'),
            opticsCanvas: getEl('optics-canvas'),
            spectrumCanvas: getEl('spectrum-canvas'),
            opticsScanBtn: getEl('optics-scan-btn'),
            photonTallySent: getEl('photon-tally-sent'),
            photonTallyAbs: getEl('photon-tally-abs'),
            photonTallyDet: getEl('photon-tally-det'),
            modeLiveBtn: getEl('optics-mode-live'),
            modeSandboxBtn: getEl('optics-mode-sandbox'),
            sandboxControls: getEl('sandbox-controls'),
            concSlider: getEl('sandbox-conc-slider'),
            concVal: getEl('sandbox-conc-val'),
            wlSlider: getEl('sandbox-wl-slider'),
            wlVal: getEl('sandbox-wl-val'),
            opticsI0: getEl('optics-stat-i0'),
            opticsT: getEl('optics-stat-t'),
            opticsAbs: getEl('optics-stat-abs'),
            opticsConc: getEl('optics-stat-conc'),
            spectrumCallout: getEl('spectrum-callout'),
            wheelNeedleGroup: getEl('wheel-needle-group'),
            wheelNeedleLine: getEl('wheel-needle-line'),
            wheelNeedleTip: getEl('wheel-needle-tip'),
            wheelAbsLabel: getEl('wheel-abs-label'),
            wheelTransLabel: getEl('wheel-trans-label'),
            eyeVialLiquid: getEl('eye-vial-liquid'),
            eyeVialBeam: getEl('eye-vial-beam'),
            eyeVialLbl: getEl('eye-vial-lbl'),
            liveDilutionEq: getEl('live-eq-dilution'),
            liveAbsEq: getEl('live-eq-abs'),
            liveBeerEq: getEl('live-eq-beer'),
            liveUnknownEq: getEl('live-eq-unknown'),
            solverCard: getEl('solver-card'),
            solverInput: getEl('solver-input'),
            solverCheckBtn: getEl('solver-check-btn'),
            solverFeedback: getEl('solver-feedback'),
            quizList: getEl('quiz-list'),
            exportCsvBtn: getEl('export-csv-btn'),
            copyReportBtn: getEl('copy-report-btn'),
            exportStatus: getEl('export-status'),
            openReportBtn: getEl('open-report-btn'),
            closeReportBtn: getEl('close-report-btn'),
            reportModal: getEl('report-modal'),
            reportBody: getEl('report-body'),
            reportPrintBtn: getEl('report-print-btn'),
            reportCsvBtn: getEl('report-csv-btn'),
            reportCopyBtn: getEl('report-copy-btn'),
        });

        // Quick Export CSV button in Studio tab bar
        const quickExportBtn = getEl('quick-export-csv-btn');
        const mainExportBtn = getEl('export-csv-btn');
        if (quickExportBtn && mainExportBtn) {
            quickExportBtn.addEventListener('click', () => mainExportBtn.click());
        }

        // Clicking the PiP X-Ray opens the full 630 nm Quantum Photon Lab!
        if (pipOpticsCard) {
            const jumpToOptics = () => {
                if (immersiveActive) setImmersiveMode(false, false);
                activateStudioTab('optics', true);
            };
            pipOpticsCard.addEventListener('click', jumpToOptics);
            pipOpticsCard.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    jumpToOptics();
                }
            });
        }

        // 3. Initialize UI Synchronizer (3D scene + Educational Studio + Immersive HUD + Immediate Error Audio/Streak + Row Inspect)
        let lastRecordedStep = 0;
        ui.initUI(
            {
                instructionEl,
                stepBadgeEl,
                progressFillEl,
                feedbackEl,
                resultsTbody,
                slopeDisplayEl,
                unknownResultEl,
                undoButton,
                pipetteChips,
                specQuickReadoutEl,
                specLedZeroEl,
                specLedCuvEl,
                dataPanelEl,
                graphPanelEl,
            },
            () => syncSceneFromState(false),
            () => {
                const st = state.getState();
                if (st.currentStep > lastRecordedStep) {
                    edu.recordStepOutcome(true, st.currentStep);
                } else if (st.currentStep === 0 && lastRecordedStep > 0) {
                    edu.resetPrecisionStreak();
                }
                lastRecordedStep = st.currentStep;
                edu.updateEducationPanel();
                syncImmersiveHud();
            },
            (message, type) => {
                // Direct feedback hook: fires immediately even when actions.js rejects an error without updateUI()!
                if (type === 'error' && message) {
                    edu.dismissMilestoneToast();
                    audio.playLabSound('error');
                    edu.recordStepOutcome(false, state.getState().currentStep);
                }
            },
            (row) => {
                edu.inspectSampleInPhotonLab(row);
            }
        );

        // 4. Wire 3D Action Animations + Synthesized Soundscape + Spatial 2D FX Pulses
        actions.setActionEffectHandler((type, payload) => {
            triggerActionEffect(type, payload);
            audio.playLabSound(type);
            edu.triggerActionEffectFx(type, payload);
        });

        // 5. Initialize Untouched Blender 5.2 Photorealistic 3D Scene
        await initScene3D(viewportEl, labelsEl, (progress) => {
            const pct = Math.round(progress * 100);
            if (loadingBarEl) loadingBarEl.style.width = `${pct}%`;
            if (loadingPctEl) loadingPctEl.textContent = `${pct}%`;
        });

        // 6. Initialize 3D Drag-and-Drop & Click Interaction
        const interactionActions = {
            tryZeroSpec: actions.tryZeroSpec,
            tryMeasure: actions.tryMeasure,
            tryToggleMode: actions.tryToggleMode,
            tryFillPipette: actions.tryFillPipette,
            tryDispensePipette: actions.tryDispensePipette,
            tryEmptyCuvette: actions.tryEmptyCuvette,
            tryInsertCuvette: actions.tryInsertCuvette,
            tryRemoveCuvetteFromSpec: actions.tryRemoveCuvetteFromSpec,
        };
        initInteraction3D({
            undoBtn: undoButton,
            resetBtn: resetButton,
            hoverEl: hoverInfoEl,
            actionFunctions: interactionActions,
            onReset: () => {
                lastRecordedStep = 0;
                ui.resetChallengePeek();
                edu.resetEducationState();
            },
            onUndo: (restoredStep) => {
                edu.onUndoStep(restoredStep);
                lastRecordedStep = restoredStep;
            },
        });

        // 7. Camera Presets, Focus Step + Spatial Guide Arc, Show Me, X-Ray, Sound, Labels & Theater Mode
        document.querySelectorAll('.cam-btn').forEach((btn) => {
            btn.addEventListener('click', () => focusCameraPreset(btn.dataset.preset));
        });

        const triggerFocusAndGuide = () => {
            focusCameraPreset(edu.getRecommendedPresetForStep(state.getState().currentStep));
            if (ui.isCurrentStepChallengeHidden()) {
                ui.showFeedback('Challenge Mode: Camera focused — click "Peek Step" if you want a laser hint.', 'info');
                return;
            }
            setTimeout(() => edu.triggerStepGuideArc(true), 220);
        };
        if (focusStepBtn) focusStepBtn.addEventListener('click', triggerFocusAndGuide);
        if (immFocusBtn) immFocusBtn.addEventListener('click', triggerFocusAndGuide);

        const triggerDemoStep = () => {
            edu.performCurrentStepDemo(interactionActions);
        };
        if (demoStepBtn) demoStepBtn.addEventListener('click', triggerDemoStep);
        if (immDemoBtn) immDemoBtn.addEventListener('click', triggerDemoStep);
        if (immUndoBtn) immUndoBtn.addEventListener('click', handleUndoClick);

        // 7b. Initialize On-Device MediaPipe Hand Gesture Control (Lazy-Loaded on Activation!)
        initHandGestures(
            {
                stageEl: simulationAreaEl,
                cursorEl: getEl('gesture-cursor'),
                cursorPinchArc: getEl('gesture-pinch-arc'),
                cursorDwellRing: getEl('gesture-dwell-ring'),
                cursorTagEl: getEl('gesture-cursor-tag'),
                pipCard: getEl('gesture-pip'),
                pipDot: getEl('gesture-pip-dot'),
                pipStatusText: getEl('gesture-pip-status'),
                pipVideo: getEl('gesture-video'),
                pipCanvas: getEl('gesture-canvas'),
                mirrorBtn: getEl('gesture-mirror-btn'),
                pipCollapseBtn: getEl('gesture-pip-collapse-btn'),
                pipCloseBtn: getEl('gesture-pip-close-btn'),
                pipErrorBox: getEl('gesture-error-box'),
                pipErrorMsg: getEl('gesture-error-msg'),
                virtualDemoBtn: getEl('gesture-virtual-btn'),
                retryCamBtn: getEl('gesture-retry-btn'),
            },
            {
                inspectAtClientPoint,
                handleVirtualPointerDown,
                handleVirtualPointerMove,
                handleVirtualPointerUp,
                cancelVirtualPointer,
                orbitCameraByDelta,
                zoomCameraByScale,
                onPeaceFocus: triggerFocusAndGuide,
                onToast: ui.showFeedback,
                onModeChange: (mode) => {
                    const isOn = mode === 'webcam' || mode === 'virtual' || mode === 'loading';
                    gesturesActive = isOn;
                    if (gestureToggleBtn) {
                        gestureToggleBtn.classList.toggle('hud-icon-btn--hands-active', isOn);
                        gestureToggleBtn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
                    }
                    syncAetherMode();
                },
            }
        );
        if (gestureToggleBtn) {
            gestureToggleBtn.addEventListener('click', () => {
                toggleHandGestures();
            });
        }

        // 7c. On-Demand Natural Human Voice Narration + Hands-Free "Why?" Voice Commands (Immersive Mode)
        const getSpokenStepPayload = () => {
            const st = state.getState();
            const totalActionable = instructions.length - 1;
            const stepNum = Math.min(st.currentStep + 1, totalActionable);
            const rawStep = (immInstructionEl?.textContent || instructionEl?.textContent || '').trim();
            if (!rawStep) return '';
            if (st.currentStep >= totalActionable) {
                return `Experiment complete. ${rawStep}`;
            }
            return `Step ${stepNum}. ${rawStep}`;
        };

        const getSpokenWhyPayload = () => {
            const tag = (immCoachTagEl?.textContent || getEl('coach-tag')?.textContent || '').trim();
            const tip = (immCoachTipEl?.textContent || getEl('coach-tip')?.textContent || '').trim();
            const formula = (immCoachFormulaEl?.textContent || getEl('coach-formula')?.textContent || '').trim();
            const parts = [];
            if (tag) parts.push(`${tag}.`);
            if (tip) parts.push(tip);
            if (formula) parts.push(`Equation: ${formula}.`);
            return parts.join(' ');
        };

        const speakCurrentStepOnDemand = () => {
            if (isVoiceSpeaking()) {
                stopSpeaking();
                return false;
            }
            const payload = getSpokenStepPayload();
            return speakNatural(payload);
        };

        const speakWhyExplanationOnDemand = (fromVoiceQuery = false) => {
            if (immersiveActive) {
                if (immMinimized) setImmersiveMinimized(false);
                setImmersiveWhyOpen(true);
            } else {
                setInsightOpen(true);
            }
            const payload = getSpokenWhyPayload();
            if (fromVoiceQuery) {
                ui.showFeedback('Explaining chemistry rationale aloud…', 'info');
            }
            return speakNatural(payload);
        };

        initVoiceAssistant({
            onSpeakingChange: (speaking, voiceName) => {
                if (immSpeakBtn) {
                    immSpeakBtn.classList.toggle('imm-proc__icon-btn--speaking', speaking);
                    immSpeakBtn.setAttribute('aria-pressed', speaking ? 'true' : 'false');
                    immSpeakBtn.title = speaking
                        ? `Stop speaking (${voiceName})`
                        : `Read current procedure step aloud in natural voice (${voiceName}, Key: R)`;
                }
            },
            onListeningChange: (listening) => {
                if (immMicBtn) {
                    immMicBtn.classList.toggle('imm-proc__icon-btn--listening', listening);
                    immMicBtn.setAttribute('aria-pressed', listening ? 'true' : 'false');
                    immMicBtn.title = listening
                        ? 'Listening — say "Why?" to hear explanation, or "Read step" (Click or H to stop)'
                        : 'Voice Assistant Mic — say "Why?" to hear the chemistry explanation, or "Read step" (Key: H)';
                }
            },
            onAskWhy: () => speakWhyExplanationOnDemand(true),
            onReadStep: () => speakNatural(getSpokenStepPayload()),
            onShowMe: () => triggerDemoStep(),
            onFocus: () => triggerFocusAndGuide(),
            onUndo: () => handleUndoClick(),
            onToast: ui.showFeedback,
        });

        if (immSpeakBtn) immSpeakBtn.addEventListener('click', () => speakCurrentStepOnDemand());
        if (immMicBtn) immMicBtn.addEventListener('click', () => toggleVoiceListening());
        if (immWhySpeakBtn) {
            immWhySpeakBtn.addEventListener('click', () => {
                if (isVoiceSpeaking()) {
                    stopSpeaking();
                } else {
                    speakWhyExplanationOnDemand(false);
                }
            });
        }

        const toggleLabels = () => {
            const next = !getLabelsVisible();
            setLabelsVisible(next);
            if (labelsToggleBtn) {
                labelsToggleBtn.classList.toggle('hud-icon-btn--active', next);
            }
        };
        if (labelsToggleBtn) labelsToggleBtn.addEventListener('click', toggleLabels);

        const toggleXray = () => {
            // On compact mobile viewports where desktop PiP is hidden, jump directly to the full 630 nm Photon Lab!
            if (window.innerWidth <= 920) {
                if (immersiveActive) setImmersiveMode(false, false);
                activateStudioTab('optics', true);
                return;
            }
            const next = !edu.isPipOpticsVisible();
            edu.setPipOpticsVisible(next);
        };
        if (xrayToggleBtn) xrayToggleBtn.addEventListener('click', toggleXray);

        const toggleSound = () => {
            const enabled = audio.toggleSound();
            if (soundToggleBtn) {
                soundToggleBtn.classList.toggle('icon-btn--active', enabled);
                soundToggleBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
            }
            if (soundIconOn) soundIconOn.hidden = !enabled;
            if (soundIconOff) soundIconOff.hidden = enabled;
        };
        if (soundToggleBtn) soundToggleBtn.addEventListener('click', toggleSound);

        const toggleTheaterMode = () => {
            if (!simulationAreaEl) return;
            const expanded = simulationAreaEl.classList.toggle('viewport-stage--expanded');
            if (theaterToggleBtn) {
                theaterToggleBtn.classList.toggle('hud-icon-btn--active', expanded);
                const lbl = theaterToggleBtn.querySelector('.hud-icon-btn__txt');
                if (lbl) lbl.textContent = expanded ? 'Compact' : 'Expand';
            }
            dispatchStageResizeBurst();
        };
        if (theaterToggleBtn) theaterToggleBtn.addEventListener('click', toggleTheaterMode);

        // Keyboard shortcuts (F Immersive, G Hands/AETHER, R Voice Step, Q Voice Why?, H Voice Mic, Space Focus+Guide, D Theme, X X-Ray, M Sound, L Labels, T Expand, ? Help, Escape)
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const reportOpen = getEl('report-modal') && !getEl('report-modal').hidden;
                const helpOpen = helpModal && !helpModal.hidden;
                if (reportOpen || helpOpen) {
                    edu.closeLabReportModal();
                    closeHelpModal();
                } else if (immDrawerOpen) {
                    setImmersiveDrawerOpen(false);
                } else if (immersiveActive) {
                    setImmersiveMode(false, false);
                }
                return;
            }
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const tag = (e.target && e.target.tagName) || '';
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            const k = e.key.toLowerCase();
            if (e.key === '?' || (e.shiftKey && e.key === '/')) {
                e.preventDefault();
                openHelpModal();
            } else if (e.code === 'Space') {
                e.preventDefault();
                triggerFocusAndGuide();
            } else if (k === 'f') {
                setImmersiveMode(!immersiveActive, true);
            } else if (k === 'g') {
                toggleHandGestures();
            } else if (k === 'r') {
                if (immersiveActive) speakCurrentStepOnDemand();
            } else if (k === 'q') {
                if (immersiveActive) speakWhyExplanationOnDemand(false);
            } else if (k === 'h') {
                if (immersiveActive) toggleVoiceListening();
            } else if (k === 'd') {
                setTheme(getTheme() === 'light' ? 'dark' : 'light', true);
            } else if (k === 'l') {
                toggleLabels();
            } else if (k === 't') {
                if (!immersiveActive) toggleTheaterMode();
            } else if (k === 'x') {
                toggleXray();
            } else if (k === 'm') {
                toggleSound();
            }
        });

        // Studio Tab Switcher
        document.querySelectorAll('.studio-tab').forEach((btn) => {
            btn.addEventListener('click', () => activateStudioTab(btn.dataset.tab));
        });

        window.addEventListener('resize', () => {
            graph.drawGraph();
            edu.handleFxResize();
            edu.updateEducationPanel();
        });

        // Clickable Pipette Selector Chips inside bottom bench tray
        Object.entries(pipetteChips).forEach(([pipId, chipEl]) => {
            if (!chipEl) return;
            chipEl.addEventListener('click', () => {
                const cur = state.getState().selectedObjectId;
                state.setStateVariable('selectedObjectId', cur === pipId ? null : pipId);
                ui.updateUI();
            });
        });

        // 8. Initial UI & Graph Render (+ crisp redraw once local webfonts settle)
        ui.updateUI();
        graph.drawGraph();
        actions.checkAndProcessInternalStep();
        syncSceneFromState(true);
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
                graph.drawGraph();
                edu.refreshThemeVisuals();
            });
        }

        if (loadingEl) {
            loadingEl.classList.add('loading-overlay--done');
            setTimeout(() => loadingEl.remove(), 350);
        }

        // 9. Auto-start Hand Gesture Control (AETHER Spatial Mode) on Page Load!
        if (autoStartHands) {
            isBootingAutoMode = true;
            startHandGestures().finally(() => {
                isBootingAutoMode = false;
            });
        }

        // Clean inspection hook for automated verification
        window.__SPECTRO_LAB__ = {
            getState: state.getState,
            instructions,
            actions: interactionActions,
            setCameraPreset: focusCameraPreset,
            getScreenPoint,
            getObject3D,
            undo: handleUndoClick,
            reset: handleResetClick,
            syncScene: () => syncSceneFromState(true),
            activateStudioTab,
            openLabReportModal: edu.openLabReportModal,
            setGraphPlotMode: (m) => applyGraphMode(m, false),
            setTheme: (t) => setTheme(t, false),
            getTheme,
            setScaffoldMode: applyScaffoldMode,
            setStudioCollapsed,
            setInsightOpen,
            setImmersiveMode,
            getImmersiveMode: () => immersiveActive,
            setImmersiveDrawerOpen,
            setImmersiveDrawerTab,
            setImmersiveMinimized,
            setImmersiveWhyOpen,
            handGestures: {
                start: startHandGestures,
                stop: stopHandGestures,
                toggle: toggleHandGestures,
                startVirtual: startVirtualHandMode,
                feedSyntheticHand,
                getStatus: getHandGestureStatus,
            },
            voice: {
                speakStep: speakCurrentStepOnDemand,
                speakWhy: () => speakWhyExplanationOnDemand(false),
                stopSpeaking,
                toggleMic: toggleVoiceListening,
                triggerTranscript: handleVoiceTranscript,
                getStatus: getVoiceStatus,
            },
            triggerGuideArc: () => edu.triggerStepGuideArc(false),
        };
    } catch (error) {
        console.error('Error initializing 3D Spectrophotometry Simulation:', error);
        if (loadingEl) {
            loadingEl.innerHTML = `<div class="loading-card"><p style="color:${config.COLORS.error};font-weight:600;">Failed to load 3D lab assets. Ensure the app is served over HTTP.</p><pre style="font-size:12px;opacity:.8;">${error.message}</pre></div>`;
        }
    }
});
