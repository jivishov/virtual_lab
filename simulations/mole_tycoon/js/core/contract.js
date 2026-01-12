/**
 * MoleTycoon Contract System
 * Wraps chemistry problems in business context for Lab Tycoon mode.
 * 
 * Cycle 1: Contract Engine
 * Cycle 8: Specialization Trees - client filtering and bonuses
 */

import { getSpecialization } from '../data/specializations.js';
import GameState from './game-state.js';

/**
 * Texas-themed clients for contract flavor
 */
const CLIENTS = [
    // Energy Sector
    { name: 'Gulf Coast Refinery', industry: 'energy', icon: '🛢️', location: 'Houston, TX' },
    { name: 'Permian Basin Energy', industry: 'energy', icon: '⛽', location: 'Midland, TX' },
    { name: 'Texas Power Grid', industry: 'energy', icon: '⚡', location: 'Austin, TX' },
    { name: 'Lone Star LNG', industry: 'energy', icon: '🔥', location: 'Corpus Christi, TX' },

    // Medical/Pharmaceutical
    { name: 'Houston Medical Center', industry: 'pharmaceutical', icon: '🏥', location: 'Houston, TX' },
    { name: 'TexMed Labs', industry: 'pharmaceutical', icon: '💊', location: 'Dallas, TX' },
    { name: 'San Antonio Pharma', industry: 'pharmaceutical', icon: '💉', location: 'San Antonio, TX' },

    // Agriculture
    { name: 'West Texas Farms', industry: 'agricultural', icon: '🌾', location: 'Lubbock, TX' },
    { name: 'Rio Grande Agri-Chem', industry: 'agricultural', icon: '🚜', location: 'McAllen, TX' },
    { name: 'Panhandle Fertilizers', industry: 'agricultural', icon: '🌿', location: 'Amarillo, TX' },

    // Aerospace
    { name: 'SpaceX Starbase', industry: 'aerospace', icon: '🚀', location: 'Boca Chica, TX' },
    { name: 'NASA JSC', industry: 'aerospace', icon: '🛰️', location: 'Houston, TX' },

    // General Manufacturing
    { name: 'Texas Instruments', industry: 'manufacturing', icon: '🔧', location: 'Dallas, TX' },
    { name: 'Austin Semiconductors', industry: 'manufacturing', icon: '🖥️', location: 'Austin, TX' },
];

/**
 * Contract urgency levels affect pay and time
 */
const URGENCY_LEVELS = [
    { name: 'Standard', multiplier: 1.0, timeMultiplier: 1.0, color: 'var(--text-muted)' },
    { name: 'Priority', multiplier: 1.25, timeMultiplier: 0.8, color: 'var(--warning)' },
    { name: 'Urgent', multiplier: 1.5, timeMultiplier: 0.6, color: 'var(--error)' },
    { name: 'Rush', multiplier: 2.0, timeMultiplier: 0.4, color: 'var(--secondary)' },
];

/**
 * Base pay rates by TEKS/difficulty
 */
const BASE_PAY = {
    'C.8.A': 100,  // Mole conversions (basic)
    'C.8.C': 150,  // Formula mass
    'C.8.D': 200,  // Stoichiometry
    'C.9.C': 175,  // Molar concentration
    'C.9.D': 250,  // Limiting reactant
    'default': 100,
};

/**
 * Contract class - wraps a question in business context
 */
class Contract {
    constructor(question, options = {}) {
        // Original question data
        this.question = question;

        // Assign client
        this.client = options.client || this.assignClient(question);

        // Assign urgency
        this.urgency = options.urgency || this.assignUrgency();

        // Calculate pay
        this.basePay = BASE_PAY[question.teks] || BASE_PAY.default;

        // Apply specialization bonuses (Cycle 8)
        const spec = getSpecialization(GameState.specialization);
        const payMultiplier = spec ? spec.bonuses.payMultiplier : 1.0;
        const xpMultiplier = spec ? spec.bonuses.xpMultiplier : 1.0;

        this.pay = Math.round(this.basePay * this.urgency.multiplier * payMultiplier);

        // XP reward
        this.xpReward = Math.round((this.basePay / 10) * xpMultiplier);

        // Time limit (in seconds, 0 = no limit for now)
        this.baseTime = 60;
        this.timeLimit = Math.round(this.baseTime * this.urgency.timeMultiplier);

        // Contract ID
        this.id = `contract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Status
        this.status = 'pending'; // pending, completed, failed
        this.yield = null;       // 0-100% based on accuracy
        this.profit = null;      // Final earnings after costs
    }

    /**
     * Assign a client based on question TEKS and player specialization (Cycle 8)
     */
    assignClient(question) {
        // Map TEKS to preferred industries
        const industryMap = {
            'C.8.A': ['manufacturing', 'pharmaceutical'],
            'C.8.C': ['pharmaceutical', 'agricultural'],
            'C.8.D': ['energy', 'aerospace'],
            'C.9.C': ['pharmaceutical', 'agricultural'],
            'C.9.D': ['energy', 'aerospace', 'manufacturing'],
        };

        let preferredIndustries = industryMap[question.teks] || ['manufacturing'];

        // Cycle 8: If player has specialization, prioritize those industries
        const spec = getSpecialization(GameState.specialization);
        if (spec) {
            // Filter to only specialization industries, or use all if no overlap
            const specIndustries = spec.industries;
            const overlap = preferredIndustries.filter(i => specIndustries.includes(i));
            if (overlap.length > 0) {
                preferredIndustries = overlap;
            } else {
                // If no overlap, use specialization industries anyway for flavor
                preferredIndustries = specIndustries;
            }
        }

        const preferredClients = CLIENTS.filter(c => preferredIndustries.includes(c.industry));
        const pool = preferredClients.length > 0 ? preferredClients : CLIENTS;

        return pool[Math.floor(Math.random() * pool.length)];
    }

    /**
     * Assign urgency level (weighted towards Standard)
     */
    assignUrgency() {
        const roll = Math.random();
        if (roll < 0.5) return URGENCY_LEVELS[0];      // 50% Standard
        if (roll < 0.75) return URGENCY_LEVELS[1];     // 25% Priority
        if (roll < 0.9) return URGENCY_LEVELS[2];      // 15% Urgent
        return URGENCY_LEVELS[3];                       // 10% Rush
    }

    /**
     * Complete the contract with a result
     * @param {boolean} isCorrect - Whether the answer was correct
     * @param {number} timeTaken - Seconds taken to answer
     * @returns {object} Result with yield, profit, xp
     */
    complete(isCorrect, timeTaken = 0) {
        if (isCorrect) {
            // Calculate yield based on time (faster = better)
            const timeRatio = this.timeLimit > 0 ? timeTaken / this.timeLimit : 0.5;
            if (timeRatio <= 0.5) {
                this.yield = 100;  // Fast = perfect yield
            } else if (timeRatio <= 1.0) {
                this.yield = 90;   // On time = great yield
            } else {
                this.yield = 75;   // Overtime = good yield
            }

            this.profit = Math.round(this.pay * (this.yield / 100));
            this.status = 'completed';
        } else {
            // Wrong answer = waste/loss
            this.yield = 0;
            this.profit = -Math.round(this.pay * 0.25);  // Lose 25% as waste cost
            this.status = 'failed';
        }

        return {
            isCorrect,
            yield: this.yield,
            profit: this.profit,
            xp: isCorrect ? this.xpReward : 0,
            status: this.status,
        };
    }

    /**
     * Render contract header HTML
     */
    renderHeader() {
        return `
            <div class="contract-header">
                <div class="contract-client">
                    <span class="contract-client__icon">${this.client.icon}</span>
                    <div class="contract-client__info">
                        <strong class="contract-client__name">${this.client.name}</strong>
                        <small class="contract-client__location">📍 ${this.client.location}</small>
                    </div>
                </div>
                <div class="contract-meta">
                    <span class="contract-urgency" style="color: ${this.urgency.color}">${this.urgency.name}</span>
                    <span class="contract-pay">💰 $${this.pay}</span>
                    <span class="contract-xp">⭐ +${this.xpReward} XP</span>
                </div>
            </div>
        `;
    }

    /**
     * Get the underlying question
     */
    getQuestion() {
        return this.question;
    }
}

// Export
export { Contract, CLIENTS, URGENCY_LEVELS, BASE_PAY };
export default Contract;
