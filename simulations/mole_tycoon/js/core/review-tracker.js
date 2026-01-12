/**
 * Review Tracker
 * Tracks contract performance for investor reviews every 10 contracts.
 * 
 * Cycle 7: Investor Review
 */

import GameState from './game-state.js';

const ReviewTracker = {
    // Track contracts since last review
    recentContracts: [],

    // Persistence key
    STORAGE_KEY: 'moleville-review-tracker',

    /**
     * Initialize review tracker
     */
    init() {
        this.load();
        console.log(`📊 ReviewTracker initialized: ${this.recentContracts.length}/10 contracts`);
    },

    /**
     * Save state to localStorage
     */
    save() {
        const state = {
            recentContracts: this.recentContracts,
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    },

    /**
     * Load state from localStorage
     */
    load() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.recentContracts = state.recentContracts || [];
            } catch (e) {
                console.warn('Failed to load review tracker, resetting', e);
                this.recentContracts = [];
            }
        }
    },

    /**
     * Record a contract result for the current review period
     * @param {object} result - Contract result with yieldPercent, netProfit, isCorrect
     */
    recordContract(result) {
        this.recentContracts.push({
            yieldPercent: result.yieldPercent || 0,
            netProfit: result.netProfit || 0,
            isCorrect: result.isCorrect || false,
            timestamp: Date.now(),
        });
        this.save();
    },

    /**
     * Check if investor review is due (every 10 contracts)
     * @returns {boolean}
     */
    isReviewDue() {
        return this.recentContracts.length >= 10;
    },

    /**
     * Get performance data for the current review period
     * @returns {object} Review data with grade, metrics, recommendations
     */
    getReviewData() {
        const contracts = this.recentContracts;
        const count = contracts.length;

        if (count === 0) {
            return {
                grade: 'N/A',
                avgYield: 0,
                totalProfit: 0,
                accuracy: 0,
                canUpgrade: false,
                message: 'No contracts to review',
            };
        }

        // Calculate metrics
        const avgYield = Math.round(
            contracts.reduce((sum, c) => sum + c.yieldPercent, 0) / count
        );
        const totalProfit = contracts.reduce((sum, c) => sum + c.netProfit, 0);
        const accuracy = Math.round(
            (contracts.filter(c => c.isCorrect).length / count) * 100
        );

        // Determine grade based on average yield
        let grade, message, canUpgrade, bonusCash, reputationChange;

        if (avgYield >= 90) {
            grade = 'A';
            message = "Outstanding performance! Your lab is ready for expansion.";
            canUpgrade = GameState.labTier < 3;
            bonusCash = 500;
            reputationChange = 5;
        } else if (avgYield >= 75) {
            grade = 'B';
            message = "Solid work. Keep up the good performance.";
            canUpgrade = false;
            bonusCash = 200;
            reputationChange = 2;
        } else if (avgYield >= 60) {
            grade = 'C';
            message = "Meeting expectations, but there's room for improvement.";
            canUpgrade = false;
            bonusCash = 0;
            reputationChange = 0;
        } else {
            grade = 'D';
            message = "Performance is concerning. We expect better results next quarter.";
            canUpgrade = false;
            bonusCash = 0;
            reputationChange = -3;
        }

        return {
            grade,
            avgYield,
            totalProfit,
            accuracy,
            contractCount: count,
            canUpgrade,
            message,
            bonusCash,
            reputationChange,
            contracts: contracts.slice(-10), // Last 10 for chart
        };
    },

    /**
     * Apply review results to GameState
     * @param {object} reviewData - Data from getReviewData
     * @param {boolean} acceptUpgrade - Whether player accepted the lab upgrade
     * @returns {object} Applied results
     */
    applyReviewResults(reviewData, acceptUpgrade = false) {
        const results = {
            cashAdded: 0,
            reputationChanged: 0,
            labUpgraded: false,
            newLabTier: GameState.labTier,
        };

        // Apply bonus cash
        if (reviewData.bonusCash > 0) {
            GameState.addCash(reviewData.bonusCash);
            results.cashAdded = reviewData.bonusCash;
        }

        // Apply reputation change
        if (reviewData.reputationChange !== 0) {
            GameState.addReputation(reviewData.reputationChange);
            results.reputationChanged = reviewData.reputationChange;
        }

        // Apply lab upgrade if accepted
        if (acceptUpgrade && reviewData.canUpgrade) {
            GameState.upgradeLab();
            results.labUpgraded = true;
            results.newLabTier = GameState.labTier;
        }

        return results;
    },

    /**
     * Clear the review window for next period
     */
    clearReviewWindow() {
        this.recentContracts = [];
        this.save();
    },

    /**
     * Reset tracker (for new game)
     */
    reset() {
        this.recentContracts = [];
        this.save();
    },
};

// Make globally available
window.ReviewTracker = ReviewTracker;

export default ReviewTracker;
