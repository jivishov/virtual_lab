/**
 * Lab Tier System
 * Manages visual theming based on lab tier progression.
 * 
 * Cycle 10: Visual Polish
 */

import GameState from './game-state.js';

/**
 * Lab tier definitions with visual properties
 */
const LAB_TIERS = {
    1: {
        id: 1,
        name: 'Garage Lab',
        icon: '🏠',
        tagline: 'Humble beginnings',
        colors: {
            primary: '#6B7280',     // Gray
            secondary: '#374151',
            accent: '#9CA3AF',
            background: 'linear-gradient(180deg, #1f2937 0%, #111827 50%, #0a0a0a 100%)'
        },
        cssClass: 'lab-tier-1'
    },
    2: {
        id: 2,
        name: 'Research Lab',
        icon: '🔬',
        tagline: 'Professional-grade equipment',
        colors: {
            primary: '#3B82F6',     // Blue
            secondary: '#1E40AF',
            accent: '#60A5FA',
            background: 'linear-gradient(180deg, #1e3a5f 0%, #0c1929 50%, #0a0a0a 100%)'
        },
        cssClass: 'lab-tier-2'
    },
    3: {
        id: 3,
        name: 'Industrial Facility',
        icon: '🏭',
        tagline: 'State-of-the-art production',
        colors: {
            primary: '#F59E0B',     // Gold
            secondary: '#B45309',
            accent: '#FBBF24',
            background: 'linear-gradient(180deg, #2d1f0d 0%, #1a1206 50%, #0a0a0a 100%)'
        },
        cssClass: 'lab-tier-3'
    }
};

const LabTier = {
    /**
     * Get current tier data
     * @returns {object} Tier configuration
     */
    getCurrentTier() {
        return LAB_TIERS[GameState.labTier] || LAB_TIERS[1];
    },

    /**
     * Get tier by ID
     * @param {number} tierId - Tier ID (1-3)
     * @returns {object} Tier configuration
     */
    getTier(tierId) {
        return LAB_TIERS[tierId] || LAB_TIERS[1];
    },

    /**
     * Render tier badge HTML
     * @returns {string} HTML string
     */
    renderTierBadge() {
        const tier = this.getCurrentTier();
        return `
            <div class="lab-tier-badge" style="--tier-primary: ${tier.colors.primary}; --tier-accent: ${tier.colors.accent}">
                <span class="lab-tier-badge__icon">${tier.icon}</span>
                <div class="lab-tier-badge__info">
                    <span class="lab-tier-badge__name">${tier.name}</span>
                    <span class="lab-tier-badge__tagline">${tier.tagline}</span>
                </div>
            </div>
        `;
    },

    /**
     * Apply tier theme to body
     */
    applyTierTheme() {
        const tier = this.getCurrentTier();
        const body = document.body;

        // Remove old tier classes
        body.classList.remove('lab-tier-1', 'lab-tier-2', 'lab-tier-3');

        // Add current tier class
        body.classList.add(tier.cssClass);

        // Set CSS custom properties
        body.style.setProperty('--lab-tier-primary', tier.colors.primary);
        body.style.setProperty('--lab-tier-secondary', tier.colors.secondary);
        body.style.setProperty('--lab-tier-accent', tier.colors.accent);
        body.style.setProperty('--lab-tier-background', tier.colors.background);
    },

    /**
     * Get all tiers for display
     * @returns {array} Array of tier objects
     */
    getAllTiers() {
        return Object.values(LAB_TIERS);
    }
};

// Make globally available
window.LabTier = LabTier;

export default LabTier;
