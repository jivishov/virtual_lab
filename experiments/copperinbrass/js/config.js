// config.js - Configuration constants and lookup tables

// Physical/Chemistry constants
export const MOLAR_MASS_CU = 63.55;           // g/mol
export const FLASK_VOLUME = 0.100;             // L (100 mL)
export const MOLAR_ABSORPTIVITY = 2.426;       // slope from Beer's Law (L/(mol·cm))
export const Y_INTERCEPT = -0.00538;           // y-intercept from calibration

// Standard concentrations (mol/L)
export const STANDARDS = [0.1, 0.2, 0.4];

// Expected absorbance values (with small random variation applied during measurement)
export const ABSORBANCE_TABLE = {
    0: 0.000,       // Blank
    0.1: 0.222,     // 0.1M standard
    0.2: 0.442,     // 0.2M standard
    0.4: 0.887      // 0.4M standard
};

// Brass composition (for generating realistic unknown absorbance)
export const BRASS_CU_PERCENT = 0.70;  // ~70% copper in brass

// Volume display settings
export const PIPETTE_FILL_LEVEL = 1;    // Normalized (0-1)
export const CUVETTE_FILL_LEVEL = 40;   // Display units for SVG

// Colors
export const COLORS = {
    acid: '#e74c3c',
    water: '#3498db',
    copper: '#2980b9',
    copperLight: 'rgba(52, 152, 219, 0.6)',
    standard: 'rgba(41, 128, 185, 0.7)',
    brass: 'url(#brass-grad)',
    waste: 'url(#waste-grad)',
    highlight: '#f39c12',
    success: '#27ae60',
    error: '#e74c3c',
    info: '#3498db',
    glass: '#e8eef5',
    transparent: 'transparent'
};

// Gear labels for step tracker and UI
export const GEAR_LABELS = {
    balance: 'Balance',
    brass: 'Brass Sample',
    beaker: '50mL Beaker',
    flask: '100mL Flask',
    pipette: 'Pipette',
    acid: 'Conc. HNO₃',
    water: 'Distilled Water',
    spec: 'Spec 20',
    rack: 'Cuvette Rack',
    cuvette: 'Cuvette',
    std1: '0.1M Standard',
    std2: '0.2M Standard',
    std4: '0.4M Standard',
    waste: 'Waste Beaker',
    notebook: 'Lab Notebook'
};

// Gear pill colors for step tracker
export const GEAR_COLORS = {
    'Balance': '#16a085',
    'Brass Sample': '#d9861f',
    '50mL Beaker': '#1f9df2',
    'Conc. HNO₃': '#d8344c',
    '100mL Flask': '#8e44ad',
    'Pipette': '#e67e22',
    'Distilled Water': '#2d9cdb',
    'Rack': '#5d6d7e',
    'Cuvette Rack': '#5d6d7e',
    'Cuvette': '#2ecc71',
    'Spec 20': '#34495e',
    '0.1M Standard': '#273c75',
    '0.2M Standard': '#273c75',
    '0.4M Standard': '#273c75',
    'Waste Beaker': '#6b4423',
    'Notebook': '#34495e',
    'Lab Notebook': '#34495e'
};

// History stack limit
export const MAX_HISTORY = 10;

// Singleton equipment (only one allowed on workbench)
export const SINGLETONS = [
    'balance', 'brass', 'beaker', 'flask', 'spec', 'rack',
    'waste', 'acid', 'water', 'std1', 'std2', 'std4'
];

// Content type mapping for sources
export const CONTENT_TYPES = {
    acid: 'acid',
    water: 'water',
    std1: 'std_0.1',
    std2: 'std_0.2',
    std4: 'std_0.4',
    beaker: 'copper',
    flask: 'unknown'
};

// Calculate unknown concentration from absorbance
export function calculateConcentration(absorbance) {
    return (absorbance - Y_INTERCEPT) / MOLAR_ABSORPTIVITY;
}

// Calculate mass percent copper
export function calculateMassPercent(concentration, brassMass) {
    const massCu = concentration * FLASK_VOLUME * MOLAR_MASS_CU;
    return (massCu / brassMass) * 100;
}

// Get simulated absorbance for a concentration (with small random variation)
export function getSimulatedAbsorbance(concentration) {
    // For standards, use lookup table
    if (ABSORBANCE_TABLE.hasOwnProperty(concentration)) {
        return ABSORBANCE_TABLE[concentration] + (Math.random() * 0.01 - 0.005);
    }
    // For unknown, calculate from Beer's Law
    return (MOLAR_ABSORPTIVITY * concentration) + Y_INTERCEPT + (Math.random() * 0.01 - 0.005);
}
