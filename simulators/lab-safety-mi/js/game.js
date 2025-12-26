// ===================================
// MISSION: IMPOSSIBLE - LAB SAFETY
// Main Game Engine
// ===================================

class LabSafetyGame {
    constructor() {
        // Game state
        this.state = {
            agentName: '',
            agentLevel: 0,
            currentScenario: 0,
            score: 0,
            streak: 0,
            maxStreak: 0,
            correctAnswers: 0,
            incorrectAnswers: 0,
            quickAnswers: 0,
            correctScenarios: [],
            timerInterval: null,
            questionStartTime: null
        };

        this.init();
    }

    init() {
        // Initialize intro screen
        this.setupIntroScreen();
    }

    setupIntroScreen() {
        const agentNameInput = document.getElementById('agentName');
        const acceptBtn = document.getElementById('acceptMissionBtn');

        if (agentNameInput) {
            agentNameInput.addEventListener('input', (e) => {
                const name = e.target.value.trim();
                if (acceptBtn) {
                    acceptBtn.disabled = name.length < 2;
                }
            });

            agentNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && e.target.value.trim().length >= 2) {
                    this.startBriefing();
                }
            });
        }

        if (acceptBtn) {
            acceptBtn.addEventListener('click', () => {
                this.startBriefing();
            });
        }
    }

    startBriefing() {
        const agentNameInput = document.getElementById('agentName');
        const name = agentNameInput ? agentNameInput.value.trim() : 'AGENT';

        if (name.length < 2) return;

        this.state.agentName = name.toUpperCase();

        // Switch to briefing screen
        window.animations.switchScreen('introScreen', 'briefingScreen', () => {
            this.showBriefing();
        });
    }

    showBriefing() {
        const briefingText = document.getElementById('briefingText');

        setTimeout(() => {
            const countdownElement = document.getElementById('countdown');
            if (countdownElement) {
                window.animations.startCountdown(countdownElement, 5, () => {
                    this.showSelfDestruct();
                });
            }
        }, 2000);
    }

    showSelfDestruct() {
        window.animations.switchScreen('briefingScreen', 'destructScreen', () => {
            // Trigger explosion animation
            setTimeout(() => {
                window.animations.createExplosion();
            }, 500);

            // Move to agent selection after explosion
            setTimeout(() => {
                window.animations.switchScreen('destructScreen', 'agentSelectScreen', () => {
                    this.setupAgentSelection();
                });
            }, 5000);
        });
    }

    setupAgentSelection() {
        const agentCards = document.querySelectorAll('.agent-card');

        agentCards.forEach((card, index) => {
            const selectBtn = card.querySelector('.select-agent-btn');
            if (selectBtn) {
                selectBtn.addEventListener('click', () => {
                    this.selectAgent(index);
                });
            }
        });
    }

    selectAgent(levelIndex) {
        this.state.agentLevel = levelIndex;
        this.state.score = AGENT_LEVELS[levelIndex].startingPoints;

        // Start music
        if (window.audioManager) {
            window.audioManager.playMusic();
        }

        // Switch to game screen
        window.animations.switchScreen('agentSelectScreen', 'gameScreen', () => {
            this.initializeHUD();
            this.loadScenario(0);
        });
    }

    initializeHUD() {
        window.animations.updateHUD('Agent', this.state.agentName);
        window.animations.updateHUD('Level', AGENT_LEVELS[this.state.agentLevel].name);
        window.animations.updateHUD('Points', this.state.score);
        window.animations.updateHUD('Streak', this.state.streak);
        window.animations.updateAlertLevel('secure');
    }

    loadScenario(index) {
        if (index >= MISSION_SCENARIOS.length) {
            this.endMission();
            return;
        }

        this.state.currentScenario = index;
        this.state.questionStartTime = Date.now();

        const scenario = MISSION_SCENARIOS[index];

        // Update HUD
        window.animations.updateHUD('Scenario', `${index + 1}/${MISSION_SCENARIOS.length}`);
        window.animations.updateAlertLevel('secure');

        // Update scenario info
        const scenarioTitle = document.getElementById('scenarioTitle');
        const threatLevel = document.getElementById('threatLevel');
        const situationText = document.getElementById('situationText');

        if (scenarioTitle) scenarioTitle.textContent = scenario.title;

        if (threatLevel) {
            threatLevel.textContent = scenario.threatLevel.toUpperCase();
            threatLevel.className = 'threat-indicator threat-' + scenario.threatLevel;
        }

        if (situationText) situationText.textContent = scenario.situation;

        // Render scene
        window.animations.renderScene(scenario.sceneHTML);

        // Render options
        this.renderOptions(scenario.options);

        // Start timer
        this.startTimer(15);
    }

    renderOptions(options) {
        const optionsContainer = document.getElementById('optionsContainer');
        if (!optionsContainer) return;

        optionsContainer.innerHTML = '';

        options.forEach((option, index) => {
            const optionCard = document.createElement('div');
            optionCard.className = 'option-card';
            optionCard.dataset.index = index;

            optionCard.innerHTML = `
                <div class="option-icon">${option.icon}</div>
                <div class="option-text">${option.text}</div>
                <div class="option-description">${option.description}</div>
            `;

            optionCard.addEventListener('click', () => {
                this.selectOption(index);
            });

            optionsContainer.appendChild(optionCard);
        });
    }

    selectOption(optionIndex) {
        // Clear timer
        if (this.state.timerInterval) {
            clearInterval(this.state.timerInterval);
            this.state.timerInterval = null;
        }

        const scenario = MISSION_SCENARIOS[this.state.currentScenario];
        const isCorrect = optionIndex === scenario.correctAnswer;
        const timeElapsed = Date.now() - this.state.questionStartTime;

        // Mark selected option
        const optionCards = document.querySelectorAll('.option-card');
        optionCards.forEach((card, index) => {
            card.classList.add('disabled');

            if (index === optionIndex) {
                card.classList.add('selected');
            }

            // Highlight correct answer
            if (index === scenario.correctAnswer) {
                setTimeout(() => {
                    card.classList.add('correct');
                }, 300);
            } else if (index === optionIndex && !isCorrect) {
                setTimeout(() => {
                    card.classList.add('incorrect');
                }, 300);
            }
        });

        // Process answer
        this.processAnswer(isCorrect, timeElapsed, scenario);
    }

    processAnswer(isCorrect, timeElapsed, scenario) {
        if (isCorrect) {
            this.state.correctAnswers++;
            this.state.streak++;
            this.state.correctScenarios.push(scenario.id);

            // Update max streak
            if (this.state.streak > this.state.maxStreak) {
                this.state.maxStreak = this.state.streak;
            }

            // Calculate points
            let points = 10; // Base points

            // Streak bonus
            if (this.state.streak >= 3) {
                points += 5;
            }

            // Speed bonus (under 8 seconds)
            if (timeElapsed < 8000) {
                points += 5;
                this.state.quickAnswers++;
            }

            this.state.score += points;

            // Show feedback
            setTimeout(() => {
                window.animations.showFeedback(
                    true,
                    '✅ PROTOCOL EXECUTED',
                    `+${points} POINTS | STREAK: ${this.state.streak}`,
                    scenario.explanation
                );
            }, 800);

        } else {
            this.state.incorrectAnswers++;
            this.state.streak = 0;
            this.state.score = Math.max(0, this.state.score - 5); // Lose 5 points

            if (window.audioManager) {
                window.audioManager.playAlarm();
            }

            // Show feedback
            setTimeout(() => {
                window.animations.showFeedback(
                    false,
                    '❌ PROTOCOL BREACH',
                    `-5 POINTS | STREAK RESET`,
                    scenario.explanation
                );
            }, 800);
        }

        // Update HUD
        window.animations.updateHUD('Points', this.state.score, true);
        window.animations.updateHUD('Streak', this.state.streak, true);

        // Setup next button
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            nextBtn.onclick = () => this.nextScenario();

            // Update button text for last scenario
            if (this.state.currentScenario === MISSION_SCENARIOS.length - 1) {
                nextBtn.textContent = 'MISSION COMPLETE ➤';
            }
        }
    }

    handleTimeout() {
        // Auto-fail on timeout
        const scenario = MISSION_SCENARIOS[this.state.currentScenario];

        this.state.incorrectAnswers++;
        this.state.streak = 0;
        this.state.score = Math.max(0, this.state.score - 5);

        // Mark all options as disabled
        const optionCards = document.querySelectorAll('.option-card');
        optionCards.forEach((card, index) => {
            card.classList.add('disabled');

            if (index === scenario.correctAnswer) {
                card.classList.add('correct');
            }
        });

        if (window.audioManager) {
            window.audioManager.playAlarm();
        }

        // Show timeout feedback
        window.animations.showFeedback(
            false,
            '⏱️ MISSION COMPROMISED',
            'TIME EXPIRED | -5 POINTS',
            scenario.explanation
        );

        // Update HUD
        window.animations.updateHUD('Points', this.state.score, true);
        window.animations.updateHUD('Streak', 0, true);

        // Setup next button
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            nextBtn.onclick = () => this.nextScenario();
        }
    }

    startTimer(duration) {
        this.state.timerInterval = window.animations.animateTimer(duration, () => {
            this.handleTimeout();
        });
    }

    nextScenario() {
        window.animations.hideFeedback();

        // Glitch transition
        window.animations.glitchTransition(() => {
            this.loadScenario(this.state.currentScenario + 1);
        });
    }

    endMission() {
        // Calculate final stats
        const finalLevel = getAgentLevel(this.state.score);
        const successRate = (this.state.correctAnswers / MISSION_SCENARIOS.length) * 100;
        const isSuccess = this.state.correctAnswers >= 7;

        // Check for earned badges
        const earnedBadges = BADGES.filter(badge => badge.requirement(this.state));

        // Show badge notifications
        earnedBadges.forEach((badge, index) => {
            setTimeout(() => {
                window.animations.showBadgeEarned(badge);
            }, 1000 + (index * 3500));
        });

        // Switch to complete screen
        setTimeout(() => {
            window.animations.switchScreen('gameScreen', 'completeScreen', () => {
                this.showResults(finalLevel, isSuccess, earnedBadges);
            });
        }, earnedBadges.length * 3500 + 1500);
    }

    showResults(finalLevel, isSuccess, earnedBadges) {
        // Update completion screen
        const missionStatusIcon = document.getElementById('missionStatusIcon');
        const missionStatus = document.getElementById('missionStatus');
        const completionTitle = document.getElementById('completionTitle');
        const finalLevelEl = document.getElementById('finalLevel');
        const finalPointsEl = document.getElementById('finalPoints');
        const protocolsExecutedEl = document.getElementById('protocolsExecuted');
        const breachCountEl = document.getElementById('breachCount');
        const badgesListEl = document.getElementById('badgesList');
        const debriefingTextEl = document.getElementById('debriefingText');

        if (missionStatusIcon) {
            missionStatusIcon.textContent = isSuccess ? '✓' : '✗';
        }

        if (completionTitle) {
            completionTitle.textContent = isSuccess ? 'MISSION SUCCESS' : 'MISSION FAILED';
            completionTitle.className = 'completion-title ' + (isSuccess ? 'success' : 'failure');
        }

        if (finalLevelEl) finalLevelEl.textContent = finalLevel.name;
        if (finalPointsEl) finalPointsEl.textContent = this.state.score;
        if (protocolsExecutedEl) {
            protocolsExecutedEl.textContent = `${this.state.correctAnswers}/${MISSION_SCENARIOS.length}`;
        }
        if (breachCountEl) breachCountEl.textContent = this.state.incorrectAnswers;

        // Show badges
        if (badgesListEl) {
            if (earnedBadges.length > 0) {
                badgesListEl.innerHTML = earnedBadges.map(badge => `
                    <div class="badge-item">
                        <div class="badge-icon">${badge.icon}</div>
                        <div class="badge-name">${badge.name}</div>
                        <div class="badge-description">${badge.description}</div>
                    </div>
                `).join('');
            } else {
                badgesListEl.innerHTML = '<p style="text-align: center; color: var(--text-dim);">No commendations earned this mission</p>';
            }
        }

        // Debriefing text
        if (debriefingTextEl) {
            let debriefing = '';

            if (this.state.correctAnswers === MISSION_SCENARIOS.length) {
                debriefing = 'OUTSTANDING PERFORMANCE! Perfect execution of all safety protocols. You are cleared for advanced laboratory operations.';
            } else if (this.state.correctAnswers >= 8) {
                debriefing = 'EXCELLENT WORK! Strong understanding of lab safety demonstrated. Review any errors to achieve perfection.';
            } else if (this.state.correctAnswers >= 5) {
                debriefing = 'SATISFACTORY. You grasp basic protocols but require additional training on emergency procedures. Review critical scenarios.';
            } else {
                debriefing = 'CRITICAL DEFICIENCIES DETECTED. Major gaps in safety knowledge pose serious risk. Mandatory retraining required before lab clearance.';
            }

            debriefingTextEl.textContent = debriefing;
        }

        // Setup buttons
        const newMissionBtn = document.getElementById('newMissionBtn');
        const reviewBtn = document.getElementById('reviewBtn');

        if (newMissionBtn) {
            newMissionBtn.addEventListener('click', () => {
                this.resetGame();
            });
        }

        if (reviewBtn) {
            reviewBtn.addEventListener('click', () => {
                alert('Review feature coming soon! For now, start a new mission to practice protocols again.');
            });
        }
    }

    resetGame() {
        // Stop music
        if (window.audioManager) {
            window.audioManager.stopMusic();
        }

        // Clear any intervals
        if (this.state.timerInterval) {
            clearInterval(this.state.timerInterval);
        }

        // Reset state
        this.state = {
            agentName: '',
            agentLevel: 0,
            currentScenario: 0,
            score: 0,
            streak: 0,
            maxStreak: 0,
            correctAnswers: 0,
            incorrectAnswers: 0,
            quickAnswers: 0,
            correctScenarios: [],
            timerInterval: null,
            questionStartTime: null
        };

        // Return to intro
        window.animations.switchScreen('completeScreen', 'introScreen', () => {
            // Reset intro screen
            const agentNameInput = document.getElementById('agentName');
            if (agentNameInput) {
                agentNameInput.value = '';
            }

            const acceptBtn = document.getElementById('acceptMissionBtn');
            if (acceptBtn) {
                acceptBtn.disabled = true;
            }
        });
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new LabSafetyGame();
});
