/**
 * Investor Review Modal
 * Displays investor feedback with performance chart and lab upgrade options.
 * 
 * Cycle 7: Investor Review
 */

import ReviewTracker from '../core/review-tracker.js';
import GameState from '../core/game-state.js';

/**
 * Get investor character based on grade
 * @param {string} grade - A/B/C/D
 * @returns {object} { emoji, name, title }
 */
function getInvestor(grade) {
    const investors = {
        'A': { emoji: '🤵', name: 'Victoria Sterling', title: 'CEO, Sterling Ventures' },
        'B': { emoji: '👔', name: 'Marcus Chen', title: 'Partner, TechChem Capital' },
        'C': { emoji: '🧑‍💼', name: 'David Park', title: 'Analyst, ChemInvest LLC' },
        'D': { emoji: '😐', name: 'Susan Miller', title: 'Board Representative' },
    };
    return investors[grade] || investors['C'];
}

/**
 * Get grade styling
 * @param {string} grade - A/B/C/D
 * @returns {object} { color, bg, glow }
 */
function getGradeStyle(grade) {
    const styles = {
        'A': { color: '#00E676', bg: 'rgba(0, 230, 118, 0.2)', glow: '0 0 20px rgba(0, 230, 118, 0.5)' },
        'B': { color: '#00D4FF', bg: 'rgba(0, 212, 255, 0.2)', glow: '0 0 20px rgba(0, 212, 255, 0.5)' },
        'C': { color: '#FFAB40', bg: 'rgba(255, 171, 64, 0.2)', glow: '0 0 20px rgba(255, 171, 64, 0.5)' },
        'D': { color: '#FF5252', bg: 'rgba(255, 82, 82, 0.2)', glow: '0 0 20px rgba(255, 82, 82, 0.5)' },
    };
    return styles[grade] || styles['C'];
}

/**
 * Generate performance chart HTML
 * @param {array} contracts - Recent contracts array
 * @returns {string} HTML string
 */
function renderPerformanceChart(contracts) {
    const maxYield = 100;
    const barWidth = 100 / Math.max(contracts.length, 1);

    const bars = contracts.map((c, i) => {
        const height = Math.max(5, (c.yieldPercent / maxYield) * 100);
        const color = c.yieldPercent >= 90 ? '#00E676' :
            c.yieldPercent >= 75 ? '#00D4FF' :
                c.yieldPercent >= 60 ? '#FFAB40' : '#FF5252';

        return `
            <div class="investor-chart__bar" style="
                height: ${height}%;
                width: ${barWidth}%;
                background: ${color};
            " title="Contract ${i + 1}: ${c.yieldPercent}% yield"></div>
        `;
    }).join('');

    return `
        <div class="investor-chart">
            <div class="investor-chart__bars">${bars}</div>
            <div class="investor-chart__labels">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
            </div>
        </div>
    `;
}

/**
 * Show the investor review modal
 * @param {object} reviewData - Data from ReviewTracker.getReviewData()
 * @param {function} onComplete - Callback when modal is dismissed
 */
function showInvestorReview(reviewData, onComplete) {
    const investor = getInvestor(reviewData.grade);
    const gradeStyle = getGradeStyle(reviewData.grade);

    // Remove any existing modal
    const existing = document.querySelector('.investor-overlay');
    if (existing) existing.remove();

    // Build modal HTML
    const modalHTML = `
        <div class="investor-overlay">
            <div class="investor-modal">
                <div class="investor-header" style="--grade-color: ${gradeStyle.color}; --grade-bg: ${gradeStyle.bg}">
                    <span class="investor-header__icon">${investor.emoji}</span>
                    <div class="investor-header__info">
                        <span class="investor-header__name">${investor.name}</span>
                        <span class="investor-header__title">${investor.title}</span>
                    </div>
                    <div class="investor-header__grade" style="background: ${gradeStyle.bg}; color: ${gradeStyle.color}; box-shadow: ${gradeStyle.glow}">
                        ${reviewData.grade}
                    </div>
                </div>
                
                <h2 class="investor-modal__title">Quarterly Performance Review</h2>
                
                <p class="investor-modal__message">"${reviewData.message}"</p>
                
                <div class="investor-stats">
                    <div class="investor-stat">
                        <span class="investor-stat__value">${reviewData.contractCount}</span>
                        <span class="investor-stat__label">Contracts</span>
                    </div>
                    <div class="investor-stat">
                        <span class="investor-stat__value">${reviewData.avgYield}%</span>
                        <span class="investor-stat__label">Avg Yield</span>
                    </div>
                    <div class="investor-stat">
                        <span class="investor-stat__value">${reviewData.accuracy}%</span>
                        <span class="investor-stat__label">Accuracy</span>
                    </div>
                    <div class="investor-stat investor-stat--profit">
                        <span class="investor-stat__value">$${reviewData.totalProfit.toLocaleString()}</span>
                        <span class="investor-stat__label">Total Profit</span>
                    </div>
                </div>
                
                ${renderPerformanceChart(reviewData.contracts || [])}
                
                ${reviewData.canUpgrade ? `
                    <div class="investor-upgrade">
                        <div class="investor-upgrade__icon">🏭</div>
                        <div class="investor-upgrade__info">
                            <span class="investor-upgrade__title">Lab Upgrade Approved!</span>
                            <span class="investor-upgrade__desc">Your performance has earned a facility expansion.</span>
                        </div>
                    </div>
                ` : ''}
                
                ${reviewData.bonusCash > 0 ? `
                    <div class="investor-bonus">
                        <span class="investor-bonus__icon">💰</span>
                        <span class="investor-bonus__text">Bonus: +$${reviewData.bonusCash}</span>
                    </div>
                ` : ''}
                
                ${reviewData.reputationChange < 0 ? `
                    <div class="investor-warning">
                        <span class="investor-warning__icon">⚠️</span>
                        <span class="investor-warning__text">Reputation: ${reviewData.reputationChange}</span>
                    </div>
                ` : ''}
                
                <button class="btn btn--primary investor-continue" id="investor-continue-btn">
                    ${reviewData.canUpgrade ? '🏭 Accept Upgrade & Continue' : 'Continue'}
                </button>
            </div>
        </div>
    `;

    // Add to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Handle continue button
    const continueBtn = document.getElementById('investor-continue-btn');
    continueBtn.addEventListener('click', () => {
        // Apply results
        const results = ReviewTracker.applyReviewResults(reviewData, reviewData.canUpgrade);

        // Clear review window for next period
        ReviewTracker.clearReviewWindow();

        // Show upgrade animation if upgraded
        if (results.labUpgraded) {
            showLabUpgradeAnimation(results.newLabTier);
        }

        // Remove modal
        const overlay = document.querySelector('.investor-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
                if (onComplete) onComplete(results);
            }, 300);
        }
    });
}

/**
 * Show lab upgrade celebration
 * @param {number} newTier - New lab tier
 */
function showLabUpgradeAnimation(newTier) {
    const tierNames = { 1: 'Garage Lab', 2: 'Research Lab', 3: 'Industrial Facility' };
    const tierEmojis = { 1: '🏠', 2: '🔬', 3: '🏭' };

    const animHTML = `
        <div class="lab-upgrade-animation" id="lab-upgrade-anim">
            <div class="lab-upgrade__content">
                <span class="lab-upgrade__emoji">${tierEmojis[newTier]}</span>
                <h2 class="lab-upgrade__title">Lab Upgraded!</h2>
                <p class="lab-upgrade__name">${tierNames[newTier]}</p>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', animHTML);

    setTimeout(() => {
        const anim = document.getElementById('lab-upgrade-anim');
        if (anim) {
            anim.style.opacity = '0';
            setTimeout(() => anim.remove(), 500);
        }
    }, 2500);
}

// Make available globally
window.showInvestorReview = showInvestorReview;

export { showInvestorReview };
