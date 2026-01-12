/**
 * Specialization Selection Modal
 * Shows at Level 10 to let player choose their career path.
 * 
 * Cycle 8: Specialization Trees
 */

import { getAllSpecializations, getSpecialization } from '../data/specializations.js';
import GameState from '../core/game-state.js';

/**
 * Render a specialization card
 * @param {object} spec - Specialization data
 * @returns {string} HTML string
 */
function renderSpecCard(spec) {
    return `
        <div class="spec-card" data-spec-id="${spec.id}" style="--spec-color: ${spec.color}; --spec-gradient: ${spec.gradient}">
            <div class="spec-card__icon">${spec.icon}</div>
            <h3 class="spec-card__name">${spec.name}</h3>
            <p class="spec-card__tagline">${spec.tagline}</p>
            <p class="spec-card__description">${spec.description}</p>
            <div class="spec-card__bonuses">
                <span class="spec-card__bonus">💰 +${Math.round((spec.bonuses.payMultiplier - 1) * 100)}% Pay</span>
                <span class="spec-card__bonus">⭐ +${Math.round((spec.bonuses.xpMultiplier - 1) * 100)}% XP</span>
            </div>
            <div class="spec-card__skills">
                ${spec.skills.map(s => `<span class="spec-card__skill">${s}</span>`).join('')}
            </div>
            <button class="btn btn--primary spec-card__select">Choose This Path</button>
        </div>
    `;
}

/**
 * Show the specialization selection modal
 * @param {function} onComplete - Callback when selection is made
 */
function showSpecializationSelect(onComplete) {
    // Don't show if already specialized
    if (GameState.specialization) {
        if (onComplete) onComplete(GameState.specialization);
        return;
    }

    const specs = getAllSpecializations();

    // Remove any existing modal
    const existing = document.querySelector('.spec-overlay');
    if (existing) existing.remove();

    const modalHTML = `
        <div class="spec-overlay">
            <div class="spec-modal">
                <div class="spec-modal__header">
                    <span class="spec-modal__icon">🎓</span>
                    <h2 class="spec-modal__title">Choose Your Specialization</h2>
                    <p class="spec-modal__subtitle">You've reached Level 10! Select a career path to unlock specialized contracts and bonuses.</p>
                </div>
                
                <div class="spec-cards">
                    ${specs.map(s => renderSpecCard(s)).join('')}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add click handlers to cards
    document.querySelectorAll('.spec-card__select').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.spec-card');
            const specId = card.dataset.specId;

            // Set specialization in GameState
            GameState.specialization = specId;
            GameState.save();

            // Show confirmation
            showSpecializationConfirmation(specId, onComplete);
        });
    });
}

/**
 * Show confirmation after selecting a specialization
 * @param {string} specId - Selected specialization ID
 * @param {function} onComplete - Callback
 */
function showSpecializationConfirmation(specId, onComplete) {
    const spec = getSpecialization(specId);

    // Remove selection modal
    const overlay = document.querySelector('.spec-overlay');
    if (overlay) overlay.remove();

    // Show confirmation
    const confirmHTML = `
        <div class="spec-confirm-overlay" onclick="this.remove(); ${onComplete ? '' : ''}">
            <div class="spec-confirm-modal" style="--spec-gradient: ${spec.gradient}">
                <div class="spec-confirm__icon">${spec.icon}</div>
                <h2 class="spec-confirm__title">Welcome, ${spec.name}!</h2>
                <p class="spec-confirm__message">Your future contracts will focus on ${spec.industries.join(' and ')} industries.</p>
                <div class="spec-confirm__bonuses">
                    <span>💰 +${Math.round((spec.bonuses.payMultiplier - 1) * 100)}% Pay Bonus</span>
                    <span>⭐ +${Math.round((spec.bonuses.xpMultiplier - 1) * 100)}% XP Bonus</span>
                </div>
                <button class="btn btn--primary spec-confirm__continue" id="spec-confirm-btn">
                    Begin Your Journey →
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', confirmHTML);

    // Handle continue button
    document.getElementById('spec-confirm-btn').addEventListener('click', () => {
        const confirmOverlay = document.querySelector('.spec-confirm-overlay');
        if (confirmOverlay) {
            confirmOverlay.style.opacity = '0';
            setTimeout(() => {
                confirmOverlay.remove();
                if (onComplete) onComplete(specId);
            }, 300);
        }
    });
}

// Make available globally
window.showSpecializationSelect = showSpecializationSelect;

export { showSpecializationSelect };
