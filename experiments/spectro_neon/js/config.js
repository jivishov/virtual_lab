// config.js - Physical Beer-Lambert Constants, Pipette Roles & 3D Lab Layout

// Physical / Simulation constants (identical to original spectrophotometry lab)
export const STOCK_CONCENTRATION = 2.31; // µM FD&C Blue #1
export const TARGET_WAVELENGTH = 630;    // nm (λmax for Blue #1)
export const KNOWN_SLOPE = 0.1358;       // Abs / µM
export const MAX_ABS = 1.5;
export const RINSE_VOLUME = 3;           // mL used for cuvette sample & rinse

// UI / Appearance constants
export const WATER_COLOR_COMPONENTS = { r: 205, g: 232, b: 255, a: 0.34 };
export const STOCK_COLOR_COMPONENTS = { r: 4, g: 52, b: 238, a: 0.92 };
export const UNKNOWN_COLOR_COMPONENTS = { r: 112, g: 24, b: 224, a: 0.88 };

export const COLORS = {
    glass: '#ddd',
    label: '#333',
    error: '#ef4444',
    success: '#22c55e',
    info: '#38bdf8',
    highlight: '#f59e0b',
};

// Exact Beer-Lambert Transmittance Lookup Table (%T vs µM)
export const TRANSMITTANCE_LOOKUP = {
    0: 100.0,
    0.231: 95.0,
    0.462: 87.0,
    0.693: 81.0,
    0.924: 77.0,
    1.39: 65.0,
    1.85: 58.0,
    2.31: 49.0,
};

// Dedicated Pipettes per Liquid Type (prevents cross-contamination while keeping all 84 steps identical)
export const PIPETTE_ROLES = {
    pipette_stock: {
        id: 'pipette_stock',
        label: 'Blue #1 Pipette',
        shortLabel: 'Blue #1',
        liquidType: 'stock',
        accentHex: '#2563eb',
        allowedSources: ['stockBottle', 'tube_10_0', 'tube_8_2', 'tube_6_4', 'tube_4_6', 'tube_2_8'],
        description: 'Dedicated to Stock Blue #1 and Blue #1 dilution tubes',
    },
    pipette_water: {
        id: 'pipette_water',
        label: 'Water (H₂O) Pipette',
        shortLabel: 'H₂O',
        liquidType: 'water',
        accentHex: '#06b6d4',
        allowedSources: ['waterBottle', 'tube_0_10'],
        description: 'Dedicated to Distilled H₂O and Blank (0/10)',
    },
    pipette_unknown: {
        id: 'pipette_unknown',
        label: 'Unknown Pipette',
        shortLabel: 'Unknown',
        liquidType: 'unknown',
        accentHex: '#9333ea',
        allowedSources: ['unknownBottle'],
        description: 'Dedicated to Unknown Drink sample',
    },
};

export function getRequiredPipetteForSource(sourceId) {
    for (const role of Object.values(PIPETTE_ROLES)) {
        if (role.allowedSources.includes(sourceId)) return role;
    }
    return null;
}

// 3D Lab Bench World Coordinates (Three.js Y-up: +X right, +Y up, +Z toward viewer)
// Carefully spaced so ALL bottles, ALL 3 pipettes, ALL 6 tubes, cuvette, waste beaker,
// and Spec 20 display + buttons are 100% unobscured simultaneously from the overview camera.
const STAND_POS = { x: -0.54, y: 0.0, z: 0.08 };
const STAND_ROT_Y = 0.26; // +15 deg inward toward viewer

function standSlotWorld(localX) {
    const c = Math.cos(STAND_ROT_Y);
    const s = Math.sin(STAND_ROT_Y);
    return {
        x: STAND_POS.x + localX * c,
        y: 0.016,
        z: STAND_POS.z - localX * s,
    };
}

export const LAYOUT_3D = {
    bench: { x: 0, y: 0, z: 0, rotY: 0 },

    // Back-left reagent bottles (staggered clearly behind & right of pipette stand)
    stockBottle:   { x: -0.40,  y: 0, z: -0.18, rotY: 0.08 },
    waterBottle:   { x: -0.285, y: 0, z: -0.18, rotY: 0.04 },
    unknownBottle: { x: -0.18,  y: 0, z: -0.18, rotY: 0.02 },

    // Front-left 3-slot dedicated pipette stand & its 3 pipettes
    pipetteStand: { x: STAND_POS.x, y: STAND_POS.y, z: STAND_POS.z, rotY: STAND_ROT_Y },
    pipette_stock:   { ...standSlotWorld(-0.056), rotY: STAND_ROT_Y },
    pipette_water:   { ...standSlotWorld(0.0),    rotY: STAND_ROT_Y },
    pipette_unknown: { ...standSlotWorld(0.056),  rotY: STAND_ROT_Y },

    // Center-back 6-slot test tube rack & 6 tubes
    testTubeRack: { x: 0.055, y: 0, z: -0.145, rotY: 0 },
    tube_10_0: { x: 0.055 - 0.105, y: 0.015, z: -0.145, rotY: 0 },
    tube_8_2:  { x: 0.055 - 0.063, y: 0.015, z: -0.145, rotY: 0 },
    tube_6_4:  { x: 0.055 - 0.021, y: 0.015, z: -0.145, rotY: 0 },
    tube_4_6:  { x: 0.055 + 0.021, y: 0.015, z: -0.145, rotY: 0 },
    tube_2_8:  { x: 0.055 + 0.063, y: 0.015, z: -0.145, rotY: 0 },
    tube_0_10: { x: 0.055 + 0.105, y: 0.015, z: -0.145, rotY: 0 },

    // Center-front optical cuvette holder & cuvette
    cuvetteHolder: { x: 0.01, y: 0, z: 0.135, rotY: 0 },
    cuvette:       { x: 0.01, y: 0.005, z: 0.135, rotY: 0 },

    // Right-front 250 mL Griffin waste beaker
    wasteBeaker: { x: 0.185, y: 0, z: 0.135, rotY: -0.12 },

    // Right-back Spectronic 20D+ digital spectrophotometer (angled gently toward scientist)
    spec20: { x: 0.455, y: 0, z: -0.115, rotY: -0.24 },
};

// Camera Presets for comfortable 3D navigation
export const CAMERA_PRESETS = {
    overview: {
        label: 'Bench Overview',
        pos: [0.0, 0.48, 1.06],
        target: [0.0, 0.10, -0.03],
    },
    reagents: {
        label: 'Reagents & Pipettes',
        pos: [-0.39, 0.34, 0.56],
        target: [-0.36, 0.11, -0.06],
    },
    rack: {
        label: 'Dilution Rack',
        pos: [0.05, 0.29, 0.44],
        target: [0.04, 0.08, -0.05],
    },
    spec20: {
        label: 'Spec 20D+ Close-Up',
        pos: [0.33, 0.28, 0.36],
        target: [0.43, 0.10, -0.10],
    },
};
