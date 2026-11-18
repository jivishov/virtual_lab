const atom = (id, element, x, y, lonePairs = 0, charge = 0) => ({id, element, x, y, lonePairs, charge});
const bond = (a, b, order = 1) => ({a, b, order});

function example(name, formula, prompt, atoms, bonds, charge = 0) {
  return {
    name, formula, prompt, charge,
    graph: {version: 1, atoms, bonds, ionCharge: charge, brackets: charge !== 0}
  };
}

// Coordinates lay out the reference diagrams. Matching uses graph connectivity.
export const LEWIS_SPECIES = {
  sif4: example('Silicon tetrafluoride', 'SiF₄',
    'Build a neutral molecule with four fluorines around silicon. Put each remaining electron pair on an atom so a partner can account for the entire valence budget.',
    [atom('center', 'Si', .50, .50), atom('north', 'F', .50, .16, 3), atom('south', 'F', .50, .84, 3),
     atom('west', 'F', .22, .50, 3), atom('east', 'F', .78, .50, 3)],
    [bond('center', 'north'), bond('center', 'south'), bond('center', 'west'), bond('center', 'east')]),
  pcl3: example('Phosphorus trichloride', 'PCl₃',
    'Connect phosphorus to its three chlorine neighbors. Decide how to distribute the nonbonding electrons between the center and the ends.',
    [atom('center', 'P', .50, .50, 1), atom('west', 'Cl', .20, .33, 3),
     atom('south', 'Cl', .50, .83, 3), atom('east', 'Cl', .80, .33, 3)],
    [bond('center', 'west'), bond('center', 'south'), bond('center', 'east')]),
  scl2: example('Sulfur dichloride', 'SCl₂',
    'Connect two chlorine atoms through sulfur. Use the completed diagram to distinguish shared electrons from electrons assigned to just one atom.',
    [atom('center', 'S', .50, .35, 2), atom('west', 'Cl', .26, .72, 3), atom('east', 'Cl', .74, .72, 3)],
    [bond('center', 'west'), bond('center', 'east')]),
  cs2: example('Carbon disulfide', 'CS₂',
    'Put carbon between two sulfur atoms. Find a bonding pattern that completes all three octets with zero formal charge on every atom.',
    [atom('center', 'C', .50, .50), atom('west', 'S', .20, .50, 2), atom('east', 'S', .80, .50, 2)],
    [bond('center', 'west', 2), bond('center', 'east', 2)]),
  ocs: example('Carbonyl sulfide', 'OCS',
    'Carbonyl sulfide has carbon between its two different ends. Construct its closed-shell Lewis structure with the smallest formal charges.',
    [atom('center', 'C', .50, .50), atom('oxygen', 'O', .20, .50, 2), atom('sulfur', 'S', .80, .50, 2)],
    [bond('center', 'oxygen', 2), bond('center', 'sulfur', 2)]),
  h2cs: example('Thioformaldehyde', 'H₂CS',
    'Both hydrogen atoms in thioformaldehyde attach to carbon. Complete the carbon–sulfur linkage and give each atom its closed shell with zero formal charge.',
    [atom('center', 'C', .50, .50), atom('upper', 'H', .24, .22), atom('lower', 'H', .24, .78),
     atom('sulfur', 'S', .80, .50, 2)],
    [bond('center', 'upper'), bond('center', 'lower'), bond('center', 'sulfur', 2)]),
  ph4: example('Phosphonium ion', 'PH₄⁺',
    'Build the phosphonium ion. Account for the charge in your valence budget, mark the formal charge where it belongs, and enclose the entire ion in brackets.',
    [atom('center', 'P', .50, .50, 0, 1), atom('north', 'H', .50, .16), atom('south', 'H', .50, .84),
     atom('west', 'H', .22, .50), atom('east', 'H', .78, .50)],
    [bond('center', 'north'), bond('center', 'south'), bond('center', 'west'), bond('center', 'east')], 1),
  ch3cn: example('Acetonitrile', 'CH₃CN',
    'Join a three-hydrogen methyl group to a second carbon bonded to nitrogen. Choose the bond orders and locate all nonbonding electrons for neutral acetonitrile.',
    [atom('methyl', 'C', .35, .50), atom('carbon', 'C', .60, .50), atom('nitrogen', 'N', .85, .50, 1),
     atom('west', 'H', .10, .50), atom('north', 'H', .35, .16), atom('south', 'H', .35, .84)],
    [bond('methyl', 'carbon'), bond('carbon', 'nitrogen', 3), bond('methyl', 'west'),
     bond('methyl', 'north'), bond('methyl', 'south')])
};
