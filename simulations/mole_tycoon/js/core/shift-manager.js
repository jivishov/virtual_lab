/**
 * MoleTycoon Shift Manager
 * Manages shift-based gameplay with time-boxed sessions and bonuses.
 * 
 * Cycle 3: Shift System
 */

import GameState from './game-state.js';

/**
 * Shift type definitions with bonuses
 */
const SHIFT_TYPES = {
    morning: {
        id: 'morning',
        name: 'Morning Shift',
        hours: '6 AM - 2 PM',
        icon: '🌅',
        contractCount: 5,
        bonuses: {
            xp: 1.10,      // +10% XP
            cash: 1.0,     // Standard cash
        },
        description: 'Early bird bonus! +10% XP on all contracts.',
        color: 'var(--warning)',  // Orange/yellow
    },
    afternoon: {
        id: 'afternoon',
        name: 'Afternoon Shift',
        hours: '2 PM - 10 PM',
        icon: '☀️',
        contractCount: 6,
        bonuses: {
            xp: 1.0,       // Standard XP
            cash: 1.0,     // Standard cash
        },
        description: 'Standard shift. More contracts available.',
        color: 'var(--primary)',  // Blue
    },
    night: {
        id: 'night',
        name: 'Night Shift',
        hours: '10 PM - 6 AM',
        icon: '🌙',
        contractCount: 5,
        bonuses: {
            xp: 1.0,       // Standard XP
            cash: 1.20,    // +20% cash
        },
        description: 'Night differential! +20% cash on all contracts.',
        color: 'var(--secondary)',  // Purple
    },
};

/**
 * ShiftManager - Handles shift lifecycle and tracking
 */
const ShiftManager = {
    // Current shift state
    isActive: false,
    currentShift: null,
    shiftStartTime: null,

    // Shift statistics
    contractsCompleted: 0,
    contractsTotal: 0,
    shiftEarnings: 0,
    shiftBonusEarnings: 0,
    shiftXP: 0,
    shiftBonusXP: 0,
    yieldSum: 0,
    successfulContracts: 0,

    // Contract results for paystub
    contractResults: [],

    /**
     * Get all available shift types
     */
    getShiftTypes() {
        return Object.values(SHIFT_TYPES);
    },

    /**
     * Get a specific shift type by ID
     */
    getShiftType(shiftId) {
        return SHIFT_TYPES[shiftId] || null;
    },

    /**
     * Start a new shift
     * @param {string} shiftType - 'morning', 'afternoon', or 'night'
     * @returns {object} Shift info
     */
    startShift(shiftType) {
        const shift = SHIFT_TYPES[shiftType];
        if (!shift) {
            console.error(`Invalid shift type: ${shiftType}`);
            return null;
        }

        // Reset shift state
        this.isActive = true;
        this.currentShift = shift;
        this.shiftStartTime = Date.now();
        this.contractsCompleted = 0;
        this.contractsTotal = shift.contractCount;
        this.shiftEarnings = 0;
        this.shiftBonusEarnings = 0;
        this.shiftXP = 0;
        this.shiftBonusXP = 0;
        this.yieldSum = 0;
        this.successfulContracts = 0;
        this.contractResults = [];

        console.log(`🕐 Started ${shift.name} (${shift.hours})`);

        return {
            shift,
            contractsTotal: this.contractsTotal,
        };
    },

    /**
     * Get current shift bonuses (multipliers)
     * @returns {object|null} { xp, cash } multipliers or null if no active shift
     */
    getShiftBonuses() {
        if (!this.isActive || !this.currentShift) {
            return { xp: 1.0, cash: 1.0 };  // No bonuses when not in a shift
        }
        return this.currentShift.bonuses;
    },

    /**
     * Record a completed contract during the shift
     * @param {object} result - Contract result from yield-calculator
     * @returns {object} Updated result with shift bonuses applied
     */
    recordContract(result) {
        if (!this.isActive) return result;

        const bonuses = this.getShiftBonuses();

        // Calculate bonus amounts
        const baseCash = result.netProfit;
        const baseXP = result.xpEarned;

        // Apply shift multipliers
        const bonusCash = result.isCorrect ? Math.round(baseCash * (bonuses.cash - 1)) : 0;
        const bonusXP = result.isCorrect ? Math.round(baseXP * (bonuses.xp - 1)) : 0;

        // Update totals
        this.contractsCompleted++;
        this.shiftEarnings += baseCash;
        this.shiftBonusEarnings += bonusCash;
        this.shiftXP += baseXP;
        this.shiftBonusXP += bonusXP;

        if (result.isCorrect) {
            this.successfulContracts++;
            this.yieldSum += result.yieldPercent;
        }

        // Apply bonus to GameState
        if (bonusCash > 0) {
            GameState.addCash(bonusCash);
        }
        if (bonusXP > 0) {
            GameState.addXP(bonusXP);
        }

        // Store result with bonus info
        const enhancedResult = {
            ...result,
            shiftBonusCash: bonusCash,
            shiftBonusXP: bonusXP,
            totalCash: baseCash + bonusCash,
            totalXP: baseXP + bonusXP,
        };
        this.contractResults.push(enhancedResult);

        console.log(`📋 Contract ${this.contractsCompleted}/${this.contractsTotal} complete. Bonus: +$${bonusCash}, +${bonusXP} XP`);

        return enhancedResult;
    },

    /**
     * Check if shift is complete (all contracts done)
     */
    isShiftComplete() {
        return this.isActive && this.contractsCompleted >= this.contractsTotal;
    },

    /**
     * Get remaining contracts in shift
     */
    getRemainingContracts() {
        return Math.max(0, this.contractsTotal - this.contractsCompleted);
    },

    /**
     * End the current shift and generate paystub
     * @returns {object} Paystub data
     */
    endShift() {
        if (!this.isActive) return null;

        const shift = this.currentShift;
        const shiftDuration = Math.round((Date.now() - this.shiftStartTime) / 1000);
        const avgYield = this.successfulContracts > 0
            ? Math.round(this.yieldSum / this.successfulContracts)
            : 0;

        const paystub = {
            shift: {
                id: shift.id,
                name: shift.name,
                hours: shift.hours,
                icon: shift.icon,
                color: shift.color,
            },
            date: new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }),
            duration: shiftDuration,

            // Contract stats
            contractsCompleted: this.contractsCompleted,
            contractsTotal: this.contractsTotal,
            successfulContracts: this.successfulContracts,
            failedContracts: this.contractsCompleted - this.successfulContracts,
            avgYield,

            // Earnings breakdown
            grossEarnings: this.shiftEarnings,
            shiftBonus: this.shiftBonusEarnings,
            bonusType: this.getBonusDescription(),
            totalEarnings: this.shiftEarnings + this.shiftBonusEarnings,

            // XP breakdown
            baseXP: this.shiftXP,
            bonusXP: this.shiftBonusXP,
            totalXP: this.shiftXP + this.shiftBonusXP,

            // Current player state
            currentCash: GameState.cash,
            currentLevel: GameState.level,
            currentTitle: GameState.title,
        };

        // Reset shift state
        this.isActive = false;
        this.currentShift = null;

        console.log(`🏁 Shift ended. Total: $${paystub.totalEarnings}, ${paystub.totalXP} XP`);

        return paystub;
    },

    /**
     * Get description of current shift bonus
     */
    getBonusDescription() {
        if (!this.currentShift) return '';

        const bonuses = this.currentShift.bonuses;
        if (bonuses.xp > 1) {
            return `XP Bonus (+${Math.round((bonuses.xp - 1) * 100)}%)`;
        }
        if (bonuses.cash > 1) {
            return `Night Differential (+${Math.round((bonuses.cash - 1) * 100)}%)`;
        }
        return 'Standard Rate';
    },

    /**
     * Cancel current shift (abandon)
     */
    cancelShift() {
        if (!this.isActive) return;

        console.log('❌ Shift cancelled');
        this.isActive = false;
        this.currentShift = null;
    },

    /**
     * Get current shift progress for UI display
     */
    getProgress() {
        if (!this.isActive) return null;

        return {
            shift: this.currentShift,
            completed: this.contractsCompleted,
            total: this.contractsTotal,
            remaining: this.getRemainingContracts(),
            progress: Math.round((this.contractsCompleted / this.contractsTotal) * 100),
            earnings: this.shiftEarnings + this.shiftBonusEarnings,
            xp: this.shiftXP + this.shiftBonusXP,
        };
    },
};

// Make globally available
window.ShiftManager = ShiftManager;

export { ShiftManager, SHIFT_TYPES };
export default ShiftManager;
