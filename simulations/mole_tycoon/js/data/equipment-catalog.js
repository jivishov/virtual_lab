/**
 * Equipment Catalog
 * Defines purchasable equipment items for the store.
 * 
 * Cycle 9: Equipment Upgrades
 */

const EQUIPMENT = [
    {
        id: 'digital-balance',
        name: 'Digital Balance',
        icon: '⚖️',
        cost: 500,
        description: 'Auto-displays molar mass in problems',
        effect: 'showMolarMass',
        tier: 1
    },
    {
        id: 'periodic-table',
        name: 'Periodic Table Display',
        icon: '📊',
        cost: 300,
        description: 'Quick reference for atomic masses',
        effect: 'showPeriodicTable',
        tier: 1
    },
    {
        id: 'calculator',
        name: 'Scientific Calculator',
        icon: '🔢',
        cost: 400,
        description: 'Shows step-by-step calculation hints',
        effect: 'showHints',
        tier: 1
    },
    {
        id: 'fume-hood',
        name: 'Fume Hood Upgrade',
        icon: '🌀',
        cost: 800,
        description: '+10% yield on all contracts',
        effect: 'yieldBonus',
        tier: 2
    },
    {
        id: 'auto-titrator',
        name: 'Auto-Titrator',
        icon: '🧪',
        cost: 1000,
        description: '+5 seconds extra time per question',
        effect: 'bonusTime',
        tier: 2
    },
    {
        id: 'spectrometer',
        name: 'Mass Spectrometer',
        icon: '📡',
        cost: 1500,
        description: 'Reveals one incorrect answer option',
        effect: 'eliminateWrong',
        tier: 3
    }
];

/**
 * Get equipment by ID
 * @param {string} id - Equipment ID
 * @returns {object|null}
 */
function getEquipment(id) {
    return EQUIPMENT.find(e => e.id === id) || null;
}

/**
 * Get all equipment
 * @returns {array}
 */
function getAllEquipment() {
    return EQUIPMENT;
}

/**
 * Get equipment by tier
 * @param {number} tier - Tier level (1, 2, 3)
 * @returns {array}
 */
function getEquipmentByTier(tier) {
    return EQUIPMENT.filter(e => e.tier === tier);
}

// Make globally available
window.EQUIPMENT = EQUIPMENT;

export { EQUIPMENT, getEquipment, getAllEquipment, getEquipmentByTier };
export default EQUIPMENT;
