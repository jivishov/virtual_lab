/**
 * Level Up Modal UI Component
 * Shows celebratory modal when player levels up.
 * 
 * Cycle 6: Career Progression
 */

import { getTierIcon, getTierColors } from './career-badge.js';

/**
 * Create confetti particles for celebration effect
 * @returns {string} HTML for confetti elements
 */
function createConfettiHTML() {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    let confetti = '';

    for (let i = 0; i < 50; i++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const left = Math.random() * 100;
        const delay = Math.random() * 0.5;
        const duration = 2 + Math.random() * 2;
        const size = 8 + Math.random() * 8;

        confetti += `<div class="level-up-confetti" style="
            left: ${left}%;
            background: ${color};
            width: ${size}px;
            height: ${size}px;
            animation-delay: ${delay}s;
            animation-duration: ${duration}s;
        "></div>`;
    }

    return confetti;
}

/**
 * Show the level up modal
 * @param {number} oldLevel - Previous level
 * @param {number} newLevel - New level achieved
 * @param {string} newTitle - New career title
 */
function showLevelUpModal(oldLevel, newLevel, newTitle) {
    const icon = getTierIcon(newTitle);
    const colors = getTierColors(newTitle);

    // Remove any existing modal
    const existing = document.querySelector('.level-up-overlay');
    if (existing) existing.remove();

    // Create modal HTML
    const modalHTML = `
        <div class="level-up-overlay" onclick="this.remove()">
            ${createConfettiHTML()}
            <div class="level-up-modal" style="--tier-from: ${colors.from}; --tier-to: ${colors.to}">
                <div class="level-up-modal__stars">✨</div>
                <h2 class="level-up-modal__header">LEVEL UP!</h2>
                <div class="level-up-modal__levels">
                    <span class="level-up-modal__old-level">${oldLevel}</span>
                    <span class="level-up-modal__arrow">→</span>
                    <span class="level-up-modal__new-level">${newLevel}</span>
                </div>
                <div class="level-up-modal__title-reveal">
                    <span class="level-up-modal__icon">${icon}</span>
                    <span class="level-up-modal__title">${newTitle}</span>
                </div>
                <p class="level-up-modal__hint">Click anywhere to continue</p>
            </div>
        </div>
    `;

    // Add to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Play celebration sound effect (if audio context available)
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5

        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
        // Audio not supported, continue silently
    }

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        const overlay = document.querySelector('.level-up-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        }
    }, 5000);
}

// Make available globally for easy triggering
window.showLevelUpModal = showLevelUpModal;

export { showLevelUpModal };
