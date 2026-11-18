// CIAAW abridged standard atomic weights (2024), in atomic-number order.
// For elements without a standard atomic weight, IUPAC's May 2022 table supplies
// the representative nuclide's mass number in brackets. Preserve trailing zeros.
// https://ciaaw.org/abridged-atomic-weights.htm
// https://iupac.org/what-we-do/periodic-table-of-elements/
const values = `
H Hydrogen 1.0080
He Helium 4.0026
Li Lithium 6.94
Be Beryllium 9.0122
B Boron 10.81
C Carbon 12.011
N Nitrogen 14.007
O Oxygen 15.999
F Fluorine 18.998
Ne Neon 20.180
Na Sodium 22.990
Mg Magnesium 24.305
Al Aluminium 26.982
Si Silicon 28.085
P Phosphorus 30.974
S Sulfur 32.06
Cl Chlorine 35.45
Ar Argon 39.95
K Potassium 39.098
Ca Calcium 40.078
Sc Scandium 44.956
Ti Titanium 47.867
V Vanadium 50.942
Cr Chromium 51.996
Mn Manganese 54.938
Fe Iron 55.845
Co Cobalt 58.933
Ni Nickel 58.693
Cu Copper 63.546
Zn Zinc 65.38
Ga Gallium 69.723
Ge Germanium 72.630
As Arsenic 74.922
Se Selenium 78.971
Br Bromine 79.904
Kr Krypton 83.798
Rb Rubidium 85.468
Sr Strontium 87.62
Y Yttrium 88.906
Zr Zirconium 91.222
Nb Niobium 92.906
Mo Molybdenum 95.95
Tc Technetium [97]
Ru Ruthenium 101.07
Rh Rhodium 102.91
Pd Palladium 106.42
Ag Silver 107.87
Cd Cadmium 112.41
In Indium 114.82
Sn Tin 118.71
Sb Antimony 121.76
Te Tellurium 127.60
I Iodine 126.90
Xe Xenon 131.29
Cs Caesium 132.91
Ba Barium 137.33
La Lanthanum 138.91
Ce Cerium 140.12
Pr Praseodymium 140.91
Nd Neodymium 144.24
Pm Promethium [145]
Sm Samarium 150.36
Eu Europium 151.96
Gd Gadolinium 157.25
Tb Terbium 158.93
Dy Dysprosium 162.50
Ho Holmium 164.93
Er Erbium 167.26
Tm Thulium 168.93
Yb Ytterbium 173.05
Lu Lutetium 174.97
Hf Hafnium 178.49
Ta Tantalum 180.95
W Tungsten 183.84
Re Rhenium 186.21
Os Osmium 190.23
Ir Iridium 192.22
Pt Platinum 195.08
Au Gold 196.97
Hg Mercury 200.59
Tl Thallium 204.38
Pb Lead 207.2
Bi Bismuth 208.98
Po Polonium [209]
At Astatine [210]
Rn Radon [222]
Fr Francium [223]
Ra Radium [226]
Ac Actinium [227]
Th Thorium 232.04
Pa Protactinium 231.04
U Uranium 238.03
Np Neptunium [237]
Pu Plutonium [244]
Am Americium [243]
Cm Curium [247]
Bk Berkelium [247]
Cf Californium [251]
Es Einsteinium [252]
Fm Fermium [257]
Md Mendelevium [258]
No Nobelium [259]
Lr Lawrencium [262]
Rf Rutherfordium [267]
Db Dubnium [268]
Sg Seaborgium [269]
Bh Bohrium [270]
Hs Hassium [269]
Mt Meitnerium [277]
Ds Darmstadtium [281]
Rg Roentgenium [282]
Cn Copernicium [285]
Nh Nihonium [286]
Fl Flerovium [290]
Mc Moscovium [290]
Lv Livermorium [293]
Ts Tennessine [294]
Og Oganesson [294]
`.trim().split('\n');

const periods = [
  'H . . . . . . . . . . . . . . . . He',
  'Li Be . . . . . . . . . . B C N O F Ne',
  'Na Mg . . . . . . . . . . Al Si P S Cl Ar',
  'K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr',
  'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe',
  'Cs Ba . Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn',
  'Fr Ra . Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og',
];
const series = [
  'La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu',
  'Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr',
];

export const families = {
  alkali: 'Alkali metal', earth: 'Alkaline earth metal',
  transition: 'Transition metal', metal: 'Other metal',
  metalloid: 'Metalloid', nonmetal: 'Reactive nonmetal', noble: 'Noble gas',
  lanthanide: 'Lanthanide', actinide: 'Actinide', uncertain: 'Uncertain properties',
};

// Keep astatine visible as a group 17 halogen. Its bulk metallic character is
// unresolved, so it is outside the classroom pilot (Phys. Rev. Lett. 111, 116404).
const reactiveNonmetals = new Set('H C N O F P S Cl Se Br I'.split(' '));
const nobleGases = new Set('He Ne Ar Kr Xe Rn'.split(' '));
const metalloids = new Set('B Si Ge As Sb Te'.split(' '));
const positions = new Map();
periods.forEach((line, index) => line.split(' ').forEach((symbol, column) => {
  if (symbol !== '.') positions.set(symbol, {row:index + 1, column:column + 1, period:index + 1, group:column + 1});
}));
series.forEach((line, index) => line.split(' ').forEach((symbol, column) => {
  positions.set(symbol, {row:index + 8, column:column + 3, period:index + 6, group:null});
}));

function familyOf(symbol, number, group) {
  if (reactiveNonmetals.has(symbol)) return 'nonmetal';
  if (nobleGases.has(symbol)) return 'noble';
  if (metalloids.has(symbol)) return 'metalloid';
  if (group === 1) return 'alkali';
  if (group === 2) return 'earth';
  if (group === null) return number <= 71 ? 'lanthanide' : 'actinide';
  // Classroom convention: group 12 metals are separate from the open-d-shell
  // transition metals. Bulk properties are uncertain for the heaviest p-block elements.
  if (symbol === 'At' || number >= 113) return 'uncertain';
  if (group >= 3 && group <= 11) return 'transition';
  return 'metal';
}

export const periodicTable = values.map((line, index) => {
  const [symbol, name, weight] = line.split(' ');
  const number = index + 1;
  const position = positions.get(symbol);
  const family = familyOf(symbol, number, position.group);
  const available = position.group === 1 || position.group === 2 || family === 'nonmetal';
  return {number, symbol, name, weight, ...position, family, available};
});

export const bySymbol = new Map(periodicTable.map(element => [element.symbol, element]));
