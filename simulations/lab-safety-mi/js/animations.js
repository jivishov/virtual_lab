// ===================================
// MISSION: IMPOSSIBLE - LAB SAFETY
// Animation Controllers
// ===================================

// Reveal a briefing one line at a time. Replaces the old character-by-character
// typeText, which was never called and would have shredded the inline markup
// (it appended raw characters into innerHTML, tags included).
function revealLines(container, callback, step = 380) {
    if (!container) {
        if (callback) callback();
        return;
    }

    const lines = Array.from(container.children);

    if (prefersReducedMotion()) {
        lines.forEach(line => line.classList.add('revealed'));
        if (callback) callback();
        return;
    }

    lines.forEach(line => line.classList.remove('revealed'));

    lines.forEach((line, index) => {
        setTimeout(() => {
            line.classList.add('revealed');
            if (index === lines.length - 1 && callback) callback();
        }, index * step);
    });
}

// Countdown animation
function startCountdown(element, from, callback) {
    let count = from;
    element.textContent = count;

    const interval = setInterval(() => {
        count--;
        element.textContent = count;

        // Add pulse animation when countdown is active
        element.classList.add('countdown-pulse');

        if (count <= 0) {
            clearInterval(interval);
            if (callback) callback();
        }
    }, 1000);

    return interval;
}

// Screen shake effect (for explosion)
function shakeScreen(duration = 500) {
    const container = document.getElementById('gameContainer');
    container.classList.add('screen-shake');

    setTimeout(() => {
        container.classList.remove('screen-shake');
    }, duration);
}

// Flash effect (success/failure feedback)
function flashScreen(type = 'success') {
    const container = document.getElementById('gameContainer');
    container.classList.add(type === 'success' ? 'success-flash' : 'failure-flash');

    setTimeout(() => {
        container.classList.remove('success-flash', 'failure-flash');
    }, 500);
}

// Glitch transition between screens
function glitchTransition(callback, duration = 500) {
    const container = document.getElementById('gameContainer');
    container.classList.add('glitch-transition');

    setTimeout(() => {
        if (callback) callback();
        container.classList.remove('glitch-transition');
    }, duration);
}

// ===================================
// PROTOCOL VIOLATION SEQUENCE
// Water poured into concentrated acid. One clock drives picture,
// sound and shake, so they cannot drift apart; every beat is a state
// class rather than a hard-coded animation-delay, which is what makes
// the sequence skippable.
// ===================================

const VIOLATION_BEATS = [
    { at: 0,    state: 'running' },
    { at: 700,  state: 'pouring' },
    { at: 1600, state: 'reacting' },
    { at: 2400, state: 'erupting', bang: true },
    { at: 3000, state: 'aftermath' }
];

const VIOLATION_WARNING_AT = 4000;   // panel appears
const VIOLATION_AUTO_ADVANCE = 12000; // fallback if CONTINUE is never pressed
const VIOLATION_STATES = 'running pouring reacting erupting aftermath';

let violationTimers = [];

function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function clearViolationTimers() {
    violationTimers.forEach(clearTimeout);
    violationTimers = [];
}

function later(fn, delay) {
    violationTimers.push(setTimeout(fn, delay));
}

// Boiling acid thrown clear of the beaker
function createSpatter(count = 16) {
    const field = document.getElementById('spatterField');
    if (!field) return;

    field.innerHTML = '';

    for (let i = 0; i < count; i++) {
        const drop = document.createElement('div');
        drop.className = 'droplet';

        const dir = i % 2 ? 1 : -1;
        drop.style.setProperty('--dx', `${Math.round(dir * (16 + Math.random() * 95))}px`);
        drop.style.setProperty('--peak', `${Math.round(-(55 + Math.random() * 75))}px`);
        drop.style.setProperty('--dy', `${Math.round(30 + Math.random() * 95)}px`);
        drop.style.setProperty('--size', `${(5.5 + Math.random() * 7).toFixed(1)}px`);
        drop.style.setProperty('--dur', `${(0.75 + Math.random() * 0.5).toFixed(2)}s`);
        drop.style.animationDelay = `${(Math.random() * 0.26).toFixed(2)}s`;

        field.appendChild(drop);
    }

    later(() => { field.innerHTML = ''; }, 2000);
}

function runViolationSequence(onDone) {
    const bench = document.getElementById('hazardBench');
    const warning = document.getElementById('violationWarning');
    const skipBtn = document.getElementById('skipSequenceBtn');
    const continueBtn = document.getElementById('violationContinueBtn');

    if (!bench) {
        if (onDone) onDone();
        return;
    }

    clearViolationTimers();
    bench.classList.remove(...VIOLATION_STATES.split(' '));
    if (warning) warning.classList.remove('show');
    if (skipBtn) skipBtn.hidden = false;

    const spatterField = document.getElementById('spatterField');
    if (spatterField) spatterField.innerHTML = '';

    let finished = false;

    function detach() {
        document.removeEventListener('keydown', onKey);
        if (skipBtn) skipBtn.onclick = null;
        if (continueBtn) continueBtn.onclick = null;
    }

    // Leave the mission: only the CONTINUE button does this, so the safety
    // message is never on a timer the student can lose.
    function finish() {
        if (finished) return;
        finished = true;
        clearViolationTimers();
        detach();
        if (onDone) onDone();
    }

    // SKIP jumps to the end state and holds the lesson — it does not skip
    // past the explanation.
    function settle() {
        clearViolationTimers();
        bench.classList.add(...VIOLATION_STATES.split(' '));
        if (warning) warning.classList.add('show');
        if (skipBtn) skipBtn.hidden = true;
        if (continueBtn) continueBtn.focus();
        later(finish, VIOLATION_AUTO_ADVANCE);
    }

    function onKey(e) {
        if (e.key !== 'Escape' && e.key !== 'Enter') return;
        if (warning && warning.classList.contains('show')) {
            finish();
        } else {
            settle();
        }
    }

    document.addEventListener('keydown', onKey);
    if (skipBtn) skipBtn.onclick = settle;
    if (continueBtn) continueBtn.onclick = finish;

    if (prefersReducedMotion()) {
        settle();
        return;
    }

    VIOLATION_BEATS.forEach(beat => {
        later(() => {
            bench.classList.add(beat.state);

            if (beat.bang) {
                // Sound and shake land ON the ejection frame. In the previous
                // build they fired 2s after the flash had already faded.
                createSpatter();
                shakeScreen(700);
                if (window.audioManager) {
                    window.audioManager.playExplosion();
                }
            }
        }, beat.at);
    });

    later(() => {
        if (warning) warning.classList.add('show');
        if (skipBtn) skipBtn.hidden = true;
        if (continueBtn) continueBtn.focus();
        later(finish, VIOLATION_AUTO_ADVANCE);
    }, VIOLATION_WARNING_AT);
}

// Create particle effect
function createParticles(container, count = 20, type = 'default') {
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');

        if (type === 'gas') {
            particle.className = 'gas-particle';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.bottom = '0';
            particle.style.animationDelay = `${Math.random() * 3}s`;
        } else if (type === 'water') {
            particle.className = 'water-droplet';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = '-50px';
            particle.style.animationDelay = `${Math.random() * 2}s`;
        } else if (type === 'spark') {
            particle.className = 'spark';
            const angle = Math.random() * 360;
            const distance = Math.random() * 50;
            particle.style.left = '50%';
            particle.style.top = '50%';
            particle.style.transform = `rotate(${angle}deg)`;
            particle.style.animationDelay = `${Math.random() * 0.5}s`;
        }

        container.appendChild(particle);

        // Auto-remove after animation
        setTimeout(() => {
            particle.remove();
        }, 5000);
    }
}

// Update HUD with animation
function updateHUD(field, value, animated = true) {
    const element = document.getElementById(`hud${field}`);
    if (!element) return;

    if (animated) {
        element.classList.add('animated', 'pulse');
        setTimeout(() => {
            element.classList.remove('animated', 'pulse');
        }, 500);
    }

    element.textContent = value;
}

// Update alert level with color change
function updateAlertLevel(level) {
    const alertElement = document.getElementById('hudAlert');
    if (!alertElement) return;

    alertElement.classList.remove('alert-green', 'alert-yellow', 'alert-red');

    switch(level) {
        case 'secure':
            alertElement.classList.add('alert-green');
            alertElement.textContent = 'SECURE';
            break;
        case 'elevated':
            alertElement.classList.add('alert-yellow');
            alertElement.textContent = 'ELEVATED';
            break;
        case 'critical':
            alertElement.classList.add('alert-red');
            alertElement.textContent = 'CRITICAL';
            break;
    }
}

// Animate timer bar. Remaining time is tracked outside the closure so the
// countdown can be paused when the tab is hidden and resumed where it left off.
let timerRemaining = 0;
let timerTotal = 0;
let activeTimerInterval = null;

function animateTimer(duration, onComplete) {
    const timerFill = document.getElementById('timerFill');
    const timerText = document.getElementById('timerText');
    if (!timerFill || !timerText) return null;

    timerRemaining = duration;
    timerTotal = Math.max(timerTotal, duration);

    const paint = () => {
        timerFill.style.width = `${(timerRemaining / timerTotal) * 100}%`;
        timerText.textContent = `${Math.max(0, timerRemaining)}s`;
    };

    timerFill.classList.remove('critical');
    paint();

    activeTimerInterval = setInterval(() => {
        timerRemaining--;
        paint();

        if (timerRemaining <= 5) {
            timerFill.classList.add('critical');
            updateAlertLevel('critical');
            if (window.audioManager) window.audioManager.playBeep();
        } else if (timerRemaining <= 10) {
            updateAlertLevel('elevated');
        }

        if (timerRemaining <= 0) {
            clearInterval(activeTimerInterval);
            activeTimerInterval = null;
            if (onComplete) onComplete();
        }
    }, 1000);

    return activeTimerInterval;
}

// Freeze the countdown and report what is left, so a backgrounded tab does
// not silently burn a student's clock.
function pauseTimer() {
    if (activeTimerInterval) {
        clearInterval(activeTimerInterval);
        activeTimerInterval = null;
    }
    return Math.max(1, timerRemaining);
}

// A fresh question resets the bar's full-width reference.
function resetTimerScale(duration) {
    timerTotal = duration;
    timerRemaining = duration;
}

// ===================================
// FEEDBACK DIALOG
// Centred over the scenario. The answer cards stay visible behind it, so
// the explanation still reads against the choice that produced it.
// ===================================

let dialogReturnFocus = null;
let dialogKeyHandler = null;

function trapDialogFocus(overlay, onAdvance) {
    const panel = overlay.querySelector('.modal-panel');
    if (!panel) return;

    dialogKeyHandler = (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
            e.preventDefault();
            if (onAdvance) onAdvance();
            return;
        }

        if (e.key !== 'Tab') return;

        const focusable = panel.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };

    document.addEventListener('keydown', dialogKeyHandler);
}

function showFeedback(options) {
    const {
        isCorrect,
        title,
        text,
        explanation,
        whyFailed = '',
        chosen = null,
        correct = null,
        onAdvance = null
    } = options;

    const overlay = document.getElementById('feedbackArea');
    const feedbackTitle = document.getElementById('feedbackTitle');
    const feedbackText = document.getElementById('feedbackText');
    const fieldNotes = document.getElementById('fieldNotes');
    const whyBlock = document.getElementById('whyFailedBlock');
    const whyText = document.getElementById('whyFailedText');
    const compare = document.getElementById('answerCompare');
    const nextBtn = document.getElementById('nextBtn');

    if (!overlay || !feedbackTitle || !feedbackText || !fieldNotes) return;

    // Always state what was chosen and what the correct protocol was. When they
    // match, one row says so rather than repeating the same line twice.
    if (compare) {
        const row = (kind, label, option) => `
            <div class="ac-row ${kind}">
                <span class="ac-mark" aria-hidden="true">${kind === 'wrong' ? '✕' : '✓'}</span>
                <span class="ac-body">
                    <span class="ac-label">${label}</span>
                    <span class="ac-value">${option ? option.text : '—'}</span>
                    ${option && option.description
                        ? `<span class="ac-desc">${option.description}</span>` : ''}
                </span>
            </div>`;

        compare.innerHTML = isCorrect
            ? row('right', 'YOUR CHOICE — CORRECT', chosen)
            : row('wrong', 'YOUR CHOICE', chosen) + row('right', 'CORRECT PROTOCOL', correct);
    }

    flashScreen(isCorrect ? 'success' : 'failure');

    if (window.audioManager) {
        if (isCorrect) {
            window.audioManager.playSuccess();
        } else {
            window.audioManager.playFail();
        }
    }

    feedbackTitle.textContent = title;
    feedbackTitle.className = 'feedback-title ' + (isCorrect ? 'success' : 'failure');
    feedbackText.textContent = text;
    fieldNotes.textContent = explanation;

    if (whyBlock && whyText) {
        if (whyFailed) {
            whyText.textContent = whyFailed;
            whyBlock.classList.remove('hidden');
        } else {
            whyBlock.classList.add('hidden');
        }
    }

    dialogReturnFocus = document.activeElement;

    overlay.classList.remove('hidden', 'dialog-out');
    overlay.classList.add('dialog-in');

    if (nextBtn) nextBtn.focus();
    trapDialogFocus(overlay, onAdvance);
}

function hideFeedback() {
    const overlay = document.getElementById('feedbackArea');
    if (!overlay) return;

    if (dialogKeyHandler) {
        document.removeEventListener('keydown', dialogKeyHandler);
        dialogKeyHandler = null;
    }

    overlay.classList.remove('dialog-in');
    overlay.classList.add('dialog-out');

    setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('dialog-out');
    }, 200);

    if (dialogReturnFocus && document.body.contains(dialogReturnFocus)) {
        dialogReturnFocus.focus();
    }
    dialogReturnFocus = null;
}

// Transition between screens
function switchScreen(fromId, toId, callback) {
    const fromScreen = document.getElementById(fromId);
    const toScreen = document.getElementById(toId);

    if (!fromScreen || !toScreen) return;

    // Fade out current screen
    fromScreen.style.opacity = '0';

    setTimeout(() => {
        fromScreen.classList.remove('active');
        toScreen.classList.add('active');

        // Trigger glitch effect
        glitchTransition(() => {
            toScreen.style.opacity = '1';
            if (callback) callback();
        });
    }, 500);
}

// Render scene content based on type
function renderScene(sceneHTML) {
    const sceneContent = document.getElementById('sceneContent');
    if (!sceneContent) return;

    sceneContent.innerHTML = sceneHTML;
    sceneContent.classList.add('animated', 'zoomIn');

    setTimeout(() => {
        sceneContent.classList.remove('animated', 'zoomIn');
    }, 500);
}

// Badge earn animation
function showBadgeEarned(badge) {
    // Create badge notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.95);
        border: 3px solid var(--warning-orange);
        border-radius: 15px;
        padding: 40px;
        text-align: center;
        z-index: 10001;
        box-shadow: 0 0 50px rgba(255, 136, 0, 0.8);
    `;

    notification.innerHTML = `
        <div style="font-size: 80px; margin-bottom: 20px; animation: badgeEarn 0.8s ease-out;">
            ${badge.icon}
        </div>
        <h2 style="font-family: var(--font-header); color: var(--warning-orange); font-size: 28px; margin-bottom: 15px;">
            COMMENDATION EARNED
        </h2>
        <h3 style="font-family: var(--font-header); color: var(--text-primary); font-size: 24px; margin-bottom: 10px;">
            ${badge.name}
        </h3>
        <p style="color: var(--text-dim); font-size: 16px;">
            ${badge.description}
        </p>
    `;

    document.body.appendChild(notification);

    // Play sound
    if (window.audioManager) {
        window.audioManager.playSuccess();
    }

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s';
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 3000);
}

// Update timestamp in header. Sets textContent only — the matching
// `.timestamp::before { content: attr(data-time) }` rule has been removed,
// because together they printed the time twice.
function updateTimestamp() {
    const now = new Date();
    const formatted = now.toISOString().slice(0, 19).replace('T', ' ');

    document.querySelectorAll('.timestamp').forEach(el => {
        el.textContent = formatted;
    });
}

// Initialize timestamp and update every second
setInterval(updateTimestamp, 1000);
updateTimestamp();

// Export functions for use in game.js
window.animations = {
    revealLines,
    prefersReducedMotion,
    startCountdown,
    shakeScreen,
    flashScreen,
    glitchTransition,
    runViolationSequence,
    createParticles,
    updateHUD,
    updateAlertLevel,
    animateTimer,
    pauseTimer,
    resetTimerScale,
    showFeedback,
    hideFeedback,
    switchScreen,
    renderScene,
    showBadgeEarned,
    updateTimestamp
};
