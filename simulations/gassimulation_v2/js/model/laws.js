/**
 * The five gas laws as constraints on PV = nRT.
 * held:     variables kept constant in this law
 * varies:   variables the student changes
 * responds: the variable the model solves for
 * invariant: the quantity that stays constant at equilibrium
 * axes:     the relationship to plot
 */
export const LAWS = Object.freeze({
  boyle: {
    id: 'boyle',
    name: "Boyle's law",
    origin: 'Robert Boyle, 1662',
    relation: 'P₁V₁ = P₂V₂',
    tex: 'P_1V_1 = P_2V_2',
    statement: 'At constant temperature and amount of gas, pressure is inversely proportional to volume.',
    held: ['T', 'n'], varies: ['V'], responds: 'P',
    invariant: { label: 'PV', tex: 'PV', unit: 'L·atm', of: (s) => s.P * s.V },
    axes: { x: 'V', y: 'P' },
  },
  charles: {
    id: 'charles',
    name: "Charles's law",
    origin: 'Jacques Charles, about 1787; published by Gay-Lussac, 1802',
    relation: 'V₁/T₁ = V₂/T₂',
    tex: '\\frac{V_1}{T_1} = \\frac{V_2}{T_2}',
    statement: 'At constant pressure and amount of gas, volume is directly proportional to absolute temperature.',
    held: ['P', 'n'], varies: ['T'], responds: 'V',
    invariant: { label: 'V/T', tex: '\\frac{V}{T}', unit: 'L/K', of: (s) => s.V / s.T },
    axes: { x: 'T', y: 'V' },
  },
  gayLussac: {
    id: 'gayLussac',
    name: "Gay-Lussac's law",
    origin: 'Joseph Louis Gay-Lussac, 1802 (also called Amontons\'s law, 1702)',
    relation: 'P₁/T₁ = P₂/T₂',
    tex: '\\frac{P_1}{T_1} = \\frac{P_2}{T_2}',
    statement: 'At constant volume and amount of gas, pressure is directly proportional to absolute temperature.',
    held: ['V', 'n'], varies: ['T'], responds: 'P',
    invariant: { label: 'P/T', tex: '\\frac{P}{T}', unit: 'atm/K', of: (s) => s.P / s.T },
    axes: { x: 'T', y: 'P' },
  },
  avogadro: {
    id: 'avogadro',
    name: "Avogadro's law",
    origin: 'Amedeo Avogadro, 1811',
    relation: 'V₁/n₁ = V₂/n₂',
    tex: '\\frac{V_1}{n_1} = \\frac{V_2}{n_2}',
    statement: 'At constant temperature and pressure, volume is directly proportional to the amount of gas, whatever the gas.',
    held: ['P', 'T'], varies: ['n'], responds: 'V',
    invariant: { label: 'V/n', tex: '\\frac{V}{n}', unit: 'L/mol', of: (s) => (s.n > 1e-9 ? s.V / s.n : NaN) },
    axes: { x: 'n', y: 'V' },
  },
  ideal: {
    id: 'ideal',
    name: 'Ideal gas law',
    origin: 'Émile Clapeyron, 1834',
    relation: 'PV = nRT',
    tex: 'PV = nRT',
    statement: 'Pressure, volume, temperature and amount are linked by one equation. Every other gas law is a special case.',
    held: [], varies: ['n', 'T', 'V'], responds: 'P',
    invariant: { label: 'PV/(nT)', tex: '\\frac{PV}{nT}', unit: 'L·atm/(mol·K)', of: (s) => (s.n > 1e-9 ? (s.P * s.V) / (s.n * s.T) : NaN) },
    axes: { x: 'T', y: 'P' },
  },
});
