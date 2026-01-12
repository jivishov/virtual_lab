/**
 * Specialization Tracks
 * Defines the 3 career paths available at Level 10.
 * 
 * Cycle 8: Specialization Trees
 */

const SPECIALIZATIONS = {
    petrochemical: {
        id: 'petrochemical',
        name: 'Petrochemical Engineer',
        icon: '🛢️',
        description: 'Combustion reactions, energy calculations, and fuel chemistry',
        tagline: 'Power the world with precision chemistry',
        industries: ['energy', 'aerospace'],
        bonuses: {
            payMultiplier: 1.15,
            xpMultiplier: 1.1
        },
        color: '#FF6B35',
        gradient: 'linear-gradient(135deg, #FF6B35 0%, #F7931A 100%)',
        skills: ['Combustion Analysis', 'Energy Yield', 'Fuel Optimization']
    },
    pharmaceutical: {
        id: 'pharmaceutical',
        name: 'Pharmaceutical Scientist',
        icon: '💊',
        description: 'Drug dosing, purity analysis, and medical solutions',
        tagline: 'Heal the world with molecular precision',
        industries: ['pharmaceutical'],
        bonuses: {
            payMultiplier: 1.2,
            xpMultiplier: 1.15
        },
        color: '#4ECDC4',
        gradient: 'linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)',
        skills: ['Dosage Calculation', 'Purity Analysis', 'Solution Prep']
    },
    agricultural: {
        id: 'agricultural',
        name: 'Agricultural Chemist',
        icon: '🌾',
        description: 'Fertilizers, soil chemistry, and crop nutrition',
        tagline: 'Feed the world with sustainable science',
        industries: ['agricultural'],
        bonuses: {
            payMultiplier: 1.1,
            xpMultiplier: 1.2
        },
        color: '#45B7D1',
        gradient: 'linear-gradient(135deg, #45B7D1 0%, #96CEB4 100%)',
        skills: ['Fertilizer Formulation', 'Soil Analysis', 'Nutrient Balance']
    }
};

/**
 * Get specialization by ID
 * @param {string} id - Specialization ID
 * @returns {object|null} Specialization data
 */
function getSpecialization(id) {
    return SPECIALIZATIONS[id] || null;
}

/**
 * Get all specializations as array
 * @returns {array} Array of specialization objects
 */
function getAllSpecializations() {
    return Object.values(SPECIALIZATIONS);
}

/**
 * Check if an industry matches a specialization
 * @param {string} specId - Specialization ID
 * @param {string} industry - Industry to check
 * @returns {boolean}
 */
function industryMatchesSpecialization(specId, industry) {
    const spec = SPECIALIZATIONS[specId];
    if (!spec) return true; // No specialization = all industries
    return spec.industries.includes(industry);
}

// Make globally available
window.SPECIALIZATIONS = SPECIALIZATIONS;

export { SPECIALIZATIONS, getSpecialization, getAllSpecializations, industryMatchesSpecialization };
export default SPECIALIZATIONS;
