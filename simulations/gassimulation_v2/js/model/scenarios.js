/**
 * Five real-world scenarios, one per law. Each owns its scale, instrument,
 * thermal behavior, readouts and realistic events.
 *
 * Shape:
 *   presets[]        starting configurations; the first is the default
 *   initial(preset)  -> { P, V, T, n, Tenv } consistent with PV = nRT
 *   inputs           what the student controls: V (volume), Tenv (surroundings), n (gas added)
 *                    min/max may be functions of the preset; rate = finite flow for n
 *   thermal          null = gas temperature follows Tenv instantly
 *                    { tau, adiabatic, fill, wallMolEq } = gas lags its surroundings
 *                    wallMolEq: heat capacity of the container wall that warms with the gas
 *                    during a fill, in moles of gas-equivalent. For the tanks this is about
 *                    half the cylinder's full heat capacity (the wall lags the gas), chosen so
 *                    fill drops land in the 200 to 400 psi range divers report.
 *   instrument       null or a spec for instrument.js
 *   particles        { count } fixed sphere count, or { molPerSphere, max }
 *   derived[]        extra readouts, of(ctx) -> number
 *   events[]         when(ctx) -> bool; latch + effect for irreversible events
 *   settling         messages when the gas is warmer/cooler than its surroundings
 *
 * ctx = { state, env, preset, gas, reading, derived }
 */
import { R, P_ATM, PA_PER_ATM, L_PER_FT3, atmTo, toAtm, gaugeToAbs } from './units.js';
import { GASES, density, sphereDiameterCm } from './gas.js';
import { BALLOON, hotAirProcess } from './hotAir.js';
import { COOKER, cookerProcess, gaugePsi as cookerPsi } from './cooker.js';
import { psat, tsat } from './steam.js';

const molesAtGauge = (psig, V, T) => (gaugeToAbs(toAtm(psig, 'psi')) * V) / (R * T);
const gaugePsi = (pAbs) => atmTo(pAbs - P_ATM, 'psi');

// 20 mL lab syringe, inner diameter about 19.1 mm
const SYRINGE_AREA_M2 = Math.PI * (0.0191 / 2) ** 2;

export const SCENARIOS = Object.freeze({
  // ───────────────────────────── Boyle ─────────────────────────────
  syringe: {
    id: 'syringe',
    law: 'boyle',
    title: 'Sealed syringe',
    subtitle: 'A gas pressure sensor on a lab bench',
    gas: 'air',
    presets: [{ id: 'room', label: 'Sealed at 10.0 mL, 22 °C', Tenv: 295, V0: 0.010, P0: 1 }],
    initial: (p) => ({ P: p.P0, V: p.V0, T: p.Tenv, n: (p.P0 * p.V0) / (R * p.Tenv), Tenv: p.Tenv }),
    inputs: {
      V: { label: 'Volume', min: 0.005, max: 0.020, step: 0.0005, rate: { up: 0.02, down: 0.02 }, show: { unit: 'mL', factor: 1000, digits: 1 } },
    },
    thermal: {
      tau: 1.0,
      adiabatic: true,
      timeNote: 'Real time. Estimated from heat diffusion through air in a 19 mm barrel.',
    },
    instrument: {
      kind: 'digital', name: 'Gas pressure sensor', reference: 'absolute',
      unit: 'kPa', range: [0, 210], resolution: 0.1, samplePeriod: 0.1, tau: 0.1,
    },
    particles: { count: 60 },
    derived: [
      {
        id: 'force', label: 'Force to hold the plunger', unit: 'N', digits: 1,
        note: 'Positive means push, negative means pull.',
        of: ({ state }) => (state.P - P_ATM) * PA_PER_ATM * SYRINGE_AREA_M2,
      },
    ],
    events: [
      {
        id: 'overRange', severity: 'warn', title: 'Sensor over range',
        detail: 'This sensor reads up to 210 kPa. Above that, the display can only show OVER.',
        when: ({ reading }) => reading.overRange,
      },
    ],
    settling: {
      warmer: 'Fast compression heated the gas, so the pressure reads high. Wait for it to settle before recording.',
      cooler: 'Fast expansion cooled the gas, so the pressure reads low. Wait for it to settle before recording.',
    },
    notes: [
      'Boyle\'s law needs constant temperature. Pushing fast warms the gas for a moment, which is why lab instructions say to wait for a steady reading.',
      'The sensor reads absolute pressure, so its values go straight into P₁V₁ = P₂V₂.',
    ],
  },

  // ───────────────────────────── Charles ─────────────────────────────
  balloonBath: {
    id: 'balloonBath',
    law: 'charles',
    title: 'Balloon in temperature baths',
    subtitle: 'A sealed balloon lowered into hot and cold baths',
    gas: 'air',
    presets: [{ id: 'room', label: '4.0 L balloon tied off at 22 °C', Tenv: 295, V0: 4.0, P0: 1 }],
    initial: (p) => ({ P: p.P0, V: p.V0, T: p.Tenv, n: (p.P0 * p.V0) / (R * p.Tenv), Tenv: p.Tenv }),
    inputs: {
      Tenv: {
        label: 'Bath temperature', min: 77, max: 373, step: 1, show: { unit: 'K', digits: 0 },
        marks: [
          { value: 77, label: 'Liquid nitrogen' },
          { value: 195, label: 'Dry ice in ethanol' },
          { value: 273, label: 'Ice water' },
          { value: 295, label: 'Room air' },
          { value: 353, label: 'Hot water' },
          { value: 373, label: 'Boiling water' },
        ],
      },
    },
    thermal: {
      tau: 4,
      timeNote: 'Time is compressed. A real balloon takes tens of seconds to adjust.',
    },
    instrument: null,
    particles: { count: 60 },
    derived: [
      { id: 'diameter', label: 'Diameter', unit: 'cm', digits: 1, of: ({ state }) => sphereDiameterCm(state.V) },
    ],
    events: [
      {
        id: 'condensing', severity: 'warn', title: 'Air is turning liquid',
        detail: 'At 1 atm, air starts to liquefy near 82 K, oxygen-rich drops first. A real balloon collapses further than V/T predicts, because part of the gas is no longer a gas.',
        when: ({ state }) => state.T < 82,
      },
    ],
    settling: {
      warmer: 'The air inside is still warmer than the bath. The balloon keeps shrinking until they match.',
      cooler: 'The air inside is still cooler than the bath. The balloon keeps growing until they match.',
    },
    notes: [
      'Stretched latex adds a little pressure, a few percent above atmospheric. The model treats it as exactly 1 atm.',
      'Charles\'s law only works with temperature in kelvin. Volume would reach zero at 0 K.',
    ],
  },

  // ───────────────────────────── Gay-Lussac ─────────────────────────────
  carTire: {
    id: 'carTire',
    law: 'gayLussac',
    title: 'Car tire',
    subtitle: 'Tire pressure through the seasons',
    gas: 'air',
    presets: [{ id: 'placard32', label: 'Set to 32 psi at 20 °C', V: 30, placardPsi: 32, Tset: 293.15 }],
    initial: (p) => ({
      P: gaugeToAbs(toAtm(p.placardPsi, 'psi')),
      V: p.V,
      T: p.Tset,
      n: molesAtGauge(p.placardPsi, p.V, p.Tset),
      Tenv: p.Tset,
    }),
    inputs: {
      Tenv: {
        label: 'Air temperature', min: 243.15, max: 343.15, step: 1, show: { unit: 'K', digits: 0 },
        marks: [
          { value: 253.15, label: 'Winter morning' },
          { value: 273.15, label: 'Freezing' },
          { value: 293.15, label: 'Mild day (set here)' },
          { value: 308.15, label: 'Summer afternoon' },
          { value: 333.15, label: 'Hot tire after highway driving' },
        ],
      },
    },
    thermal: {
      tau: 5,
      timeNote: 'Time is compressed. A real tire takes tens of minutes to reach air temperature.',
    },
    instrument: {
      kind: 'digital', name: 'Dashboard tire pressure display', reference: 'gauge',
      unit: 'psi', range: [0, 99], resolution: 1, samplePeriod: 2, tau: 0,
    },
    particles: { count: 80 },
    derived: [
      { id: 'absPsi', label: 'Absolute pressure', unit: 'psi', digits: 1, of: ({ state }) => atmTo(state.P, 'psi') },
      {
        id: 'gaugeMistake', label: 'Prediction if gauge pressure is put into P/T', unit: 'psi', digits: 1,
        note: 'The common mistake. Compare it with the real reading.',
        of: ({ state, preset }) => (preset.placardPsi * state.T) / preset.Tset,
      },
    ],
    events: [
      {
        id: 'tpms', severity: 'warn', title: 'Low tire pressure light',
        detail: 'The tire is 25% or more below its 32 psi placard. U.S. rules (FMVSS 138) require the warning at this point.',
        when: ({ reading, preset }) => reading.value <= 0.75 * preset.placardPsi,
      },
      {
        id: 'hotReading', severity: 'info', title: 'Hot tire reads high',
        detail: 'The placard pressure is for a cold tire. Letting air out of a hot tire leaves it underinflated once it cools.',
        when: ({ state }) => state.T > 318.15,
      },
    ],
    settling: {
      warmer: 'The tire air is still warmer than outside. The pressure keeps falling as it cools.',
      cooler: 'The tire air is still cooler than outside. The pressure keeps rising as it warms.',
    },
    notes: [
      'Tire gauges read gauge pressure, which is absolute pressure minus about 14.7 psi of atmosphere. P/T = constant only works with absolute pressure.',
      'A real tire stretches 1 to 2% under pressure. The model holds volume exactly constant.',
      'The display updates every few seconds here. Real sensors report about once a minute while driving.',
    ],
  },

  // ───────────────────────────── Avogadro ─────────────────────────────
  partyBalloon: {
    id: 'partyBalloon',
    law: 'avogadro',
    title: 'Filling a party balloon',
    subtitle: 'An 11-inch latex balloon at 22 °C and 1 atm',
    gas: 'helium',
    presets: [
      { id: 'helium', label: 'Helium tank', gas: 'helium' },
      { id: 'air', label: 'Air pump', gas: 'air' },
      { id: 'co2', label: 'CO₂ cartridge', gas: 'co2' },
    ].map((p) => ({ ...p, Tenv: 295, P0: 1, ratedL: 14, burstL: 24, latexG: 3.0 })),
    initial: (p) => ({ P: p.P0, V: 0, T: p.Tenv, n: 0, Tenv: p.Tenv }),
    inputs: {
      n: {
        label: 'Gas added', min: 0, max: 1.1, step: 0.01, rate: { up: 0.15, down: 0.15 },
        show: { unit: 'mol', digits: 2 },
      },
    },
    thermal: null,
    instrument: null,
    particles: { molPerSphere: 0.01, max: 110 },
    derived: [
      { id: 'diameter', label: 'Diameter', unit: 'cm', digits: 1, of: ({ state }) => sphereDiameterCm(state.V) },
      {
        id: 'molarVolume', label: 'Volume per mole', unit: 'L/mol', digits: 2,
        note: '22.4 L/mol is only true at 0 °C. At room temperature it is larger.',
        of: ({ state }) => (state.n > 1e-6 ? state.V / state.n : NaN),
      },
      {
        id: 'lift', label: 'Net lift', unit: 'g', digits: 1,
        note: 'Buoyancy minus the gas and the 3 g of latex. Positive floats.',
        of: ({ state, gas, preset }) =>
          (density(P_ATM, state.T, GASES.air.M) - density(state.P, state.T, gas.M)) * state.V - preset.latexG,
      },
    ],
    events: [
      {
        id: 'liftoff', severity: 'info', title: 'It floats',
        detail: 'The displaced air weighs more than the gas plus the latex.',
        when: ({ derived, state }) => state.n > 0 && derived.lift > 0,
      },
      {
        id: 'stretched', severity: 'warn', title: 'Past its rated size',
        detail: 'The latex is stretched beyond the 11-inch rating. A burst is likely.',
        when: ({ state, preset }) => state.V > preset.ratedL,
      },
      {
        id: 'burst', severity: 'critical', title: 'Pop!',
        detail: 'The balloon burst and all the gas escaped. Reset to try again.',
        when: ({ state, preset }) => state.V >= preset.burstL,
        latch: true, effect: 'burst',
      },
    ],
    settling: null,
    notes: [
      'Same moles, same volume, whatever the gas. That is Avogadro\'s law. Only the mass differs, which decides whether the balloon floats.',
      'Burst size varies a lot between balloons. 24 L is a typical value for an 11-inch balloon.',
    ],
  },

  // ───────────────────────────── Ideal ─────────────────────────────
  scubaTank: {
    id: 'scubaTank',
    law: 'ideal',
    title: 'Scuba tank',
    subtitle: 'Filling, diving and the fill drop',
    gas: 'air',
    presets: [
      { id: 'al80', label: 'Aluminum 80 (11.1 L, 3000 psi)', V: 11.1, wpPsi: 3000, wallMolEq: 300, ratedFt3: 77.4 },
      { id: 'steel12', label: 'Steel 12 L (232 bar)', V: 12.0, wpPsi: atmTo(toAtm(232, 'bar'), 'psi'), wallMolEq: 175, ratedFt3: null },
    ].map((p) => ({ ...p, Tenv: 293.15 })),
    initial: (p) => ({
      P: gaugeToAbs(toAtm(p.wpPsi, 'psi')),
      V: p.V,
      T: p.Tenv,
      n: molesAtGauge(p.wpPsi, p.V, p.Tenv),
      Tenv: p.Tenv,
    }),
    inputs: {
      n: {
        label: 'Air in tank', step: 0.5, rate: { up: 12, down: 6 }, show: { unit: 'mol', digits: 1 },
        hint: ({ targets }) => (targets.site === 'fill'
          ? 'Slide right to fill from the compressor, left to bleed air out.'
          : 'Slide left to breathe air from the tank. Filling only happens at the fill station.'),
        min: (p) => (P_ATM * p.V) / (R * p.Tenv),
        max: (p) => 1.05 * molesAtGauge((5 / 3) * p.wpPsi, p.V, p.Tenv),
      },
      site: {
        type: 'choice', label: 'Where the tank is', default: 'fill',
        options: [
          { value: 'fill', label: 'Fill station', detail: 'Dive shop, tank in a 20 °C cooling bath', Tenv: 293.15 },
          { value: 'quarry', label: 'Cold quarry', detail: '4 °C, fresh water', Tenv: 277.15 },
          { value: 'temperate', label: 'Temperate sea', detail: '15 °C, kelp forest', Tenv: 288.15 },
          { value: 'reef', label: 'Tropical reef', detail: '28 °C, coral reef', Tenv: 301.15 },
        ],
      },
    },
    // A tank can only be filled at the fill station; at a dive site air only leaves.
    inputRule(w, key, v) {
      if (key === 'n' && w.targets.site !== 'fill' && v > w.state.n) return w.state.n;
      if (key === 'site' && v !== 'fill' && w.targets.n > w.state.n) return { targets: { ...w.targets, site: v, n: w.state.n } };
      return v;
    },
    thermal: {
      tau: 12,
      fill: true,
      wallMolEq: (p) => p.wallMolEq,
      timeNote: 'Time is compressed. Real fills and cool-downs take minutes.',
    },
    instrument: {
      kind: 'analog', name: 'Submersible pressure gauge', reference: 'gauge',
      unit: 'psi', range: [0, 5000], resolution: 50, omega: 6, zeta: 0.7,
    },
    particles: { molPerSphere: 1, max: 200 },
    derived: [
      { id: 'gaugeBar', label: 'Gauge pressure', unit: 'bar', digits: 0, of: ({ state }) => atmTo(state.P - P_ATM, 'bar') },
      { id: 'freeAirL', label: 'Air at the surface (1 atm)', unit: 'L', digits: 0, of: ({ state }) => (state.n * R * state.T) / P_ATM },
      { id: 'freeAirFt3', label: 'Air at the surface (1 atm)', unit: 'ft³', digits: 1, of: ({ state }) => (state.n * R * state.T) / P_ATM / L_PER_FT3 },
    ],
    events: [
      {
        id: 'lowAir', severity: 'warn', title: 'Low air',
        detail: 'Below 500 psi. Divers plan to reach the surface with at least this much left.',
        when: ({ reading }) => reading.value < 500,
      },
      {
        id: 'overfill', severity: 'warn', title: 'Over working pressure',
        detail: 'More than 10% above the tank\'s rated working pressure.',
        when: ({ state, preset }) => gaugePsi(state.P) > 1.1 * preset.wpPsi,
      },
      {
        id: 'burstDisk', severity: 'critical', title: 'Burst disk ruptured',
        detail: 'Pressure reached the safety disk rating, about 5/3 of working pressure. The disk vented the tank to protect the cylinder. Reset to continue.',
        when: ({ state, preset }) => gaugePsi(state.P) >= (5 / 3) * preset.wpPsi,
        latch: true, effect: 'vent',
      },
    ],
    settling: {
      warmer: 'The tank is warmer than its surroundings, from filling or from a warmer place. The pressure will drop as it cools. Divers call this the fill drop.',
      cooler: 'The tank is cooler than its surroundings. The pressure will rise as it warms.',
    },
    notes: [
      'At 200 atm, real air is about 4% less compressible than ideal. The ideal gas law gives about 80 ft³ for an Aluminum 80, while its rated capacity is 77.4 ft³.',
      'Filling compresses the air and heats the tank, which is why fill stations fill tanks standing in water. Breathing from it cools the remaining air slightly.',
      'Try it: fill at the fill station, then take the tank to the cold quarry. The gauge drops a few hundred psi with no air used. That is the fill drop.',
    ],
  },

  // ───────────────────────────── Charles, second system ─────────────────────────────
  hotAirBalloon: {
    id: 'hotAirBalloon',
    law: 'charles',
    title: 'Hot air balloon',
    subtitle: 'Hot inflation and a tethered flight in an open field',
    gas: 'air',
    timeNote: 'Time is compressed. A real envelope heats and cools over minutes.',
    presets: [
      { id: 'morning', label: 'Cool morning, 10 °C', Tamb: 283.15 },
      { id: 'afternoon', label: 'Hot afternoon, 32 °C', Tamb: 305.15 },
    ],
    initial: (p) => {
      const V = BALLOON.coldFill * BALLOON.Venv;
      return { P: P_ATM, V, T: p.Tamb, n: (P_ATM * V) / (R * p.Tamb), Tenv: p.Tamb };
    },
    process: hotAirProcess,
    inputs: {
      burner: {
        label: 'Burner', min: 0, max: 100, step: 1, default: 0, show: { unit: '%', digits: 0 },
        marks: [
          { value: 0, label: 'Off' },
          { value: 35, label: 'Low' },
          { value: 60, label: 'Medium' },
          { value: 80, label: 'High' },
          { value: 100, label: 'Full' },
        ],
      },
    },
    instrument: {
      kind: 'digital', quantity: 'T', name: 'Envelope temperature', reference: 'absolute',
      unit: '°C', range: [-30, 160], resolution: 1, samplePeriod: 0.5, tau: 1.5,
    },
    particles: { molPerSphere: (p) => (BALLOON.coldFill * BALLOON.Venv) / (R * p.Tamb) / 120, max: 220 },
    derived: [
      { id: 'net', label: 'Net lift', unit: 'kg', digits: 0, note: 'Lift minus 680 kg of envelope, basket, burner, fuel and four people. Positive rises.', of: ({ extra }) => extra.net },
      { id: 'lift', label: 'Lift from the hot air', unit: 'kg', digits: 0, of: ({ extra }) => extra.lift },
      { id: 'rhoIn', label: 'Air density inside', unit: 'kg/m³', digits: 3, of: ({ state }) => density(state.P, state.T, 28.96) },
      { id: 'rhoOut', label: 'Air density outside', unit: 'kg/m³', digits: 3, of: ({ extra }) => density(P_ATM, extra.Tamb, 28.96) },
      { id: 'airMass', label: 'Air inside the envelope', unit: 'kg', digits: 0, of: ({ state }) => (state.n * 28.96) / 1000 },
      { id: 'vol', label: 'Envelope volume', unit: 'm³', digits: 0, of: ({ state }) => state.V / 1000 },
      { id: 'height', label: 'Height above the field', unit: 'm', digits: 1, of: ({ extra }) => extra.height },
    ],
    events: [
      {
        id: 'overheat', severity: 'critical', title: 'Maximum envelope temperature',
        detail: 'At 120 °C nylon fabric starts to lose strength. A temperature flag at the crown melts near 125 °C, and the pilot must land and have the envelope inspected. Ease off the burner.',
        when: ({ state }) => state.T >= BALLOON.Tlimit,
      },
      {
        id: 'hot', severity: 'warn', title: 'Approaching the envelope limit',
        detail: 'Above 110 °C. Pilots keep the envelope below about 120 °C. On a hot day the balloon needs a hotter envelope to fly, which leaves less margin.',
        when: ({ state }) => state.T >= BALLOON.Twarn && state.T < BALLOON.Tlimit,
      },
      {
        id: 'liftoff', severity: 'info', title: 'Lift-off',
        detail: ({ extra }) => `The cool air pushed aside weighs more than the hot air plus 680 kg of balloon and people. Net lift ${Math.round(extra.net)} kg. The tether holds the basket at ${Math.round(extra.height)} m.`,
        when: ({ extra }) => extra.height > 0.3 && extra.net > 0,
      },
      {
        id: 'full', severity: 'info', title: 'Envelope full, air spills out',
        detail: 'The envelope cannot get bigger, so heating pushes air out of the mouth. Same volume, fewer molecules, lower density. That is what makes lift.',
        when: ({ extra, state }) => extra.full && extra.height <= 0.3 && state.T < BALLOON.Twarn,
      },
      {
        id: 'expanding', severity: 'info', title: "Charles's law: the air expands",
        detail: 'The fan put a fixed amount of air in. Heated at constant pressure, it takes up more space: V/T stays constant until the envelope is full.',
        when: ({ extra, state }) => !extra.full && state.T > extra.Tamb + 1,
      },
      {
        id: 'cold', severity: 'info', title: 'Cold inflation',
        detail: 'The crew fan has filled the envelope to 85% with outside air. Light the burner to heat it.',
        when: ({ extra, targets, state }) => !extra.full && (targets.burner ?? 0) === 0 && state.T <= extra.Tamb + 1,
      },
    ],
    roles: ({ extra }) => ({
      P: ['held', 'open to the air'],
      V: extra.full ? ['fixed', 'envelope full'] : ['respond', 'responds'],
      T: ['change', 'heated by the burner'],
      n: extra.full ? ['respond', 'leaves through the mouth'] : ['held', 'held constant'],
    }),
    notes: [
      'The mouth of the envelope is open, so the pressure inside always equals the pressure outside. Charles\'s law applies while the trapped air expands; once the envelope is full, heating changes n instead of V.',
      'A real envelope is hotter at the crown than at the mouth. The model uses one average temperature.',
      'Balloons fly in the cool early morning. Cooler outside air is denser, so the same envelope temperature gives more lift, and the air is calmer.',
      'Masses are typical for a 2,800 m³ (100,000 ft³) four-passenger balloon.',
    ],
  },

  // ───────────────────────────── Gay-Lussac, second system ─────────────────────────────
  pressureCooker: {
    id: 'pressureCooker',
    law: 'gayLussac',
    title: 'Pressure cooker',
    subtitle: 'A 6 L stovetop cooker on a gas burner',
    gas: 'steam',
    timeNote: 'Time is compressed about 30 times. A real cooker takes about 10 minutes to come to pressure.',
    presets: [
      { id: 'water', label: '2 L of water, normal use', water: 2.0, airOnly: false },
      { id: 'air', label: 'Air only, sealed (demonstration)', water: 0, airOnly: true },
    ],
    initial: (p) => {
      const Vh = COOKER.Vpot - p.water;
      return { P: P_ATM, V: Vh, T: COOKER.Troom, n: (P_ATM * Vh) / (R * COOKER.Troom), Tenv: COOKER.Troom };
    },
    process: cookerProcess,
    inputs: {
      heat: {
        label: 'Stove', min: 0, max: 10, step: 1, default: 0,
        show: { unit: '', digits: 0, format: (v) => (v === 0 ? 'Off' : v <= 3 ? `Low (${v})` : v <= 6 ? `Medium (${v})` : `High (${v})`) },
        marks: [{ value: 0, label: 'Off' }, { value: 3, label: 'Low' }, { value: 6, label: 'Medium' }, { value: 10, label: 'High' }],
      },
      water: {
        label: 'Water in the pot', min: 0.5, max: 5.5, step: 0.25, default: (p) => p.water,
        show: { unit: 'L', digits: 2 },
        marks: [{ value: 2.0, label: '1/3 full' }, { value: 4.0, label: '2/3 full, the limit' }, { value: 5.5, label: 'Overfilled' }],
        enabled: ({ extra }) => !extra.airOnly && extra.lid === 'off',
        hint: ({ extra }) => (extra.airOnly ? 'This demonstration has no water.' : extra.lid === 'off' ? '' : 'Open the lid to add or remove water.'),
      },
      blocked: { type: 'toggle', label: 'Vent pipe clogged with food', default: false },
    },
    actions: [
      { id: 'release', label: 'Release pressure', enabled: ({ extra }) => extra.sealed && !extra.releasing && !extra.fired },
      { id: 'lid', label: ({ extra }) => (extra.lid === 'on' ? 'Open lid' : 'Close lid') },
    ],
    instrument: {
      kind: 'analog', name: 'Lid pressure gauge', reference: 'gauge',
      unit: 'psi', range: [0, 30], resolution: 0.5, omega: 5, zeta: 0.55,
    },
    particles: {
      molPerSphere: 0.0025,
      max: 220,
      // Share of the gas that is air (the rest is water vapor), for coloring spheres.
      mix: ({ state, extra }) => {
        if (extra.airOnly) return 1;
        if (!extra.sealed) return Math.max(0, 1 - psat(Math.min(state.T, 373.15)) / state.P);
        return Math.min(1, (extra.nAir * R * state.T) / (state.V * state.P));
      },
    },
    derived: [
      { id: 'gauge', label: 'Gauge pressure', unit: 'psi', digits: 1, of: ({ state }) => cookerPsi(state.P) },
      { id: 'pSteam', label: 'Water vapor share of the pressure', unit: 'atm', digits: 3, of: ({ state, extra }) => (extra.water > 1e-6 && extra.sealed ? psat(state.T) : extra.airOnly ? 0 : Math.max(0, state.P - (extra.nAir * R * state.T) / state.V)) },
      { id: 'pAir', label: 'Air share of the pressure', unit: 'atm', digits: 3, of: ({ state, extra }) => (extra.airOnly ? state.P : extra.sealed ? (extra.nAir * R * state.T) / state.V : Math.max(0, state.P - psat(Math.min(state.T, 373.15)))) },
      { id: 'gl', label: "Gay-Lussac's law alone (air sealed at 22 °C)", unit: 'atm', digits: 3, note: 'P = 1 atm × T / 295 K. The gap to the real pressure is steam.', of: ({ state }) => (P_ATM * state.T) / COOKER.Troom },
      { id: 'nSteam', label: 'Water vapor in the pot', unit: 'mol', digits: 3, of: ({ state, extra }) => (extra.airOnly ? 0 : Math.max(0, state.n - (extra.sealed ? extra.nAir : 0))) },
      { id: 'water', label: 'Water left', unit: 'L', digits: 2, of: ({ extra }) => extra.water },
      { id: 'boil', label: 'Boiling point at this pressure', unit: '°C', digits: 1, of: ({ state }) => tsat(state.P) - 273.15 },
    ],
    events: [
      {
        id: 'fired', severity: 'critical', title: 'Overpressure plug blew out',
        detail: 'At 22 psi the safety plug gave way. Steam and scalding water sprayed from the lid. In a real kitchen: turn off the heat, keep away, let it cool, replace the plug, and clean the vent pipe before every use.',
        when: ({ extra }) => extra.fired,
      },
      {
        id: 'dry', severity: 'critical', title: 'Boiled dry',
        detail: 'No water is left, so nothing holds the temperature at 121 °C. The pot overheats, food burns and the gasket can fail. Turn off the heat.',
        when: ({ extra, targets }) => !extra.airOnly && extra.water <= 1e-6 && (targets.heat ?? 0) > 0,
      },
      {
        id: 'lidLocked', severity: 'warn', title: 'Lid locked',
        detail: ({ state }) => `${cookerPsi(state.P).toFixed(1)} psi inside. Opening now would drop the pressure at once: water hotter than 100 °C would flash into steam and spray out. Release the pressure first.`,
        when: ({ extra }) => extra.lidLockedFor > 0,
      },
      {
        id: 'blocked', severity: 'warn', title: 'Vent clogged',
        detail: 'Nothing releases steam at 15 psi, so the pressure keeps climbing toward the overpressure plug at 22 psi.',
        when: ({ targets, extra }) => targets.blocked && extra.sealed && !extra.fired,
      },
      {
        id: 'overfill', severity: 'warn', title: 'More than 2/3 full',
        detail: 'Food and foam can reach the vent pipe and clog it. Most manuals set 2/3 full as the limit, and 1/2 for beans and grains.',
        when: ({ extra }) => !extra.airOnly && extra.water > COOKER.maxFill + 1e-6,
      },
      {
        id: 'lowWater', severity: 'warn', title: 'Water almost gone',
        detail: 'Less than 0.25 L left. Without water there is no steam to hold the temperature.',
        when: ({ extra, targets }) => !extra.airOnly && extra.water > 1e-6 && extra.water < 0.25 && (targets.heat ?? 0) > 0,
      },
      {
        id: 'releasing', severity: 'info', title: 'Releasing pressure',
        detail: ({ targets }) => `As the pressure drops, the water above 100 °C boils hard and cools toward 100 °C. Keep hands and face away from the steam.${(targets.heat ?? 0) > 0 ? ' The stove is still on, so the vent will close again and pressure will rebuild: turn off the heat first.' : ''}`,
        when: ({ extra }) => extra.releasing,
      },
      {
        id: 'regulating', severity: 'info', title: 'At 15 psi: the regulator rocks',
        detail: ({ extra }) => (extra.water > 1e-6
          ? 'The weighted regulator lifts and lets steam out, so the pressure holds at 15 psi and the water stays at 121 °C. Water is slowly used up.'
          : 'The weighted regulator lifts and lets gas out, so the pressure holds at 15 psi.'),
        when: ({ extra }) => extra.venting === 1,
      },
      {
        id: 'emptyDemo', severity: 'info', title: 'Demonstration: air only',
        detail: "A fixed amount of air, so Gay-Lussac's law applies exactly: P/T stays constant. Never heat a real pressure cooker without water. It cannot make steam, and the empty pot overheats.",
        when: ({ extra }) => extra.airOnly,
      },
      {
        id: 'building', severity: 'info', title: 'Sealed: pressure building',
        detail: "The air vent has closed. Water keeps evaporating, so the amount of gas grows, and the pressure rises much faster than Gay-Lussac's law alone predicts.",
        when: ({ extra }) => extra.sealed && !extra.airOnly && extra.water > 1e-6 && extra.venting === 0 && !extra.releasing,
      },
      {
        id: 'venting', severity: 'info', title: 'Air vent open',
        detail: 'Air and steam escape until the water boils. Then steam pushes the air vent closed and pressure starts to build.',
        when: ({ extra, targets }) => !extra.sealed && extra.lid === 'on' && !extra.fired && !extra.airOnly && (targets.heat ?? 0) > 0,
      },
      {
        id: 'lidOff', severity: 'info', title: 'Lid off',
        detail: 'Add or remove water now. Close the lid before heating to pressure.',
        when: ({ extra }) => extra.lid === 'off',
      },
    ],
    roles: ({ extra }) => ({
      P: ['respond', 'responds'],
      V: ['fixed', 'space above the water'],
      T: ['change', 'heated by the stove'],
      n: extra.airOnly ? ['held', 'held constant'] : ['respond', 'grows as water evaporates'],
    }),
    notes: [
      "Gay-Lussac's law holds for a fixed amount of gas. In a working cooker most of the pressure is water vapor, and its amount grows as the water heats, so the pressure follows the steam curve instead. Compare the two readouts.",
      'Regulator 15 psi, overpressure plug 22 psi and lid lock are typical values for stovetop cookers. Always follow the manual of your own cooker.',
      'At 15 psi above atmosphere, water boils at 121 °C instead of 100 °C. That is why food cooks two to three times faster.',
      'Water vapor pressure comes from the Antoine equation, accurate to about 1% here.',
    ],
  },
});

export const SCENARIO_ORDER = ['syringe', 'hotAirBalloon', 'balloonBath', 'pressureCooker', 'carTire', 'partyBalloon', 'scubaTank'];

/** Top-level tabs are laws; each law offers one or two real systems. */
export const LAW_ORDER = ['boyle', 'charles', 'gayLussac', 'avogadro', 'ideal'];
export const SYSTEMS = Object.freeze({
  boyle: ['syringe'],
  charles: ['hotAirBalloon', 'balloonBath'],
  gayLussac: ['pressureCooker', 'carTire'],
  avogadro: ['partyBalloon'],
  ideal: ['scubaTank'],
});
