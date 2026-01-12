/**
 * MoleTycoon Chemistry Data
 * Binary compound database with molar masses and element composition
 */

export const ATOMIC_MASSES = {
  H: 1.008,
  C: 12.011,
  N: 14.007,
  O: 15.999,
  Na: 22.990,
  Mg: 24.305,
  Al: 26.982,
  S: 32.065,
  Cl: 35.453,
  K: 39.098,
  Ca: 40.078,
  Fe: 55.845,
  Br: 79.904
};

export const COMPOUNDS = {
  // Binary Ionic - Halides
  NaCl: {
    name: "Sodium chloride",
    formula: "NaCl",
    molarMass: 58.44,
    elements: { Na: 1, Cl: 1 },
    type: "ionic"
  },
  KBr: {
    name: "Potassium bromide",
    formula: "KBr",
    molarMass: 119.00,
    elements: { K: 1, Br: 1 },
    type: "ionic"
  },
  MgCl2: {
    name: "Magnesium chloride",
    formula: "MgCl₂",
    molarMass: 95.21,
    elements: { Mg: 1, Cl: 2 },
    type: "ionic"
  },
  CaCl2: {
    name: "Calcium chloride",
    formula: "CaCl₂",
    molarMass: 110.98,
    elements: { Ca: 1, Cl: 2 },
    type: "ionic"
  },

  // Binary Ionic - Oxides
  H2O: {
    name: "Water",
    formula: "H₂O",
    molarMass: 18.02,
    elements: { H: 2, O: 1 },
    type: "covalent"
  },
  CO2: {
    name: "Carbon dioxide",
    formula: "CO₂",
    molarMass: 44.01,
    elements: { C: 1, O: 2 },
    type: "covalent"
  },
  CaO: {
    name: "Calcium oxide",
    formula: "CaO",
    molarMass: 56.08,
    elements: { Ca: 1, O: 1 },
    type: "ionic"
  },
  MgO: {
    name: "Magnesium oxide",
    formula: "MgO",
    molarMass: 40.30,
    elements: { Mg: 1, O: 1 },
    type: "ionic"
  },
  Fe2O3: {
    name: "Iron(III) oxide",
    formula: "Fe₂O₃",
    molarMass: 159.69,
    elements: { Fe: 2, O: 3 },
    type: "ionic"
  },
  Al2O3: {
    name: "Aluminum oxide",
    formula: "Al₂O₃",
    molarMass: 101.96,
    elements: { Al: 2, O: 3 },
    type: "ionic"
  },

  // Simple Covalent
  HCl: {
    name: "Hydrogen chloride",
    formula: "HCl",
    molarMass: 36.46,
    elements: { H: 1, Cl: 1 },
    type: "covalent"
  },
  NH3: {
    name: "Ammonia",
    formula: "NH₃",
    molarMass: 17.03,
    elements: { N: 1, H: 3 },
    type: "covalent"
  },

  // For empirical vs molecular formula exercises
  CH2O: {
    name: "Formaldehyde",
    formula: "CH₂O",
    molarMass: 30.03,
    elements: { C: 1, H: 2, O: 1 },
    empirical: "CH₂O",
    molecular: "CH₂O",
    type: "covalent"
  },
  C6H12O6: {
    name: "Glucose",
    formula: "C₆H₁₂O₆",
    molarMass: 180.16,
    elements: { C: 6, H: 12, O: 6 },
    empirical: "CH₂O",
    molecular: "C₆H₁₂O₆",
    type: "covalent"
  },
  C2H6: {
    name: "Ethane",
    formula: "C₂H₆",
    molarMass: 30.07,
    elements: { C: 2, H: 6 },
    empirical: "CH₃",
    molecular: "C₂H₆",
    type: "covalent"
  },
  C4H10: {
    name: "Butane",
    formula: "C₄H₁₀",
    molarMass: 58.12,
    elements: { C: 4, H: 10 },
    empirical: "C₂H₅",
    molecular: "C₄H₁₀",
    type: "covalent"
  }
};

// Chemical reactions for stoichiometry
export const REACTIONS = {
  waterFormation: {
    equation: "2H₂ + O₂ → 2H₂O",
    reactants: { H2: 2, O2: 1 },
    products: { H2O: 2 },
    type: "synthesis"
  },
  rustFormation: {
    equation: "4Fe + 3O₂ → 2Fe₂O₃",
    reactants: { Fe: 4, O2: 3 },
    products: { Fe2O3: 2 },
    type: "synthesis"
  },
  limeBurning: {
    equation: "CaCO₃ → Caite + CO₂",
    reactants: { CaCO3: 1 },
    products: { CaO: 1, CO2: 1 },
    type: "decomposition"
  },
  ammoniaFormation: {
    equation: "N₂ + 3H₂ → 2NH₃",
    reactants: { N2: 1, H2: 3 },
    products: { NH3: 2 },
    type: "synthesis"
  },
  saltFormation: {
    equation: "2Na + Cl₂ → 2NaCl",
    reactants: { Na: 2, Cl2: 1 },
    products: { NaCl: 2 },
    type: "synthesis"
  },
  magnesiumOxide: {
    equation: "2Mg + O₂ → 2MgO",
    reactants: { Mg: 2, O2: 1 },
    products: { MgO: 2 },
    type: "synthesis"
  }
};

// Avogadro's number
export const AVOGADRO = 6.022e23;

// Utility functions
export function getMolarMass(compoundKey) {
  return COMPOUNDS[compoundKey]?.molarMass || null;
}

export function getCompoundList() {
  return Object.keys(COMPOUNDS);
}

export function getRandomCompound(exclude = []) {
  const available = Object.keys(COMPOUNDS).filter(c => !exclude.includes(c));
  return available[Math.floor(Math.random() * available.length)];
}

export function formatFormula(formula) {
  // Convert plain text to subscript HTML
  return formula.replace(/(\d+)/g, '<sub>$1</sub>');
}
