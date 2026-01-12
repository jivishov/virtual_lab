/**
 * Equipment Effects System
 * Manages active equipment effects during gameplay.
 * 
 * Cycle 9: Equipment Upgrades
 */

import { getEquipment, getAllEquipment } from '../data/equipment-catalog.js';
import GameState from './game-state.js';

const EquipmentEffects = {
    /**
     * Get all active effects from owned equipment
     * @returns {array} Array of effect names
     */
    getActiveEffects() {
        const effects = [];
        for (const equipId of GameState.equipment) {
            const equip = getEquipment(equipId);
            if (equip && equip.effect) {
                effects.push(equip.effect);
            }
        }
        return effects;
    },

    /**
     * Check if player has a specific effect
     * @param {string} effectName - Effect to check
     * @returns {boolean}
     */
    hasEffect(effectName) {
        return this.getActiveEffects().includes(effectName);
    },

    /**
     * Apply equipment effects to question display
     * @param {object} question - Question object
     * @returns {object} Modified question with hints
     */
    applyToQuestion(question) {
        const enhanced = { ...question, hints: [] };

        // Digital Balance: Show molar mass
        if (this.hasEffect('showMolarMass') && question.molarMass) {
            enhanced.hints.push({
                icon: '⚖️',
                label: 'Molar Mass',
                value: `${question.molarMass} g/mol`
            });
        }

        // Show formula if available and periodic table owned
        if (this.hasEffect('showPeriodicTable') && question.formula) {
            enhanced.hints.push({
                icon: '📊',
                label: 'Formula',
                value: question.formula
            });
        }

        // Calculator: Show calculation hints
        if (this.hasEffect('showHints') && question.calculationHint) {
            enhanced.hints.push({
                icon: '🔢',
                label: 'Hint',
                value: question.calculationHint
            });
        }

        return enhanced;
    },

    /**
     * Get yield bonus from equipment
     * @returns {number} Bonus percentage (0-100)
     */
    getYieldBonus() {
        if (this.hasEffect('yieldBonus')) {
            return 10; // +10% yield
        }
        return 0;
    },

    /**
     * Get bonus time from equipment
     * @returns {number} Bonus seconds
     */
    getBonusTime() {
        if (this.hasEffect('bonusTime')) {
            return 5; // +5 seconds
        }
        return 0;
    },

    /**
     * Check if should eliminate a wrong answer
     * @returns {boolean}
     */
    shouldEliminateWrong() {
        return this.hasEffect('eliminateWrong');
    },

    /**
     * Get display data for owned equipment
     * @returns {array} Equipment objects the player owns
     */
    getOwnedEquipment() {
        return GameState.equipment.map(id => getEquipment(id)).filter(Boolean);
    }
};

// Make globally available
window.EquipmentEffects = EquipmentEffects;

export default EquipmentEffects;
