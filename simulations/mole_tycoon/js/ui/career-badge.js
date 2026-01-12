/**
 * Career Badge UI Component
 * Displays a prominent career badge with level and title on the hub.
 * 
 * Cycle 6: Career Progression
 */

/**
 * Get icon for career tier based on title
 * @param {string} title - Career title
 * @returns {string} Emoji icon
 */
function getTierIcon(title) {
    const icons = {
        'Intern': '🔬',
        'Technician': '🧪',
        'Engineer': '⚗️',
        'Process Lead': '🏭',
        'Plant Manager': '👔'
    };
    return icons[title] || '🔬';
}

/**
 * Get gradient colors for career tier
 * @param {string} title - Career title
 * @returns {object} { from, to } gradient colors
 */
function getTierColors(title) {
    const colors = {
        'Intern': { from: '#667eea', to: '#764ba2' },
        'Technician': { from: '#00d4ff', to: '#0099cc' },
        'Engineer': { from: '#f093fb', to: '#f5576c' },
        'Process Lead': { from: '#4facfe', to: '#00f2fe' },
        'Plant Manager': { from: '#fa709a', to: '#fee140' }
    };
    return colors[title] || colors['Intern'];
}

/**
 * Render the career badge HTML
 * @param {object} gameState - GameState object with level, title, xp
 * @returns {string} HTML string for career badge
 */
function renderCareerBadge(gameState) {
    const icon = getTierIcon(gameState.title);
    const colors = getTierColors(gameState.title);
    const progress = gameState.getXPProgress();

    // Calculate stroke-dasharray for circular progress
    const circumference = 2 * Math.PI * 36; // radius = 36
    const dashOffset = circumference - (progress / 100) * circumference;

    return `
        <div class="career-badge" style="--tier-from: ${colors.from}; --tier-to: ${colors.to}">
            <div class="career-badge__level-ring">
                <svg class="career-badge__progress" viewBox="0 0 80 80">
                    <circle class="career-badge__progress-bg" cx="40" cy="40" r="36"></circle>
                    <circle class="career-badge__progress-fill" cx="40" cy="40" r="36"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="${dashOffset}"></circle>
                </svg>
                <span class="career-badge__level">${gameState.level}</span>
            </div>
            <div class="career-badge__info">
                <span class="career-badge__icon">${icon}</span>
                <span class="career-badge__title">${gameState.title}</span>
                <span class="career-badge__xp">${gameState.xp} XP</span>
            </div>
        </div>
    `;
}

export { renderCareerBadge, getTierIcon, getTierColors };
