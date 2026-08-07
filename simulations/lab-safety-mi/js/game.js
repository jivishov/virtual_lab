// ===================================
// MISSION: IMPOSSIBLE - LAB SAFETY
// Main Game Engine
// ===================================

const BASE_POINTS = 10;
const STREAK_BONUS = 5;
const SPEED_BONUS = 5;
const WRONG_PENALTY = 5;
const HINT_COST = 3;

// A speed bonus needs a real read, not a fast guess: at least this long on the
// question, and no longer than the upper bound.
const SPEED_MIN_MS = 3000;
const SPEED_MAX_MS = 9000;

class LabSafetyGame {
    constructor() {
        this.state = this.freshState();
        this.init();
    }

    freshState() {
        return {
            agentName: '',
            tierIndex: 0,
            currentScenario: 0,
            score: 0,
            streak: 0,
            maxStreak: 0,
            correctAnswers: 0,
            incorrectAnswers: 0,
            quickAnswers: 0,
            hintsUsed: 0,
            hintsLeft: 0,
            correctScenarios: [],
            answers: [],
            activeScenario: null,
            hintUsedThisScenario: false,
            answered: false,
            timerInterval: null,
            questionStartTime: null
        };
    }

    get tier() {
        return DIFFICULTY_TIERS[this.state.tierIndex] || DIFFICULTY_TIERS[0];
    }

    get percentCorrect() {
        return Math.round((this.state.correctAnswers / MISSION_SCENARIOS.length) * 100);
    }

    init() {
        this.setupIntroScreen();
        this.setupKeyboardShortcuts();
        this.setupResultsButtons();
        this.setupCertificate();

        // A backgrounded tab throttles timers, which would silently eat a
        // student's clock while they are in another window.
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.pauseTimer();
            else this.resumeTimer();
        });
    }

    // ===================================
    // INTRO / BRIEFING
    // ===================================

    setupIntroScreen() {
        const agentNameInput = document.getElementById('agentName');
        const acceptBtn = document.getElementById('acceptMissionBtn');

        if (agentNameInput) {
            agentNameInput.addEventListener('input', (e) => {
                if (acceptBtn) acceptBtn.disabled = e.target.value.trim().length < 2;
            });

            agentNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && e.target.value.trim().length >= 2) {
                    this.startBriefing();
                }
            });
        }

        if (acceptBtn) {
            acceptBtn.addEventListener('click', () => this.startBriefing());
        }
    }

    startBriefing() {
        const agentNameInput = document.getElementById('agentName');
        const name = agentNameInput ? agentNameInput.value.trim() : 'AGENT';

        if (name.length < 2) return;

        this.state.agentName = name.toUpperCase();

        window.animations.switchScreen('introScreen', 'briefingScreen', () => {
            this.showBriefing();
        });
    }

    showBriefing() {
        const briefingText = document.getElementById('briefingText');
        const countdownElement = document.getElementById('countdown');
        const skipBtn = document.getElementById('skipBriefingBtn');

        this.briefingSpent = false;

        const advance = () => {
            if (this.briefingSpent) return;
            this.briefingSpent = true;
            if (this.countdownInterval) clearInterval(this.countdownInterval);
            if (skipBtn) skipBtn.onclick = null;
            this.showSelfDestruct();
        };

        if (skipBtn) skipBtn.onclick = advance;

        // Lines reveal, then the countdown starts — no dead 2s pause on a
        // static "5" like the previous build.
        window.animations.revealLines(briefingText, () => {
            if (countdownElement) {
                this.countdownInterval =
                    window.animations.startCountdown(countdownElement, 5, advance);
            } else {
                advance();
            }
        });
    }

    showSelfDestruct() {
        window.animations.switchScreen('briefingScreen', 'destructScreen', () => {
            window.animations.runViolationSequence(() => {
                window.animations.switchScreen('destructScreen', 'agentSelectScreen', () => {
                    this.setupAgentSelection();
                });
            });
        });
    }

    // ===================================
    // DIFFICULTY SELECTION
    // ===================================

    setupAgentSelection() {
        const grid = document.getElementById('agentGrid');
        if (!grid) return;

        grid.innerHTML = DIFFICULTY_TIERS.map((tier, index) => `
            <div class="agent-card" data-tier="${index}" role="button" tabindex="0"
                 aria-label="Select ${tier.name} clearance">
                <div class="agent-silhouette">${tier.icon}</div>
                <h3>${tier.name}</h3>
                <div class="agent-stats">
                    <p><span class="stat-strong">${tier.timerSeconds}s</span> per scenario</p>
                    <p><span class="stat-strong">${tier.hints || 'No'}</span> intel request${tier.hints === 1 ? '' : 's'}</p>
                    <p>${tier.blurb}</p>
                </div>
                <button class="select-agent-btn" type="button" tabindex="-1">SELECT</button>
            </div>
        `).join('');

        grid.querySelectorAll('.agent-card').forEach(card => {
            const index = Number(card.dataset.tier);
            card.addEventListener('click', () => this.selectTier(index));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectTier(index);
                }
            });
        });
    }

    selectTier(tierIndex) {
        if (this.tierChosen) return;
        this.tierChosen = true;

        this.state.tierIndex = tierIndex;
        this.state.score = 0;            // everybody starts on zero
        this.state.hintsLeft = DIFFICULTY_TIERS[tierIndex].hints;

        // First real user gesture — safe to start audio here.
        if (window.audioManager) window.audioManager.playMusic();

        const card = document.querySelector(`.agent-card[data-tier="${tierIndex}"]`);
        if (card) card.classList.add('chosen');

        setTimeout(() => {
            window.animations.switchScreen('agentSelectScreen', 'gameScreen', () => {
                this.initializeHUD();
                this.loadScenario(0);
            });
        }, 450);
    }

    initializeHUD() {
        window.animations.updateHUD('Agent', this.state.agentName, false);
        window.animations.updateHUD('Level', this.tier.name, false);
        window.animations.updateHUD('Points', this.state.score, false);
        window.animations.updateHUD('Streak', this.state.streak, false);
        window.animations.updateAlertLevel('secure');
    }

    // ===================================
    // SCENARIO LOOP
    // ===================================

    loadScenario(index) {
        if (index >= MISSION_SCENARIOS.length) {
            this.endMission();
            return;
        }

        // A pending feedback dialog from the previous scenario must never
        // surface over the new one.
        this.clearPendingFeedback();

        this.state.currentScenario = index;
        this.state.questionStartTime = Date.now();
        this.state.hintUsedThisScenario = false;
        this.state.answered = false;

        // Options are shuffled per attempt; correctIndex comes from the
        // `correct` flag, so position carries no signal.
        const scenario = prepareScenario(MISSION_SCENARIOS[index]);
        this.state.activeScenario = scenario;

        window.animations.updateHUD('Scenario', `${index + 1}/${MISSION_SCENARIOS.length}`, false);
        window.animations.updateAlertLevel('secure');

        const scenarioTitle = document.getElementById('scenarioTitle');
        const threatLevel = document.getElementById('threatLevel');
        const situationText = document.getElementById('situationText');

        if (scenarioTitle) scenarioTitle.textContent = scenario.title;

        if (threatLevel) {
            threatLevel.textContent = scenario.threatLevel.toUpperCase();
            threatLevel.className = 'threat-indicator threat-' + scenario.threatLevel;
        }

        if (situationText) situationText.textContent = scenario.situation;

        window.animations.renderScene(window.graphics.sceneArt(scenario.art));
        this.renderOptions(scenario.options);
        this.renderHintButton();
        this.startTimer(this.tier.timerSeconds);
    }

    renderOptions(options) {
        const optionsContainer = document.getElementById('optionsContainer');
        if (!optionsContainer) return;

        optionsContainer.innerHTML = '';

        options.forEach((option, index) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'option-card';
            card.dataset.index = index;

            card.innerHTML = `
                <span class="option-key">${index + 1}</span>
                <span class="option-icon">${window.graphics.icon(option.icon)}</span>
                <span class="option-body">
                    <span class="option-text">${option.text}</span>
                    <span class="option-description">${option.description}</span>
                </span>
                <span class="option-state" aria-hidden="true"></span>
            `;

            card.addEventListener('click', () => this.selectOption(index));
            optionsContainer.appendChild(card);
        });
    }

    renderHintButton() {
        const hintBtn = document.getElementById('hintBtn');
        const hintCount = document.getElementById('hintCount');
        if (!hintBtn) return;

        if (this.tier.hints === 0) {
            hintBtn.hidden = true;
            return;
        }

        hintBtn.hidden = false;
        hintBtn.disabled = this.state.hintsLeft <= 0;
        if (hintCount) hintCount.textContent = `(${this.state.hintsLeft})`;
        hintBtn.onclick = () => this.useHint();
    }

    // Greys out one wrong option at a cost.
    useHint() {
        if (this.state.hintsLeft <= 0 || this.state.hintUsedThisScenario) return;

        const scenario = this.state.activeScenario;
        if (!scenario) return;

        const candidates = Array.from(document.querySelectorAll('.option-card'))
            .filter(card => Number(card.dataset.index) !== scenario.correctIndex)
            .filter(card => !card.classList.contains('eliminated'));

        if (!candidates.length) return;

        candidates[Math.floor(Math.random() * candidates.length)]
            .classList.add('eliminated');

        this.state.hintsLeft--;
        this.state.hintsUsed++;
        this.state.hintUsedThisScenario = true;
        this.state.score = Math.max(0, this.state.score - HINT_COST);

        window.animations.updateHUD('Points', this.state.score);
        this.renderHintButton();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const gameScreen = document.getElementById('gameScreen');
            const dialog = document.getElementById('feedbackArea');

            if (!gameScreen || !gameScreen.classList.contains('active')) return;
            if (dialog && !dialog.classList.contains('hidden')) return;   // dialog owns keys

            if (!['1', '2', '3', '4'].includes(e.key)) return;

            const card = document.querySelector(`.option-card[data-index="${Number(e.key) - 1}"]`);
            if (card && !card.classList.contains('disabled') && !card.classList.contains('eliminated')) {
                card.click();
            }
        });
    }

    clearPendingFeedback() {
        if (this.pendingFeedback) {
            clearTimeout(this.pendingFeedback);
            this.pendingFeedback = null;
        }
    }

    selectOption(optionIndex) {
        const scenario = this.state.activeScenario;

        // One answer per scenario. Without this, a click landing in the same
        // tick as the timer hitting zero scores the scenario twice.
        if (!scenario || this.state.answered) return;
        this.state.answered = true;

        this.stopTimer();

        const isCorrect = optionIndex === scenario.correctIndex;
        const timeElapsed = Date.now() - this.state.questionStartTime;

        this.markCards(optionIndex, scenario.correctIndex);

        this.state.answers.push({
            id: scenario.id,
            title: scenario.title,
            chosen: scenario.options[optionIndex].text,
            chosenFeedback: scenario.options[optionIndex].feedback || '',
            answer: scenario.options[scenario.correctIndex].text,
            explanation: scenario.explanation,
            protocol: scenario.protocol,
            isCorrect,
            timedOut: false,
            ms: timeElapsed
        });

        this.processAnswer(isCorrect, timeElapsed, scenario, optionIndex);
    }

    markCards(chosenIndex, correctIndex) {
        document.querySelectorAll('.option-card').forEach(card => {
            const index = Number(card.dataset.index);
            card.classList.add('disabled');
            card.setAttribute('aria-disabled', 'true');

            if (index === chosenIndex) card.classList.add('selected');
            if (index === correctIndex) card.classList.add('correct');
            else if (index === chosenIndex) card.classList.add('incorrect');
        });
    }

    processAnswer(isCorrect, timeElapsed, scenario, chosenIndex) {
        let earned = 0;
        let whyFailed = '';

        if (isCorrect) {
            this.state.correctAnswers++;
            this.state.streak++;
            this.state.correctScenarios.push(scenario.id);
            this.state.maxStreak = Math.max(this.state.maxStreak, this.state.streak);

            earned = BASE_POINTS;
            if (this.state.streak >= 3) earned += STREAK_BONUS;

            // Deliberate speed, not blind clicking.
            if (timeElapsed >= SPEED_MIN_MS && timeElapsed <= SPEED_MAX_MS) {
                earned += SPEED_BONUS;
                this.state.quickAnswers++;
            }

            this.state.score += earned;
        } else {
            this.state.incorrectAnswers++;
            this.state.streak = 0;
            this.state.score = Math.max(0, this.state.score - WRONG_PENALTY);
            whyFailed = scenario.options[chosenIndex].feedback || '';

            if (window.audioManager) window.audioManager.playAlarm();
        }

        window.animations.updateHUD('Points', this.state.score);
        window.animations.updateHUD('Streak', this.state.streak);

        this.pendingFeedback = setTimeout(() => {
            this.pendingFeedback = null;
            window.animations.showFeedback({
                isCorrect,
                title: isCorrect ? '✅ PROTOCOL EXECUTED' : '❌ PROTOCOL BREACH',
                text: isCorrect
                    ? `+${earned} POINTS · STREAK ${this.state.streak}`
                    : `−${WRONG_PENALTY} POINTS · STREAK RESET`,
                explanation: scenario.explanation,
                whyFailed,
                chosen: scenario.options[chosenIndex],
                correct: scenario.options[scenario.correctIndex],
                onAdvance: () => this.nextScenario()
            });
            this.bindNextButton();
        }, 650);
    }

    handleTimeout() {
        const scenario = this.state.activeScenario;
        if (!scenario || this.state.answered) return;
        this.state.answered = true;

        this.state.incorrectAnswers++;
        this.state.streak = 0;
        this.state.score = Math.max(0, this.state.score - WRONG_PENALTY);

        document.querySelectorAll('.option-card').forEach(card => {
            card.classList.add('disabled');
            card.setAttribute('aria-disabled', 'true');
            if (Number(card.dataset.index) === scenario.correctIndex) {
                card.classList.add('correct');
            }
        });

        this.state.answers.push({
            id: scenario.id,
            title: scenario.title,
            chosen: 'No response',
            chosenFeedback: '',
            answer: scenario.options[scenario.correctIndex].text,
            explanation: scenario.explanation,
            protocol: scenario.protocol,
            isCorrect: false,
            timedOut: true,
            ms: this.tier.timerSeconds * 1000
        });

        if (window.audioManager) window.audioManager.playAlarm();

        window.animations.updateHUD('Points', this.state.score);
        window.animations.updateHUD('Streak', 0);

        window.animations.showFeedback({
            isCorrect: false,
            title: '⏱️ MISSION COMPROMISED',
            text: `TIME EXPIRED · −${WRONG_PENALTY} POINTS`,
            explanation: scenario.explanation,
            whyFailed: 'No protocol was executed. In a real incident, hesitation is itself the hazard — decide, then act.',
            chosen: { text: 'No response', description: 'The clock ran out' },
            correct: scenario.options[scenario.correctIndex],
            onAdvance: () => this.nextScenario()
        });
        this.bindNextButton();
    }

    bindNextButton() {
        const nextBtn = document.getElementById('nextBtn');
        if (!nextBtn) return;

        nextBtn.textContent = this.state.currentScenario === MISSION_SCENARIOS.length - 1
            ? 'MISSION COMPLETE ➤'
            : 'NEXT CASE ➤';

        nextBtn.onclick = () => this.nextScenario();
    }

    nextScenario() {
        this.clearPendingFeedback();
        window.animations.hideFeedback();
        window.animations.glitchTransition(() => {
            this.loadScenario(this.state.currentScenario + 1);
        });
    }

    // ===================================
    // TIMER
    // ===================================

    startTimer(duration) {
        this.stopTimer();
        window.animations.resetTimerScale(duration);
        this.state.timerInterval = window.animations.animateTimer(duration, () => {
            this.handleTimeout();
        });
    }

    stopTimer() {
        if (this.state.timerInterval) {
            clearInterval(this.state.timerInterval);
            this.state.timerInterval = null;
        }
    }

    pauseTimer() {
        if (!this.state.timerInterval) return;
        this.pausedTimer = window.animations.pauseTimer();
        this.state.timerInterval = null;
    }

    resumeTimer() {
        if (!this.pausedTimer) return;
        const remaining = this.pausedTimer;
        this.pausedTimer = null;
        this.state.timerInterval = window.animations.animateTimer(remaining, () => {
            this.handleTimeout();
        });
    }

    // ===================================
    // RESULTS
    // ===================================

    endMission() {
        this.stopTimer();
        this.clearPendingFeedback();
        window.animations.hideFeedback();

        const percent = this.percentCorrect;
        const rank = getRank(percent);
        const isSuccess = percent >= PASS_THRESHOLD;
        const earnedBadges = BADGES.filter(badge => badge.requirement(this.state));

        this.lastResult = { percent, rank, isSuccess, earnedBadges };

        // Straight to the debriefing. Badges used to be shown as up to four
        // unskippable full-screen overlays, delaying this screen by 15.5s.
        window.animations.switchScreen('gameScreen', 'completeScreen', () => {
            this.showResults(rank, isSuccess, earnedBadges, percent);
        });
    }

    showResults(rank, isSuccess, earnedBadges, percent) {
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        const missionStatusIcon = document.getElementById('missionStatusIcon');
        const completionTitle = document.getElementById('completionTitle');
        const badgesListEl = document.getElementById('badgesList');

        if (missionStatusIcon) missionStatusIcon.textContent = isSuccess ? '✓' : '✗';

        if (completionTitle) {
            completionTitle.textContent = isSuccess ? 'MISSION SUCCESS' : 'MISSION FAILED';
            completionTitle.className = 'completion-title ' + (isSuccess ? 'success' : 'failure');
        }

        setText('finalLevel', rank.title);
        setText('finalPoints', this.state.score);
        setText('protocolsExecuted', `${this.state.correctAnswers}/${MISSION_SCENARIOS.length}`);
        setText('breachCount', this.state.incorrectAnswers);

        if (badgesListEl) {
            badgesListEl.innerHTML = earnedBadges.length
                ? earnedBadges.map((badge, i) => `
                    <div class="badge-item" style="--i:${i}">
                        <div class="badge-icon">${badge.icon}</div>
                        <div class="badge-name">${badge.name}</div>
                        <div class="badge-description">${badge.description}</div>
                    </div>
                `).join('')
                : '<p style="text-align:center;color:var(--text-dim)">No commendations earned this mission</p>';
        }

        if (earnedBadges.length && window.audioManager) {
            window.audioManager.playSuccess();
        }

        setText('debriefingText', this.debriefingFor(percent));
    }

    debriefingFor(percent) {
        if (percent === 100) {
            return 'OUTSTANDING. Every protocol executed correctly. You are cleared for advanced laboratory operations.';
        }
        if (percent >= 90) {
            return 'EXCELLENT WORK. Strong command of laboratory safety. Review the one or two misses to reach a perfect record.';
        }
        if (percent >= PASS_THRESHOLD) {
            return 'MISSION PASSED. Core protocols are sound, but emergency response needs sharpening. Use REVIEW PROTOCOLS on the scenarios you lost.';
        }
        if (percent >= 50) {
            return 'BELOW STANDARD. You grasp the basics but not the emergency procedures that matter most. Review every breach before your next attempt.';
        }
        return 'CRITICAL DEFICIENCIES. The gaps in these answers would cause real injury in a real laboratory. Mandatory retraining before lab clearance.';
    }

    setupResultsButtons() {
        // Bound once at construction. These used to be re-bound on every
        // results screen, so a replay fired every handler twice.
        const newMissionBtn = document.getElementById('newMissionBtn');
        const reviewBtn = document.getElementById('reviewBtn');
        const reviewBackBtn = document.getElementById('reviewBackBtn');
        const certificateBtn = document.getElementById('certificateBtn');

        if (newMissionBtn) newMissionBtn.addEventListener('click', () => this.resetGame());
        if (reviewBtn) reviewBtn.addEventListener('click', () => this.showReview());
        if (reviewBackBtn) {
            reviewBackBtn.addEventListener('click', () => {
                window.animations.switchScreen('reviewScreen', 'completeScreen');
            });
        }
        if (certificateBtn) certificateBtn.addEventListener('click', () => this.showCertificate());
    }

    // ===================================
    // PROTOCOL REVIEW
    // ===================================

    showReview() {
        const list = document.getElementById('reviewList');
        const summary = document.getElementById('reviewSummary');

        if (summary) {
            summary.textContent =
                `${this.state.correctAnswers}/${MISSION_SCENARIOS.length} PASSED · ${this.percentCorrect}%`;
        }

        if (list) {
            list.innerHTML = this.state.answers.map(entry => `
                <div class="review-item ${entry.isCorrect ? 'pass' : 'fail'}">
                    <div class="review-head">
                        <span class="review-title">${entry.title}</span>
                        <span class="review-verdict ${entry.isCorrect ? 'pass' : 'fail'}">
                            ${entry.isCorrect ? 'PASSED' : (entry.timedOut ? 'NO RESPONSE' : 'BREACH')}
                        </span>
                    </div>
                    ${entry.isCorrect ? `
                        <p class="review-row"><b>YOUR ANSWER:</b>
                           <span class="answer">${entry.chosen}</span></p>
                    ` : `
                        <p class="review-row"><b>YOU CHOSE:</b>
                           <span class="chose">${entry.chosen}</span></p>
                        <p class="review-row"><b>CORRECT PROTOCOL:</b>
                           <span class="answer">${entry.answer}</span></p>
                        ${entry.chosenFeedback
                            ? `<p class="review-row">${entry.chosenFeedback}</p>`
                            : ''}
                    `}
                    <p class="review-protocol"><strong>${entry.protocol}</strong></p>
                </div>
            `).join('');
        }

        window.animations.switchScreen('completeScreen', 'reviewScreen');
    }

    // ===================================
    // CERTIFICATE
    // ===================================

    setupCertificate() {
        const input = document.getElementById('instructorName');
        const printBtn = document.getElementById('printCertBtn');
        const backBtn = document.getElementById('certBackBtn');

        // A teacher hands out one link for the whole class, built on
        // teacher.html: ?instructor=Ms.%20Rivera
        //
        // When the link supplies a name it is authoritative and the field
        // locks. The point of the whole mechanism is that the student — who has
        // no reason to know how their teacher spells their name, and every
        // reason to type something else — is not the one filling it in.
        const fromUrl = (new URLSearchParams(window.location.search).get('instructor') || '').trim();
        const note = document.getElementById('instructorNote');

        if (input) {
            if (fromUrl) {
                input.value = fromUrl;
                // readOnly, not disabled: the value stays selectable and
                // copyable, and it is still submitted and read back.
                input.readOnly = true;
                input.classList.add('is-locked');
                if (note) note.hidden = false;
                // Persist it. input.value = … fires no 'input' event, so this
                // used to be lost — and because the no-param path falls back to
                // storage, a shared lab machine would keep serving the PREVIOUS
                // class's teacher. Writing it here self-heals that.
                this.writeStoredInstructor(fromUrl);
            } else {
                input.value = this.readStoredInstructor();
                input.addEventListener('input', () => {
                    this.writeStoredInstructor(input.value.trim());
                    this.paintInstructor(input.value.trim());
                });
            }
            // Paint once now rather than relying on showCertificate() being the
            // only way onto the certificate screen.
            this.paintInstructor(input.value.trim());
        }

        const downloadBtn = document.getElementById('downloadCertBtn');

        if (printBtn) printBtn.addEventListener('click', () => window.print());
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                if (!this.lastResult || !window.certificatePdf) return;
                window.certificatePdf.downloadCertificatePdf(this.certificateData());
            });
        }
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                document.body.classList.remove('paper-mode');
                window.animations.switchScreen('certificateScreen', 'completeScreen');
            });
        }
    }

    readStoredInstructor() {
        try {
            return window.localStorage.getItem('labSafetyInstructor') || '';
        } catch (e) {
            return '';
        }
    }

    writeStoredInstructor(value) {
        try {
            window.localStorage.setItem('labSafetyInstructor', value);
        } catch (e) {
            /* private browsing — the field still works for this session */
        }
    }

    paintInstructor(name) {
        const el = document.getElementById('certInstructor');
        if (el) el.textContent = name || '';
    }

    // Single description of the certificate, so the screen and the PDF can
    // never state different things.
    certificateData() {
        const result = this.lastResult || { percent: 0, rank: getRank(0), isSuccess: false, earnedBadges: [] };
        const passed = result.isSuccess;
        const tier = DIFFICULTY_TIERS[this.state.tierIndex];
        const input = document.getElementById('instructorName');

        return {
            passed,
            name: this.state.agentName,
            percent: result.percent,
            rank: result.rank.title,
            tier: tier.name,
            correct: this.state.correctAnswers,
            total: MISSION_SCENARIOS.length,
            instructor: input ? input.value.trim() : '',
            date: new Date().toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric'
            }),
            badges: result.earnedBadges.map(b => b.name),
            stats: [
                { value: `${result.percent}%`, label: 'SUCCESS RATE' },
                { value: `${this.state.correctAnswers}/${MISSION_SCENARIOS.length}`, label: 'PROTOCOLS PASSED' },
                { value: tier.name, label: 'CLEARANCE' }
            ],
            // pre-wrapped for the PDF, which has no line-breaking of its own
            body: passed
                ? [
                    'has completed the Laboratory Protocol mission, demonstrating command of personal',
                    'protective equipment, hazard identification, emergency response, chemical handling',
                    `and laboratory conduct at ${tier.name} clearance.`
                  ]
                : [
                    `attempted the Laboratory Protocol mission at ${tier.name} clearance and did not reach`,
                    `the ${PASS_THRESHOLD}% standard required for laboratory clearance.`,
                    'Retraining and a further attempt are required.'
                  ]
        };
    }

    showCertificate() {
        const result = this.lastResult;
        if (!result) return;

        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        const passed = result.isSuccess;
        const seal = document.getElementById('certSeal');
        const badgeList = document.getElementById('certBadges');
        const input = document.getElementById('instructorName');

        setText('certTitle', passed
            ? 'Certificate of Laboratory Safety'
            : 'Laboratory Safety — Retraining Notice');

        setText('certPreamble', passed
            ? 'This certifies that operative'
            : 'This records that operative');

        setText('certName', this.state.agentName);

        setText('certBody', passed
            ? `has completed the Laboratory Protocol mission, demonstrating command of personal protective equipment, hazard identification, emergency response, chemical handling and laboratory conduct at ${DIFFICULTY_TIERS[this.state.tierIndex].name} clearance.`
            : `attempted the Laboratory Protocol mission at ${DIFFICULTY_TIERS[this.state.tierIndex].name} clearance and did not reach the ${PASS_THRESHOLD}% standard required for laboratory clearance. Retraining and a further attempt are required.`);

        setText('certRate', `${result.percent}%`);
        setText('certScenarios', `${this.state.correctAnswers}/${MISSION_SCENARIOS.length}`);
        setText('certTier', DIFFICULTY_TIERS[this.state.tierIndex].name);
        setText('certRank', result.rank.title);

        if (seal) {
            // The seal carries the grade, not just pass/fail: bands at 90 and
            // 80 give a distinction and a merit something to aim at above the
            // 70% clearance bar.
            const band = result.percent >= 90 ? ['gold', 'HONOURS']
                       : result.percent >= 80 ? ['silver', 'MERIT']
                       : ['bronze', 'PASS'];
            seal.className = passed ? `cert-seal is-pass tier-${band[0]}` : 'cert-seal is-fail';
            seal.innerHTML = passed
                ? `<span class="seal-top">IMF</span>
                   <span class="seal-mark">${result.percent}%</span>
                   <span class="seal-band">${band[1]}</span>`
                : `<span class="seal-top">&#9888;</span>
                   <span class="seal-mark">RETRAIN</span>
                   <span class="seal-band">NOT CLEARED</span>`;
        }

        if (badgeList) {
            badgeList.innerHTML = result.earnedBadges
                .map(badge => `<li>${badge.icon} ${badge.name}</li>`)
                .join('');
        }

        setText('certDate', new Date().toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric'
        }));

        this.paintInstructor(input ? input.value.trim() : '');

        document.body.classList.add('paper-mode');
        window.animations.switchScreen('completeScreen', 'certificateScreen');
    }

    // ===================================
    // RESET
    // ===================================

    resetGame() {
        if (window.audioManager) window.audioManager.stopMusic();

        this.stopTimer();
        if (this.countdownInterval) clearInterval(this.countdownInterval);

        this.state = this.freshState();
        this.lastResult = null;
        this.tierChosen = false;
        this.pausedTimer = null;
        document.body.classList.remove('paper-mode');

        document.querySelectorAll('.agent-card.chosen')
            .forEach(card => card.classList.remove('chosen'));

        window.animations.hideFeedback();

        window.animations.switchScreen('completeScreen', 'introScreen', () => {
            const agentNameInput = document.getElementById('agentName');
            const acceptBtn = document.getElementById('acceptMissionBtn');

            if (agentNameInput) agentNameInput.value = '';
            if (acceptBtn) acceptBtn.disabled = true;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.game = new LabSafetyGame();
});
