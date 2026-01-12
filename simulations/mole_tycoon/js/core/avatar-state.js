/**
 * MoleTycoon Avatar State Manager
 * Manages Energy and Mood mechanics for the Living Avatar system.
 * 
 * Cycle 4: Living Avatar
 */

/**
 * Mood types with their effects
 */
const MOODS = {
    happy: {
        name: 'Happy',
        emoji: '😊',
        xpModifier: 1.05,    // +5% XP
        cashModifier: 1.0,
        description: 'On a roll! +5% XP',
    },
    neutral: {
        name: 'Neutral',
        emoji: '😐',
        xpModifier: 1.0,
        cashModifier: 1.0,
        description: 'Focused and ready.',
    },
    stressed: {
        name: 'Stressed',
        emoji: '😰',
        xpModifier: 0.95,    // -5% XP
        cashModifier: 1.0,
        description: 'Feeling the pressure. -5% XP',
    },
};

/**
 * Energy thresholds for visual states
 */
const ENERGY_THRESHOLDS = {
    high: 70,      // Green zone
    medium: 30,    // Yellow warning zone
    low: 0,        // Red danger zone
};

/**
 * Avatar State Manager
 */
const AvatarState = {
    // ==================== STATE PROPERTIES ====================

    energy: 100,           // 0-100 scale
    maxEnergy: 100,
    mood: 'neutral',       // 'happy', 'neutral', 'stressed'
    streak: 0,             // Consecutive correct answers
    totalCorrect: 0,       // Session total
    totalWrong: 0,         // Session total

    // Energy drain per contract (base value)
    energyDrainPerContract: 12,

    // Streak thresholds
    happyStreakThreshold: 3,    // 3+ correct = happy
    stressedWrongCount: 2,      // 2+ wrong in last 5 = stressed
    recentAnswers: [],          // Track last 5 answers

    // Persistence key
    STORAGE_KEY: 'moleville-avatar-state',

    // ==================== INITIALIZATION ====================

    /**
     * Initialize avatar state
     */
    init() {
        this.load();
        console.log(`👤 Avatar initialized: Energy ${this.energy}, Mood ${this.mood}`);
    },

    /**
     * Reset state for a new shift/session
     */
    resetForShift() {
        this.energy = this.maxEnergy;
        this.mood = 'neutral';
        this.streak = 0;
        this.totalCorrect = 0;
        this.totalWrong = 0;
        this.recentAnswers = [];
        this.save();
        console.log('👤 Avatar reset for new shift');
    },

    // ==================== ENERGY METHODS ====================

    /**
     * Drain energy after completing a contract
     * @param {number} baseDrain - Base drain amount (default: energyDrainPerContract)
     * @returns {object} { newEnergy, isDepleted, level }
     */
    drainEnergy(baseDrain = this.energyDrainPerContract) {
        // Mood affects energy drain
        let drain = baseDrain;
        if (this.mood === 'stressed') {
            drain = Math.round(baseDrain * 1.2); // Stressed = faster drain
        } else if (this.mood === 'happy') {
            drain = Math.round(baseDrain * 0.8); // Happy = slower drain
        }

        this.energy = Math.max(0, this.energy - drain);
        this.save();

        const level = this.getEnergyLevel();
        console.log(`⚡ Energy: ${this.energy} (-${drain}) [${level}]`);

        return {
            newEnergy: this.energy,
            isDepleted: this.energy <= 0,
            level,
            drained: drain,
        };
    },

    /**
     * Restore energy (for future lunch break feature)
     * @param {number} amount - Amount to restore
     */
    restoreEnergy(amount) {
        this.energy = Math.min(this.maxEnergy, this.energy + amount);
        this.save();
        console.log(`☕ Energy restored: ${this.energy} (+${amount})`);
        return this.energy;
    },

    /**
     * Get current energy level category
     * @returns {string} 'high', 'medium', or 'low'
     */
    getEnergyLevel() {
        if (this.energy >= ENERGY_THRESHOLDS.high) return 'high';
        if (this.energy >= ENERGY_THRESHOLDS.medium) return 'medium';
        return 'low';
    },

    /**
     * Check if avatar has enough energy to continue
     */
    hasEnergy() {
        return this.energy > 0;
    },

    // ==================== MOOD METHODS ====================

    /**
     * Update mood based on answer result
     * @param {boolean} isCorrect - Whether the answer was correct
     * @returns {object} { newMood, changed, moodData }
     */
    updateMood(isCorrect) {
        const oldMood = this.mood;

        // Track answer
        this.recentAnswers.push(isCorrect);
        if (this.recentAnswers.length > 5) {
            this.recentAnswers.shift(); // Keep only last 5
        }

        if (isCorrect) {
            this.streak++;
            this.totalCorrect++;

            // Check for happy mood
            if (this.streak >= this.happyStreakThreshold) {
                this.mood = 'happy';
            } else if (this.mood === 'stressed') {
                // One correct answer relieves stress
                this.mood = 'neutral';
            }
        } else {
            this.streak = 0;
            this.totalWrong++;

            // Check recent performance for stress
            const recentWrong = this.recentAnswers.filter(a => !a).length;
            if (recentWrong >= this.stressedWrongCount) {
                this.mood = 'stressed';
            } else if (this.mood === 'happy') {
                // Wrong answer breaks happy streak
                this.mood = 'neutral';
            }
        }

        this.save();

        const changed = oldMood !== this.mood;
        if (changed) {
            console.log(`🎭 Mood changed: ${oldMood} → ${this.mood}`);
        }

        return {
            newMood: this.mood,
            changed,
            moodData: MOODS[this.mood],
            streak: this.streak,
        };
    },

    /**
     * Get current mood effects (XP/cash modifiers)
     * @returns {object} { xpModifier, cashModifier, name, emoji, description }
     */
    getMoodEffects() {
        return MOODS[this.mood];
    },

    /**
     * Get current mood data
     */
    getMoodData() {
        return {
            mood: this.mood,
            ...MOODS[this.mood],
            streak: this.streak,
        };
    },

    // ==================== PERSISTENCE ====================

    /**
     * Save state to localStorage
     */
    save() {
        const state = {
            energy: this.energy,
            mood: this.mood,
            streak: this.streak,
            totalCorrect: this.totalCorrect,
            totalWrong: this.totalWrong,
            recentAnswers: this.recentAnswers,
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    },

    /**
     * Load state from localStorage
     */
    load() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                const state = JSON.parse(saved);
                this.energy = state.energy ?? this.maxEnergy;
                this.mood = state.mood ?? 'neutral';
                this.streak = state.streak ?? 0;
                this.totalCorrect = state.totalCorrect ?? 0;
                this.totalWrong = state.totalWrong ?? 0;
                this.recentAnswers = state.recentAnswers ?? [];
            }
        } catch (e) {
            console.warn('Could not load avatar state:', e);
        }
    },

    /**
     * Reset to defaults
     */
    reset() {
        this.energy = this.maxEnergy;
        this.mood = 'neutral';
        this.streak = 0;
        this.totalCorrect = 0;
        this.totalWrong = 0;
        this.recentAnswers = [];
        localStorage.removeItem(this.STORAGE_KEY);
        console.log('👤 Avatar state reset');
    },

    // ==================== UI HELPERS ====================

    /**
     * Get energy bar color based on level
     */
    getEnergyColor() {
        const level = this.getEnergyLevel();
        switch (level) {
            case 'high': return 'var(--success)';
            case 'medium': return 'var(--warning)';
            case 'low': return 'var(--error)';
            default: return 'var(--text-muted)';
        }
    },

    /**
     * Get energy percentage for bar
     */
    getEnergyPercent() {
        return Math.round((this.energy / this.maxEnergy) * 100);
    },
};

// Make globally available
window.AvatarState = AvatarState;

// Export
export { AvatarState, MOODS, ENERGY_THRESHOLDS };
export default AvatarState;
