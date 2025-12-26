// ===================================
// MISSION: IMPOSSIBLE - LAB SAFETY
// Animation Controllers
// ===================================

// Typing effect for mission briefing
function typeText(element, text, speed = 30, callback) {
    let index = 0;
    element.innerHTML = '';

    function type() {
        if (index < text.length) {
            element.innerHTML += text.charAt(index);
            index++;
            setTimeout(type, speed);
        } else if (callback) {
            callback();
        }
    }

    type();
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

// Create explosion effect for self-destruct sequence
function createExplosion() {
    const beakerContainer = document.querySelector('.beaker-container');
    if (!beakerContainer) return;

    // Create explosion element
    const explosion = document.createElement('div');
    explosion.className = 'explosion';
    beakerContainer.appendChild(explosion);

    // Create multiple bubbles
    for (let i = 0; i < 15; i++) {
        setTimeout(() => {
            createBubble();
        }, 2200 + (i * 100));
    }

    // Trigger screen shake during explosion
    setTimeout(() => {
        shakeScreen(800);
        if (window.audioManager) {
            window.audioManager.playExplosion();
        }
    }, 3500);

    // Remove explosion after animation
    setTimeout(() => {
        explosion.remove();
    }, 4500);
}

// Create bubble animation
function createBubble() {
    const beaker = document.querySelector('.beaker');
    if (!beaker) return;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    // Random position
    const left = Math.random() * 80 + 10; // 10% to 90%
    const size = Math.random() * 15 + 10; // 10px to 25px

    bubble.style.left = `${left}%`;
    bubble.style.bottom = '0';
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.animationDuration = `${Math.random() * 2 + 2}s`; // 2-4s

    beaker.appendChild(bubble);

    // Remove after animation
    setTimeout(() => {
        bubble.remove();
    }, 4000);
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

// Animate timer bar
function animateTimer(duration, onComplete) {
    const timerFill = document.getElementById('timerFill');
    const timerText = document.getElementById('timerText');
    if (!timerFill || !timerText) return null;

    let timeLeft = duration;
    let percentage = 100;

    timerFill.style.width = '100%';
    timerFill.classList.remove('critical');
    timerText.textContent = `${timeLeft}s`;

    const interval = setInterval(() => {
        timeLeft--;
        percentage = (timeLeft / duration) * 100;

        timerFill.style.width = `${percentage}%`;
        timerText.textContent = `${timeLeft}s`;

        // Add critical styling when time is low
        if (timeLeft <= 5) {
            timerFill.classList.add('critical');
            updateAlertLevel('critical');

            // Play beep sound
            if (window.audioManager) {
                window.audioManager.playBeep();
            }
        } else if (timeLeft <= 10) {
            updateAlertLevel('elevated');
        }

        if (timeLeft <= 0) {
            clearInterval(interval);
            if (onComplete) onComplete();
        }
    }, 1000);

    return interval;
}

// Show feedback with animation
function showFeedback(isCorrect, title, text, explanation) {
    const feedbackArea = document.getElementById('feedbackArea');
    const feedbackTitle = document.getElementById('feedbackTitle');
    const feedbackText = document.getElementById('feedbackText');
    const fieldNotes = document.getElementById('fieldNotes');

    if (!feedbackArea || !feedbackTitle || !feedbackText || !fieldNotes) return;

    // Flash screen
    flashScreen(isCorrect ? 'success' : 'failure');

    // Play sound
    if (window.audioManager) {
        if (isCorrect) {
            window.audioManager.playSuccess();
        } else {
            window.audioManager.playFail();
        }
    }

    // Set content
    feedbackTitle.textContent = title;
    feedbackTitle.className = 'feedback-title ' + (isCorrect ? 'success' : 'failure');
    feedbackText.textContent = text;
    fieldNotes.textContent = explanation;

    // Show with animation
    feedbackArea.classList.remove('hidden');
    feedbackArea.classList.add('animated', 'slideInFromBottom');

    setTimeout(() => {
        feedbackArea.classList.remove('animated', 'slideInFromBottom');
    }, 500);
}

// Hide feedback
function hideFeedback() {
    const feedbackArea = document.getElementById('feedbackArea');
    if (!feedbackArea) return;

    feedbackArea.classList.add('animated', 'fadeOut');

    setTimeout(() => {
        feedbackArea.classList.add('hidden');
        feedbackArea.classList.remove('animated', 'fadeOut');
    }, 300);
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

// Update timestamp in header
function updateTimestamp() {
    const timestampElements = document.querySelectorAll('.timestamp');
    const now = new Date();
    const formatted = now.toISOString().slice(0, 19).replace('T', ' ');

    timestampElements.forEach(el => {
        el.setAttribute('data-time', formatted);
        el.textContent = formatted;
    });
}

// Initialize timestamp and update every second
setInterval(updateTimestamp, 1000);
updateTimestamp();

// Export functions for use in game.js
window.animations = {
    typeText,
    startCountdown,
    shakeScreen,
    flashScreen,
    glitchTransition,
    createExplosion,
    createBubble,
    createParticles,
    updateHUD,
    updateAlertLevel,
    animateTimer,
    showFeedback,
    hideFeedback,
    switchScreen,
    renderScene,
    showBadgeEarned,
    updateTimestamp
};
