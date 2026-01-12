/**
 * MoleTycoon Game State Manager
 * Manages player economy, progression, and persistence for Lab Tycoon mode.
 * 
 * Cycle 0: Foundation - State Management
 */

const GameState = {
    // ==================== STATE PROPERTIES ====================

    // Economy
    cash: 1000,          // Starting capital ($)

    // Progression
    xp: 0,               // Experience points
    level: 1,            // Current career level
    reputation: 0,       // Unlocks premium contracts

    // Career
    title: 'Intern',     // Display title based on level
    specialization: null, // Track chosen at level 10 (petrochemical, pharmaceutical, agricultural)

    // Stats (for reviews)
    contractsCompleted: 0,
    totalEarnings: 0,
    totalWaste: 0,
    averageYield: 100,

    // Lab Tier (visual progression)
    labTier: 1,          // 1=Garage, 2=Lab, 3=Facility

    // Equipment Owned
    equipment: [],       // Array of owned equipment IDs

    // ==================== LEVEL THRESHOLDS ====================
    levelThresholds: [
        { level: 1, xp: 0, title: 'Intern' },
        { level: 2, xp: 100, title: 'Intern' },
        { level: 3, xp: 250, title: 'Intern' },
        { level: 4, xp: 450, title: 'Intern' },
        { level: 5, xp: 700, title: 'Intern' },
        { level: 6, xp: 1000, title: 'Junior Technician' },
        { level: 7, xp: 1400, title: 'Junior Technician' },
        { level: 8, xp: 1900, title: 'Junior Technician' },
        { level: 9, xp: 2500, title: 'Junior Technician' },
        { level: 10, xp: 3200, title: 'Junior Technician' },
        { level: 11, xp: 4000, title: 'Process Engineer' },
        { level: 12, xp: 5000, title: 'Process Engineer' },
        { level: 13, xp: 6200, title: 'Process Engineer' },
        { level: 14, xp: 7600, title: 'Process Engineer' },
        { level: 15, xp: 9200, title: 'Process Engineer' },
        { level: 16, xp: 11000, title: 'Process Lead' },
        { level: 17, xp: 13000, title: 'Process Lead' },
        { level: 18, xp: 15500, title: 'Process Lead' },
        { level: 19, xp: 18500, title: 'Process Lead' },
        { level: 20, xp: 22000, title: 'Process Lead' },
        { level: 21, xp: 26000, title: 'Plant Manager' },
    ],

    // ==================== PERSISTENCE ====================
    STORAGE_KEY: 'moleville-game-state',

    /**
     * Initialize game state from localStorage or defaults
     */
    init() {
        this.load();
        console.log(`💰 GameState initialized: $${this.cash}, Level ${this.level} (${this.title})`);
    },

    /**
     * Save current state to localStorage
     */
    save() {
        const state = {
            cash: this.cash,
            xp: this.xp,
            level: this.level,
            reputation: this.reputation,
            title: this.title,
            specialization: this.specialization,
            contractsCompleted: this.contractsCompleted,
            totalEarnings: this.totalEarnings,
            totalWaste: this.totalWaste,
            averageYield: this.averageYield,
            labTier: this.labTier,
            equipment: this.equipment,
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
                Object.assign(this, state);
            } catch (e) {
                console.warn('Failed to load game state, using defaults', e);
            }
        }
    },

    /**
     * Reset state to defaults (new game)
     */
    reset() {
        this.cash = 1000;
        this.xp = 0;
        this.level = 1;
        this.reputation = 0;
        this.title = 'Intern';
        this.specialization = null;
        this.contractsCompleted = 0;
        this.totalEarnings = 0;
        this.totalWaste = 0;
        this.averageYield = 100;
        this.labTier = 1;
        this.equipment = [];
        this.save();
        console.log('🔄 GameState reset to defaults');
    },

    // ==================== ECONOMY METHODS ====================

    /**
     * Add cash to player balance
     * @param {number} amount - Amount to add (can be negative for costs)
     * @returns {number} New balance
     */
    addCash(amount) {
        this.cash = Math.max(0, this.cash + amount);
        this.save();
        return this.cash;
    },

    /**
     * Check if player can afford a purchase
     * @param {number} cost - Cost to check
     * @returns {boolean}
     */
    canAfford(cost) {
        return this.cash >= cost;
    },

    /**
     * Spend cash (returns false if insufficient funds)
     * @param {number} amount - Amount to spend
     * @returns {boolean} Success
     */
    spendCash(amount) {
        if (!this.canAfford(amount)) return false;
        this.cash -= amount;
        this.save();
        return true;
    },

    // ==================== PROGRESSION METHODS ====================

    /**
     * Add XP and check for level up
     * @param {number} amount - XP to add
     * @returns {object} { newXP, leveledUp, newLevel, newTitle }
     */
    addXP(amount) {
        this.xp += amount;

        // Check for level up
        const result = { newXP: this.xp, leveledUp: false, newLevel: this.level, newTitle: this.title };

        for (let i = this.levelThresholds.length - 1; i >= 0; i--) {
            if (this.xp >= this.levelThresholds[i].xp) {
                const newLevel = this.levelThresholds[i].level;
                if (newLevel > this.level) {
                    result.leveledUp = true;
                    result.newLevel = newLevel;
                    result.newTitle = this.levelThresholds[i].title;
                    this.level = newLevel;
                    this.title = this.levelThresholds[i].title;
                }
                break;
            }
        }

        this.save();
        return result;
    },

    /**
     * Add reputation points
     * @param {number} amount - Amount to add (can be negative)
     * @returns {number} New reputation
     */
    addReputation(amount) {
        this.reputation = Math.max(0, this.reputation + amount);
        this.save();
        return this.reputation;
    },

    // ==================== STATS METHODS ====================

    /**
     * Record a completed contract
     * @param {number} earnings - Net profit from contract
     * @param {number} waste - Waste incurred (negative value)
     * @param {number} yield - Yield percentage achieved
     */
    recordContract(earnings, waste, yieldPercent) {
        this.contractsCompleted++;
        this.totalEarnings += earnings;
        this.totalWaste += Math.abs(waste);

        // Rolling average of yield
        const totalYield = (this.averageYield * (this.contractsCompleted - 1)) + yieldPercent;
        this.averageYield = Math.round(totalYield / this.contractsCompleted);

        this.save();
    },

    // ==================== EQUIPMENT METHODS ====================

    /**
     * Purchase equipment
     * @param {string} equipmentId - ID of equipment to buy
     * @param {number} cost - Cost of equipment
     * @returns {boolean} Success
     */
    buyEquipment(equipmentId, cost) {
        if (this.hasEquipment(equipmentId)) return false;
        if (!this.spendCash(cost)) return false;

        this.equipment.push(equipmentId);
        this.save();
        return true;
    },

    /**
     * Check if player owns equipment
     * @param {string} equipmentId - ID to check
     * @returns {boolean}
     */
    hasEquipment(equipmentId) {
        return this.equipment.includes(equipmentId);
    },

    // ==================== LAB TIER METHODS ====================

    /**
     * Upgrade lab tier
     * @returns {number} New tier
     */
    upgradeLab() {
        if (this.labTier < 3) {
            this.labTier++;
            this.save();
        }
        return this.labTier;
    },

    /**
     * Get lab tier name
     * @returns {string}
     */
    getLabName() {
        const names = { 1: 'Garage Lab', 2: 'Research Lab', 3: 'Industrial Facility' };
        return names[this.labTier] || 'Unknown';
    },

    /**
     * Get XP progress towards next level as percentage
     * @returns {number} 0-100
     */
    getXPProgress() {
        // Find current and next level thresholds
        let currentThreshold = 0;
        let nextThreshold = 100;

        for (let i = 0; i < this.levelThresholds.length; i++) {
            if (this.levelThresholds[i].level === this.level) {
                currentThreshold = this.levelThresholds[i].xp;
                if (i + 1 < this.levelThresholds.length) {
                    nextThreshold = this.levelThresholds[i + 1].xp;
                } else {
                    // Max level - show full bar
                    return 100;
                }
                break;
            }
        }

        const progress = this.xp - currentThreshold;
        const needed = nextThreshold - currentThreshold;
        return Math.min(100, Math.round((progress / needed) * 100));
    },

    /**
     * Get XP remaining until next level
     * @returns {number}
     */
    getXPToNextLevel() {
        for (let i = 0; i < this.levelThresholds.length; i++) {
            if (this.levelThresholds[i].level === this.level + 1) {
                return this.levelThresholds[i].xp - this.xp;
            }
        }
        return 0; // Max level reached
    },
};

// Make globally available
window.GameState = GameState;

// Export for module usage
export default GameState;
