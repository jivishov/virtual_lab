/**
 * MoleTycoon Question Engine
 * Question generation and management for all games
 */

import { COMPOUNDS, ATOMIC_MASSES, REACTIONS, formatFormula } from '../data/compounds.js';

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Generate wrong answers for MC questions
 */
function generateWrongAnswers(correctValue, count = 3, unit = '') {
    const wrong = [];
    const variance = [0.5, 1.5, 2, 0.25, 0.75, 1.25];

    for (let i = 0; i < count; i++) {
        let wrongVal = correctValue * variance[i];
        // Round to reasonable precision
        wrongVal = Math.round(wrongVal * 100) / 100;
        if (wrongVal !== correctValue && !wrong.includes(wrongVal)) {
            wrong.push(`${wrongVal}${unit}`);
        }
    }

    // Fill remaining with random values if needed
    while (wrong.length < count) {
        const randomVal = Math.round((correctValue * (0.5 + Math.random() * 2)) * 100) / 100;
        const formatted = `${randomVal}${unit}`;
        if (randomVal !== correctValue && !wrong.includes(formatted)) {
            wrong.push(formatted);
        }
    }

    return wrong.slice(0, count);
}

/**
 * Format number for display
 */
function formatNumber(num, decimals = 2) {
    return Number(num.toFixed(decimals));
}

// ============================================
// MOLE CONVERTER QUESTIONS (TEKS C.8.A)
// ============================================
export function generateMoleConverterQuestions() {
    const questions = [];

    // Helper formatted compounds
    const compounds = {
        NaCl: { f: 'NaCl', mm: 58.44, n: 'Sodium chloride' },
        H2O: { f: 'H₂O', mm: 18.02, n: 'Water' },
        CO2: { f: 'CO₂', mm: 44.01, n: 'Carbon dioxide' },
        MgO: { f: 'MgO', mm: 40.30, n: 'Magnesium oxide' },
        CaO: { f: 'CaO', mm: 56.08, n: 'Calcium oxide' },
        Fe2O3: { f: 'Fe₂O₃', mm: 159.69, n: 'Iron(III) oxide' },
        Al2O3: { f: 'Al₂O₃', mm: 101.96, n: 'Aluminum oxide' },
        NH3: { f: 'NH₃', mm: 17.03, n: 'Ammonia' },
        CH4: { f: 'CH₄', mm: 16.04, n: 'Methane' },
        C6H12O6: { f: 'C₆H₁₂O₆', mm: 180.16, n: 'Glucose' }
    };

    // 1. Molar Mass Questions

    // Q1
    questions.push({
        type: 'multiple-choice',
        question: `What is the molar mass of ${compounds.NaCl.f}?`,
        options: shuffle(['58.44 g/mol', '22.99 g/mol', '35.45 g/mol', '81.43 g/mol']),
        answer: '58.44 g/mol',
        explanation: `Na (22.99) + Cl (35.45) = 58.44 g/mol`,
        teks: 'C.8.A'
    });

    // Q2
    questions.push({
        type: 'multiple-choice',
        question: `Calculate the molar mass of ${compounds.H2O.f}.`,
        options: shuffle(['18.02 g/mol', '17.01 g/mol', '16.00 g/mol', '20.02 g/mol']),
        answer: '18.02 g/mol',
        explanation: `2 × H (1.008) + O (15.999) ≈ 18.02 g/mol`,
        teks: 'C.8.A'
    });

    // Q3
    questions.push({
        type: 'multiple-choice',
        question: `Which represents the molar mass of ${compounds.Fe2O3.f}?`,
        options: shuffle(['159.69 g/mol', '111.69 g/mol', '71.85 g/mol', '215.54 g/mol']),
        answer: '159.69 g/mol',
        explanation: `2 × Fe (55.845) + 3 × O (15.999) ≈ 159.69 g/mol`,
        teks: 'C.8.A'
    });

    // Q4
    questions.push({
        type: 'multiple-choice',
        question: `What is the molar mass of ${compounds.Al2O3.f}?`,
        options: shuffle(['101.96 g/mol', '74.96 g/mol', '128.96 g/mol', '58.96 g/mol']),
        answer: '101.96 g/mol',
        explanation: `2 × Al (26.98) + 3 × O (16.00) ≈ 101.96 g/mol`,
        teks: 'C.8.A'
    });

    // Q5
    questions.push({
        type: 'multiple-choice',
        question: `Find the molar mass of ${compounds.C6H12O6.f} (Glucose).`,
        options: shuffle(['180.16 g/mol', '170.16 g/mol', '190.16 g/mol', '29.02 g/mol']),
        answer: '180.16 g/mol',
        explanation: `6×C + 12×H + 6×O ≈ 180.16 g/mol`,
        teks: 'C.8.A'
    });

    // 2. Grams to Moles Questions

    // Q6
    questions.push({
        type: 'multiple-choice',
        question: `How many moles are in 36.04 g of ${compounds.H2O.f}?`,
        options: shuffle(['2.0 mol', '1.0 mol', '0.5 mol', '18.0 mol']),
        answer: '2.0 mol',
        explanation: `Moles = 36.04 g ÷ 18.02 g/mol = 2.0 mol`,
        teks: 'C.8.A'
    });

    // Q7
    questions.push({
        type: 'multiple-choice',
        question: `Convert 88.02 g of ${compounds.CO2.f} to moles.`,
        options: shuffle(['2.0 mol', '0.5 mol', '44.0 mol', '1.5 mol']),
        answer: '2.0 mol',
        explanation: `Moles = 88.02 g ÷ 44.01 g/mol = 2.0 mol`,
        teks: 'C.8.A'
    });

    // Q8
    questions.push({
        type: 'multiple-choice',
        question: `How many moles of ${compounds.NaCl.f} are in 29.22 g?`,
        options: shuffle(['0.5 mol', '2.0 mol', '1.0 mol', '0.25 mol']),
        answer: '0.5 mol',
        explanation: `Moles = 29.22 g ÷ 58.44 g/mol = 0.5 mol`,
        teks: 'C.8.A'
    });

    // Q9
    questions.push({
        type: 'multiple-choice',
        question: `Calculate moles in 17.03 g of ${compounds.NH3.f}.`,
        options: shuffle(['1.0 mol', '17.0 mol', '0.1 mol', '2.0 mol']),
        answer: '1.0 mol',
        explanation: `Moles = 17.03 g ÷ 17.03 g/mol = 1.0 mol`,
        teks: 'C.8.A'
    });

    // Q10
    questions.push({
        type: 'multiple-choice',
        question: `You have 40.30 g of ${compounds.MgO.f}. How many moles is this?`,
        options: shuffle(['1.0 mol', '2.0 mol', '0.5 mol', '40.3 mol']),
        answer: '1.0 mol',
        explanation: `Moles = 40.30 g ÷ 40.30 g/mol = 1.0 mol`,
        teks: 'C.8.A'
    });

    // 3. Moles to Grams Questions

    // Q11
    questions.push({
        type: 'multiple-choice',
        question: `What is the mass of 2.0 moles of ${compounds.CaO.f}?`,
        options: shuffle(['112.16 g', '56.08 g', '28.04 g', '168.24 g']),
        answer: '112.16 g',
        explanation: `Mass = 2.0 mol × 56.08 g/mol = 112.16 g`,
        teks: 'C.8.A'
    });

    // Q12
    questions.push({
        type: 'multiple-choice',
        question: `Calculate the mass of 0.5 mol of ${compounds.CH4.f}.`,
        options: shuffle(['8.02 g', '16.04 g', '4.01 g', '32.08 g']),
        answer: '8.02 g',
        explanation: `Mass = 0.5 mol × 16.04 g/mol = 8.02 g`,
        teks: 'C.8.A'
    });

    // Q13
    questions.push({
        type: 'multiple-choice',
        question: `Find the mass of 3.0 mol of ${compounds.H2O.f}.`,
        options: shuffle(['54.06 g', '18.02 g', '36.04 g', '72.08 g']),
        answer: '54.06 g',
        explanation: `Mass = 3.0 mol × 18.02 g/mol = 54.06 g`,
        teks: 'C.8.A'
    });

    // Q14
    questions.push({
        type: 'fill-in',
        question: `Calculate the mass (in grams) of 0.1 mol of ${compounds.NaCl.f}. (Molar mass = 58.44 g/mol)`,
        answer: '5.84', // approximate
        tolerance: 0.1,
        hint: 'Multiply moles by molar mass',
        explanation: `Mass = 0.1 mol × 58.44 g/mol = 5.84 g`,
        teks: 'C.8.A'
    });

    // Q15
    questions.push({
        type: 'multiple-choice',
        question: `What is the mass of 10 moles of ${compounds.MgO.f}?`,
        options: shuffle(['403.0 g', '40.3 g', '201.5 g', '80.6 g']),
        answer: '403.0 g',
        explanation: `Mass = 10 mol × 40.30 g/mol = 403.0 g`,
        teks: 'C.8.A'
    });

    // 4. Particles/Avogadro Questions

    // Q16
    questions.push({
        type: 'multiple-choice',
        question: `How many atoms are in 1 mole of Iron (Fe)?`,
        options: shuffle(['6.022 × 10²³ atoms', '1 atom', '55.85 atoms', '12.04 × 10²³ atoms']),
        answer: '6.022 × 10²³ atoms',
        explanation: `One mole of any substance contains Avogadro's number (6.022 × 10²³) of particles.`,
        teks: 'C.8.A'
    });

    // Q17
    questions.push({
        type: 'multiple-choice',
        question: `How many molecules are in 0.5 mol of ${compounds.CO2.f}?`,
        options: shuffle(['3.011 × 10²³', '6.022 × 10²³', '1.505 × 10²³', '12.044 × 10²³']),
        answer: '3.011 × 10²³',
        explanation: `0.5 mol × 6.022 × 10²³ = 3.011 × 10²³ molecules`,
        teks: 'C.8.A'
    });

    // Q18
    questions.push({
        type: 'multiple-choice',
        question: `If you have 6.022 × 10²³ molecules of water, how many moles is that?`,
        options: shuffle(['1 mol', '18 mol', '2 mol', '0.5 mol']),
        answer: '1 mol',
        explanation: `6.022 × 10²³ represents exactly 1 mole.`,
        teks: 'C.8.A'
    });

    // Q19
    questions.push({
        type: 'multiple-choice',
        question: `How many moles are in 1.204 × 10²⁴ atoms of Carbon?`,
        options: shuffle(['2.0 mol', '1.0 mol', '0.5 mol', '12.0 mol']),
        answer: '2.0 mol',
        explanation: `(1.204 × 10²⁴) / (6.022 × 10²³) = 2.0 mol`,
        teks: 'C.8.A'
    });

    // Q20
    questions.push({
        type: 'fill-in',
        question: `Calculate the mass of 1 mole of ${compounds.Al2O3.f} rounded to the nearest whole number.`,
        answer: '102',
        tolerance: 0.5,
        hint: 'Use the atomic masses from the periodic table',
        explanation: `Molar mass of Al₂O₃ is approximately 101.96 g/mol, which rounds to 102 g.`,
        teks: 'C.8.A'
    });

    return shuffle(questions);
}

// ============================================
// FORMULA DETECTIVE QUESTIONS (TEKS C.8.D)
// ============================================
export function generateFormulaDetectiveQuestions() {
    const questions = [];

    // Q1
    questions.push({
        type: 'multiple-choice',
        question: `What is the <strong>empirical formula</strong> of glucose (C₆H₁₂O₆)?`,
        options: shuffle(['CH₂O', 'C₆H₁₂O₆', 'CHO', 'C₃H₆O₃']),
        answer: 'CH₂O',
        explanation: `Divide subscripts by the greatest common factor (6). C₆/₆ H₁₂/₆ O₆/₆ = CH₂O.`,
        teks: 'C.8.D'
    });

    // Q2
    questions.push({
        type: 'multiple-choice',
        question: `Which is an empirical formula?`,
        options: shuffle(['CO₂', 'C₂H₄', 'C₄H₁₀', 'H₂O₂']),
        answer: 'CO₂',
        explanation: `CO₂ cannot be simplified further. The others can: C₂H₄ → CH₂, C₄H₁₀ → C₂H₅, H₂O₂ → HO.`,
        teks: 'C.8.D'
    });

    // Q3
    questions.push({
        type: 'multiple-choice',
        question: `Find the empirical formula for a compound with C₄H₈.`,
        options: shuffle(['CH₂', 'CH', 'C₂H₄', 'C₄H₈']),
        answer: 'CH₂',
        explanation: `Simplify ratio 4:8 by dividing by 4 to get 1:2, so CH₂.`,
        teks: 'C.8.D'
    });

    // Q4
    questions.push({
        type: 'multiple-choice',
        question: `Empirical formula: CH₂. Molar mass: 42 g/mol. Find molecular formula.`,
        options: shuffle(['C₃H₆', 'CH₂', 'C₂H₄', 'C₄H₈']),
        answer: 'C₃H₆',
        explanation: `Mass of CH₂ = 14 g/mol. 42 / 14 = 3. Multiply CH₂ by 3 → C₃H₆.`,
        teks: 'C.8.D'
    });

    // Q5
    questions.push({
        type: 'multiple-choice',
        question: `A compound is 80% Carbon and 20% Hydrogen by mass. What is its empirical formula? (C=12, H=1)`,
        options: shuffle(['CH₃', 'CH', 'CH₂', 'CH₄']),
        answer: 'CH₃',
        explanation: `80g C / 12 = 6.67 mol. 20g H / 1 = 20 mol. 20/6.67 ≈ 3. Ratio 1:3 -> CH₃.`,
        teks: 'C.8.D'
    });

    // Q6
    questions.push({
        type: 'multiple-choice',
        question: `Find the empirical formula of Hydrogen peroxide (H₂O₂).`,
        options: shuffle(['HO', 'H₂O', 'H₂O₂', 'HO₂']),
        answer: 'HO',
        explanation: `Ratio 2:2 simplifies to 1:1 -> HO.`,
        teks: 'C.8.D'
    });

    // Q7
    questions.push({
        type: 'multiple-choice',
        question: `If empirical formula is CH and Molar Mass is 78 g/mol, what is the molecular formula? (CH ≈ 13 g/mol)`,
        options: shuffle(['C₆H₆', 'CH', 'C₂H₂', 'C₄H₄']),
        answer: 'C₆H₆',
        explanation: `78 / 13 = 6. Formula is C₆H₆ (Benzene).`,
        teks: 'C.8.D'
    });

    // Q8
    questions.push({
        type: 'multiple-choice',
        question: `Identify the molecular formula if empirical is NH₂ and molar mass is 32.05 g/mol.`,
        options: shuffle(['N₂H₄', 'NH₂', 'N₂H₂', 'N₃H₆']),
        answer: 'N₂H₄',
        explanation: `Mass NH₂ = 14 + 2 = 16. 32 / 16 = 2. N₂H₄ (Hydrazine).`,
        teks: 'C.8.D'
    });

    // Q9
    questions.push({
        type: 'multiple-choice',
        question: `Which pair shares the same empirical formula?`,
        options: shuffle(['C₂H₂ and C₆H₆', 'CO and CO₂', 'H₂O and H₂O₂', 'CH₄ and C₂H₆']),
        answer: 'C₂H₂ and C₆H₆',
        explanation: `Both C₂H₂ and C₆H₆ simplify to CH.`,
        teks: 'C.8.D'
    });

    // Q10
    questions.push({
        type: 'multiple-choice',
        question: `What is the empirical formula for Tetraphosphorus decoxide (P₄O₁₀)?`,
        options: shuffle(['P₂O₅', 'P₄O₁₀', 'PO₂', 'P₂O₃']),
        answer: 'P₂O₅',
        explanation: `Ratio 4:10 simplifies to 2:5 -> P₂O₅.`,
        teks: 'C.8.D'
    });

    // Q11
    questions.push({
        type: 'multiple-choice',
        question: `A compound contains 40% Ca, 12% C, and 48% O. What is it?`,
        options: shuffle(['CaCO₃', 'CaC₂O₄', 'CaO', 'CaCO₂']),
        answer: 'CaCO₃',
        explanation: `By molar ratio calculation, it comes out to 1:1:3 -> CaCO₃ (Calcium carbonate).`,
        teks: 'C.8.D'
    });

    // Q12
    questions.push({
        type: 'fill-in',
        question: `The empirical formula is NO₂ (mass 46). The molar mass is 92 g/mol. What is the molecular multiplier?`,
        answer: '2',
        tolerance: 0,
        hint: 'Whole number (92 / 46)',
        explanation: `92 / 46 = 2. Molecular formula is N₂O₄.`,
        teks: 'C.8.D'
    });

    // Q13
    questions.push({
        type: 'multiple-choice',
        question: `Empirical formula: C₂H₅. Molar mass: 58 g/mol. Molecular formula?`,
        options: shuffle(['C₄H₁₀', 'C₂H₅', 'C₆H₁₅', 'C₈H₂₀']),
        answer: 'C₄H₁₀',
        explanation: `Mass C₂H₅ = 29. 58 / 29 = 2. Formula is C₄H₁₀ (Butane).`,
        teks: 'C.8.D'
    });

    // Q14
    questions.push({
        type: 'multiple-choice',
        question: `Is C₈H₁₈ an empirical formula?`,
        options: shuffle(['No, it simplifies to C₄H₉', 'Yes', 'No, it simplifies to C₂H₄.₅', 'It depends']),
        answer: 'No, it simplifies to C₄H₉',
        explanation: `8:18 simplifies to 4:9.`,
        teks: 'C.8.D'
    });

    // Q15
    questions.push({
        type: 'multiple-choice',
        question: `The empirical formula of Caffeine is C₄H₅N₂O. Its molar mass is 194.2 g/mol. If the empirical mass is 97.1, what is the formula?`,
        options: shuffle(['C₈H₁₀N₄O₂', 'C₄H₅N₂O', 'C₁₂H₁₅N₆O₃', 'C₁₆H₂₀N₈O₄']),
        answer: 'C₈H₁₀N₄O₂',
        explanation: `194.2 / 97.1 = 2. Multiply subscripts by 2 -> C₈H₁₀N₄O₂.`,
        teks: 'C.8.D'
    });

    // Q16
    questions.push({
        type: 'multiple-choice',
        question: `Empirical formula for acetic acid (C₂H₄O₂)?`,
        options: shuffle(['CH₂O', 'C₂H₄O₂', 'CHO', 'CH₃COOH']),
        answer: 'CH₂O',
        explanation: `Ratio 2:4:2 simplifies to 1:2:1.`,
        teks: 'C.8.D'
    });

    // Q17
    questions.push({
        type: 'multiple-choice',
        question: `What is the empirical formula of Ribose (C₅H₁₀O₅)?`,
        options: shuffle(['CH₂O', 'C₅H₁₀O₅', 'C₂H₅O₂', 'CHO']),
        answer: 'CH₂O',
        explanation: `5:10:5 simplifies to 1:2:1.`,
        teks: 'C.8.D'
    });

    // Q18
    questions.push({
        type: 'fill-in',
        question: `How many atoms of Carbon are in the empirical formula of Benzene (C₆H₆)?`,
        answer: '1',
        tolerance: 0,
        hint: 'C₆H₆ simplifies to...',
        explanation: `C₆H₆ simplifies to CH. It has 1 Carbon atom.`,
        teks: 'C.8.D'
    });

    // Q19
    questions.push({
        type: 'multiple-choice',
        question: `Which compound has the same empirical and molecular formula?`,
        options: shuffle(['H₂O', 'H₂O₂', 'C₆H₁₂O₆', 'N₂O₄']),
        answer: 'H₂O',
        explanation: `H₂O (2:1) cannot be simplified. H₂O₂ -> HO, C₆H₁₂O₆ -> CH₂O, N₂O₄ -> NO₂.`,
        teks: 'C.8.D'
    });

    // Q20
    questions.push({
        type: 'multiple-choice',
        question: `Find the molecular formula if empirical is CH₂O and mass is 60 g/mol.`,
        options: shuffle(['C₂H₄O₂', 'CH₂O', 'C₃H₆O₃', 'C₄H₈O₄']),
        answer: 'C₂H₄O₂',
        explanation: `Mass CH₂O = 30. 60 / 30 = 2. Formula C₂H₄O₂ (Acetic Acid).`,
        teks: 'C.8.D'
    });

    return shuffle(questions);
}

// ============================================
// STOICHIOMETRY KITCHEN QUESTIONS (TEKS C.9.C)
// ============================================
export function generateStoichiometryQuestions() {
    const questions = [];

    // Reaction for reference
    const r1 = "2H₂ + O₂ → 2H₂O";
    const r2 = "2Na + Cl₂ → 2NaCl";
    const r3 = "2Mg + O₂ → 2MgO";
    const r4 = "N₂ + 3H₂ → 2NH₃";

    // Q1
    questions.push({
        type: 'multiple-choice',
        question: `In ${r1}, how many moles of H₂O are produced from 4 mol of H₂?`,
        options: shuffle(['4 mol', '2 mol', '8 mol', '1 mol']),
        answer: '4 mol',
        explanation: `Ratio H₂:H₂O is 2:2 (or 1:1). 4 mol H₂ → 4 mol H₂O.`,
        teks: 'C.9.C'
    });

    // Q2
    questions.push({
        type: 'multiple-choice',
        question: `In ${r2}, how many grams of NaCl are produced from 23 g of Na? (Na=23g/mol, NaCl=58.5g/mol)`,
        options: shuffle(['58.5 g', '117 g', '29.25 g', '46 g']),
        answer: '58.5 g',
        explanation: `23g Na = 1 mol Na. Ratio Na:NaCl is 2:2 (1:1). So 1 mol NaCl produces 58.5g.`,
        teks: 'C.9.C'
    });

    // Q3
    questions.push({
        type: 'multiple-choice',
        question: `In ${r3}, what is the theoretical yield of MgO from 48.6 g of Mg? (Mg=24.3g/mol, MgO=40.3g/mol)`,
        options: shuffle(['80.6 g', '40.3 g', '120.9 g', '60.45 g']),
        answer: '80.6 g',
        explanation: `48.6 g Mg = 2 mol. Ratio Mg:MgO is 1:1. So 2 mol MgO = 80.6g.`,
        teks: 'C.9.C'
    });

    // Q4
    questions.push({
        type: 'multiple-choice',
        question: `For ${r4}, how many moles of H₂ are needed to react with 1 mole of N₂?`,
        options: shuffle(['3 mol', '1 mol', '2 mol', '6 mol']),
        answer: '3 mol',
        explanation: `The coeffecient for H₂ is 3 and N₂ is 1. Ratio 3:1.`,
        teks: 'C.9.C'
    });

    // Q5
    questions.push({
        type: 'multiple-choice',
        question: `In ${r1}, how many moles of O₂ are needed to produce 2 moles of H₂O?`,
        options: shuffle(['1 mol', '2 mol', '0.5 mol', '4 mol']),
        answer: '1 mol',
        explanation: `Ratio O₂:H₂O is 1:2. To get 2 moles H₂O, you need 1 mole O₂.`,
        teks: 'C.9.C'
    });

    // Q6
    questions.push({
        type: 'multiple-choice',
        question: `In ${r2}, if you start with 5 moles of Cl₂, how many moles of NaCl can form?`,
        options: shuffle(['10 mol', '5 mol', '2 mol', '20 mol']),
        answer: '10 mol',
        explanation: `Ratio Cl₂:NaCl is 1:2. 5 × 2 = 10 mol.`,
        teks: 'C.9.C'
    });

    // Q7
    questions.push({
        type: 'multiple-choice',
        question: `Using 2Mg + O₂ → 2MgO, how much Oxygen (in moles) reacts with 4 moles Magensium?`,
        options: shuffle(['2 mol', '4 mol', '1 mol', '8 mol']),
        answer: '2 mol',
        explanation: `Ratio Mg:O₂ is 2:1. So 4 mol Mg requires 2 mol O₂.`,
        teks: 'C.9.C'
    });

    // Q8
    questions.push({
        type: 'multiple-choice',
        question: `Calculate mass of NH₃ produced from 14g N₂. (N₂=28g/mol, NH₃=17g/mol). Eq: ${r4}`,
        options: shuffle(['17 g', '34 g', '8.5 g', '28 g']),
        answer: '17 g',
        explanation: `14g N₂ = 0.5 mol N₂. Ratio N₂:NH₃ is 1:2. So 1 mol NH₃ is produced. Mass = 17g.`,
        teks: 'C.9.C'
    });

    // Q9
    questions.push({
        type: 'multiple-choice',
        question: `What is the mole ratio of H₂ to NH₃ in the reaction ${r4}?`,
        options: shuffle(['3:2', '1:2', '2:3', '3:1']),
        answer: '3:2',
        explanation: `Coefficients are 3 for H₂ and 2 for NH₃.`,
        teks: 'C.9.C'
    });

    // Q10
    questions.push({
        type: 'multiple-choice',
        question: `If 4 moles of O₂ react in ${r1}, how many moles of H₂ molecules are consumed?`,
        options: shuffle(['8 mol', '4 mol', '2 mol', '16 mol']),
        answer: '8 mol',
        explanation: `Ratio O₂:H₂ is 1:2. 4 × 2 = 8 mol.`,
        teks: 'C.9.C'
    });

    // Q11
    questions.push({
        type: 'multiple-choice',
        question: `Reaction: CH₄ + 2O₂ → CO₂ + 2H₂O. Ratio of O₂ to CO₂?`,
        options: shuffle(['2:1', '1:2', '1:1', '2:2']),
        answer: '2:1',
        explanation: `Coefficient O₂ is 2, CO₂ is 1.`,
        teks: 'C.9.C'
    });

    // Q12
    questions.push({
        type: 'fill-in',
        question: `In ${r4}, if you produce 4 moles of NH₃, how many moles of N₂ did you react?`,
        answer: '2',
        tolerance: 0,
        hint: 'Ratio N₂:NH₃ is 1:2',
        explanation: `Ratio 1:2. If output is 4, input must be 2.`,
        teks: 'C.9.C'
    });

    // Q13
    questions.push({
        type: 'multiple-choice',
        question: `Mole ratio of Reactants in ${r1}?`,
        options: shuffle(['2:1', '1:2', '2:2', '1:1']),
        answer: '2:1',
        explanation: `Reactants are H₂ and O₂. Coefficients 2 and 1.`,
        teks: 'C.9.C'
    });

    // Q14
    questions.push({
        type: 'multiple-choice',
        question: `Reaction: 2H₂O₂ → 2H₂O + O₂. Producing 5 mol O₂ requires how much H₂O₂?`,
        options: shuffle(['10 mol', '5 mol', '2.5 mol', '20 mol']),
        answer: '10 mol',
        explanation: `Ratio O₂:H₂O₂ is 1:2. 5 × 2 = 10 mol.`,
        teks: 'C.9.C'
    });

    // Q15
    questions.push({
        type: 'multiple-choice',
        question: `How many grams of H₂ are needed to make 36g H₂O? (H₂O=18g/mol, H₂=2g/mol). Eq: ${r1}`,
        options: shuffle(['4 g', '2 g', '36 g', '8 g']),
        answer: '4 g',
        explanation: `36g H₂O = 2 mol H₂O. Ratio H₂O:H₂ is 2:2. So 2 mol H₂ needed. 2 mol × 2g/mol = 4g.`,
        teks: 'C.9.C'
    });

    // Q16
    questions.push({
        type: 'multiple-choice',
        question: `In ${r3}, if 2 moles of Mg react, how many moles of MgO form?`,
        options: shuffle(['2 mol', '1 mol', '4 mol', '0.5 mol']),
        answer: '2 mol',
        explanation: `Ratio 2:2 is 1:1. 2 in → 2 out.`,
        teks: 'C.9.C'
    });

    // Q17
    questions.push({
        type: 'multiple-choice',
        question: `Stoichiometry deals with:`,
        options: shuffle(['Mass/Mole relationships in reactions', 'Speed of light', 'Only electrons', 'Naming compounds']),
        answer: 'Mass/Mole relationships in reactions',
        explanation: `Stoichiometry is the calculation of reactants and products in chemical reactions.`,
        teks: 'C.9.C'
    });

    // Q18
    questions.push({
        type: 'multiple-choice',
        question: `Reaction 2CO + O₂ → 2CO₂. Ratio CO:O₂?`,
        options: shuffle(['2:1', '1:2', '1:1', '2:2']),
        answer: '2:1',
        explanation: `Coefficients are 2 and 1.`,
        teks: 'C.9.C'
    });

    // Q19
    questions.push({
        type: 'fill-in',
        question: `In N₂ + 3H₂ → 2NH₃, reacting 3 moles of N₂ consumes how many moles H₂?`,
        answer: '9',
        tolerance: 0,
        hint: 'Multiply by ratio 3',
        explanation: `Ratio 1:3. 3 × 3 = 9 mol.`,
        teks: 'C.9.C'
    });

    // Q20
    questions.push({
        type: 'multiple-choice',
        question: `Mass is conserved in chemical reactions. True or False?`,
        options: shuffle(['True', 'False']),
        answer: 'True',
        explanation: `The Law of Conservation of Mass states mass is neither created nor destroyed.`,
        teks: 'C.9.C'
    });

    return shuffle(questions);
}

// ============================================
// LIMITING REACTANT QUESTIONS (TEKS C.9.D)
// ============================================
export function generateLimitingReactantQuestions() {
    const questions = [];

    // Q1
    questions.push({
        type: 'multiple-choice',
        question: `N₂ + 3H₂ → 2NH₃. If you have 2 mol N₂ and 3 mol H₂, which is the limiting reactant?`,
        options: shuffle(['H₂', 'N₂', 'Neither (exact ratio)', 'NH₃']),
        answer: 'H₂',
        explanation: `For 2 mol N₂, you need 2 × 3 = 6 mol H₂. You only have 3 mol H₂, so H₂ runs out first and is the limiting reactant.`,
        teks: 'C.9.D'
    });

    // Q2
    questions.push({
        type: 'multiple-choice',
        question: `2Mg + O₂ → 2MgO. With 24.3 g Mg and excess O₂, what is the maximum mass of MgO? (Mg = 24.3, MgO = 40.3 g/mol)`,
        options: shuffle(['40.3 g', '80.6 g', '24.3 g', '64.6 g']),
        answer: '40.3 g',
        explanation: `24.3 g Mg = 1 mol Mg. From equation: 2 mol Mg → 2 mol MgO (1:1 ratio). 1 mol MgO × 40.3 g/mol = 40.3 g.`,
        teks: 'C.9.D'
    });

    // Q3
    questions.push({
        type: 'multiple-choice',
        question: `In the reaction 2A + B → C, if start with 4 moles A and 3 moles B, which is limiting?`,
        options: shuffle(['A', 'B', 'C', 'Neither']),
        answer: 'A',
        explanation: `Have: 4 A, 3 B. Need: 2 A for 1 B. 3 B needs 6 A. We only have 4 A. So A is limiting.`,
        teks: 'C.9.D'
    });

    // Q4
    questions.push({
        type: 'multiple-choice',
        question: `CH₄ + 2O₂ → CO₂ + 2H₂O. 1 mol CH₄ reacts with 1 mol O₂. Limiting reactant?`,
        options: shuffle(['O₂', 'CH₄', 'H₂O', 'CO₂']),
        answer: 'O₂',
        explanation: `1 mol CH₄ needs 2 mol O₂. We only have 1 mol O₂.`,
        teks: 'C.9.D'
    });

    // Q5
    questions.push({
        type: 'multiple-choice',
        question: `The reactant that is completely consumed in a reaction is called the:`,
        options: shuffle(['Limiting Reactant', 'Excess Reactant', 'Catalyst', 'Product']),
        answer: 'Limiting Reactant',
        explanation: `The limiting reactant determines the maximum amount of product that can be formed.`,
        teks: 'C.9.D'
    });

    // Q6
    questions.push({
        type: 'fill-in',
        question: `2H₂ + O₂ → 2H₂O. If you have 4 mol H₂ and 1 mol O₂, how many moles of H₂O form?`,
        answer: '2',
        tolerance: 0,
        hint: 'Number only',
        explanation: `1 mol O₂ is limiting (needs 2 mol H₂). 1 mol O₂ produces 2 mol H₂O.`,
        teks: 'C.9.D'
    });

    // Q7
    questions.push({
        type: 'multiple-choice',
        question: `Which reactant is in excess if you mix 4 moles H₂ and 4 moles O₂ to make water (2H₂ + O₂ → 2H₂O)?`,
        options: shuffle(['O₂', 'H₂', 'H₂O', 'None']),
        answer: 'O₂',
        explanation: `4 mol H₂ needs 2 mol O₂. You have 4 mol O₂, so larger amount is excess.`,
        teks: 'C.9.D'
    });

    // Q8
    questions.push({
        type: 'multiple-choice',
        question: `Limiting reactant determines the:`,
        options: shuffle(['Theoretical Yield', 'molar mass', 'Reaction Rate', 'Activation Energy']),
        answer: 'Theoretical Yield',
        explanation: `The maximum amount of product you can make is confined by the limiting reactant.`,
        teks: 'C.9.D'
    });

    // Q9
    questions.push({
        type: 'multiple-choice',
        question: `If 2Na + Cl₂ → 2NaCl, and start with 2 moles Na and 2 moles Cl₂, how many moles NaCl form?`,
        options: shuffle(['2 mol', '4 mol', '1 mol', '0.5 mol']),
        answer: '2 mol',
        explanation: `2 mol Na needs 1 mol Cl₂. Na is limiting. 2 mol Na -> 2 mol NaCl.`,
        teks: 'C.9.D'
    });

    // Q10
    questions.push({
        type: 'multiple-choice',
        question: `Reaction A + B → AB. 5 mol A, 10 mol B. Yield of AB?`,
        options: shuffle(['5 mol', '10 mol', '15 mol', '2.5 mol']),
        answer: '5 mol',
        explanation: `1:1 ratio. A runs out at 5. B has 5 left over. Yield is 5 mol AB.`,
        teks: 'C.9.D'
    });

    // Q11
    questions.push({
        type: 'fill-in',
        question: `N₂ + 3H₂ → 2NH₃. With 1 mol N₂ and 9 mol H₂, how many moles of excess H₂ remain?`,
        answer: '6',
        tolerance: 0,
        hint: 'Start with 9, subtract used',
        explanation: `1 mol N₂ uses 3 mol H₂. 9 - 3 = 6 mol H₂ remaining.`,
        teks: 'C.9.D'
    });

    // Q12
    questions.push({
        type: 'multiple-choice',
        question: `S + O₂ → SO₂. 32g S (1 mol) reacts with 16g O₂ (0.5 mol). Grams SO₂? (SO₂ = 64g/mol)`,
        options: shuffle(['32 g', '64 g', '16 g', '48 g']),
        answer: '32 g',
        explanation: `O₂ is limiting (0.5 mol). Makes 0.5 mol SO₂. 0.5 * 64 = 32g.`,
        teks: 'C.9.D'
    });

    // Q13
    questions.push({
        type: 'multiple-choice',
        question: `What happens to the excess reactant?`,
        options: shuffle(['It remains unreacted', 'It becomes product', 'It disappears', 'It turns into heat']),
        answer: 'It remains unreacted',
        explanation: `The portion of the excess reactant that is not needed remains in the vessel.`,
        teks: 'C.9.D'
    });

    // Q14
    questions.push({
        type: 'multiple-choice',
        question: `C + O₂ → CO₂. If mass ratio is 12g C to 32g O₂, who is limiting?`,
        options: shuffle(['Neither (Stoichiometric)', 'C', 'O₂', 'CO₂']),
        answer: 'Neither (Stoichiometric)',
        explanation: `12g C = 1 mol. 32g O₂ = 1 mol. Ratio 1:1. Exact match.`,
        teks: 'C.9.D'
    });

    // Q15
    questions.push({
        type: 'multiple-choice',
        question: `The theoretical yield is usually ___ actual yield.`,
        options: shuffle(['Greater than', 'Less than', 'Equal to', 'Unrelated to']),
        answer: 'Greater than',
        explanation: `In the real world, losses occur, so actual yield is less than theoretical yield.`,
        teks: 'C.9.D'
    });

    // Q16
    questions.push({
        type: 'fill-in',
        question: `2H₂ + O₂ → 2H₂O. 10 H₂ + 10 O₂ (moles). How many moles H₂O form?`,
        answer: '10',
        tolerance: 0,
        hint: 'Number only',
        explanation: `10 H₂ limit the reaction (needs 5 O₂). 10 H₂ → 10 H₂O.`,
        teks: 'C.9.D'
    });

    // Q17
    questions.push({
        type: 'multiple-choice',
        question: `Identify the limiting reactant when 6g H₂ reacts with 64g O₂ (2H₂ + O₂ → 2H₂O).`,
        options: shuffle(['H₂', 'O₂', 'Water', 'Both']),
        answer: 'H₂',
        explanation: `6g H₂ = 3 mol. 64g O₂ = 2 mol. Need 2:1 ratio. 3H₂ needs 1.5O₂. Wait! 2 mol O₂ needs 4 mol H₂. We have 3 mol H₂. So H₂ is limiting.`,
        teks: 'C.9.D'
    });

    // Q18
    questions.push({
        type: 'multiple-choice',
        question: `If yield depends on limiting reactant, adding more excess reactant...`,
        options: shuffle(['Does not increase yield', 'Increases yield', 'Stops reaction', 'Explodes']),
        answer: 'Does not increase yield',
        explanation: `Once the limiting reactant is gone, the reaction stops, regardless of excess.`,
        teks: 'C.9.D'
    });

    // Q19
    questions.push({
        type: 'multiple-choice',
        question: `4Al + 3O₂ → 2Al₂O₃. 4 mol Al, 4 mol O₂. Limiting?`,
        options: shuffle(['Al', 'O₂', 'None', 'Al₂O₃']),
        answer: 'Al',
        explanation: `Wait. 4 mol Al needs 3 mol O₂. We have 4 mol O₂ (Excess). So Al is limiting.`,
        teks: 'C.9.D'
    });

    // Q20
    questions.push({
        type: 'fill-in',
        question: `If 5 moles of reactant A make 5 moles of product P, what is the ratio?`,
        answer: '1',
        tolerance: 0,
        hint: '1:?',
        explanation: `Ratio is 1:1 for 5:5.`,
        teks: 'C.9.D'
    });

    return shuffle(questions);
}

// ============================================
// PERCENT COMPOSITION QUESTIONS (TEKS C.8.C)
// ============================================
export function generatePercentCompositionQuestions() {
    const questions = [];

    // Q1
    const h2oMass = 18.02;
    const oPercent = formatNumber((15.999 / h2oMass) * 100, 1);
    questions.push({
        type: 'multiple-choice',
        question: `What is the percent composition of oxygen in H₂O? (H = 1.008, O = 15.999)`,
        options: shuffle([`${oPercent}%`, '11.2%', '50.0%', '66.7%']),
        answer: `${oPercent}%`,
        explanation: `% O = (mass of O ÷ molar mass) × 100 = (15.999 ÷ 18.02) × 100 = ${oPercent}%`,
        teks: 'C.8.C'
    });

    // Q2
    const naclMass = 58.44;
    const naPercent = formatNumber((22.990 / naclMass) * 100, 1);
    questions.push({
        type: 'fill-in',
        question: `Calculate the percent composition of sodium in NaCl. (Na = 22.99, Cl = 35.45)`,
        answer: `${naPercent}`,
        tolerance: 0.5,
        hint: 'Number without % (e.g., 39.3)',
        explanation: `% Na = (mass of Na ÷ molar mass) × 100 = (22.99 ÷ 58.44) × 100 = ${naPercent}%`,
        teks: 'C.8.C'
    });

    // Q3
    questions.push({
        type: 'multiple-choice',
        question: `Percent composition of Carbon in Methane (CH₄, mass 16.04)? (C=12.01)`,
        options: shuffle(['74.9%', '25.1%', '50.0%', '90.0%']),
        answer: '74.9%',
        explanation: `(12.01 / 16.04) * 100 ≈ 74.9%`,
        teks: 'C.8.C'
    });

    // Q4
    questions.push({
        type: 'multiple-choice',
        question: `Percent mass of H in H₂O (mass 18.02)? (H=1.01)`,
        options: shuffle(['11.2%', '88.8%', '5.6%', '20.0%']),
        answer: '11.2%',
        explanation: `(2.02 / 18.02) * 100 ≈ 11.2%`,
        teks: 'C.8.C'
    });

    // Q5
    questions.push({
        type: 'multiple-choice',
        question: `Which has highest % Carbon by mass?`,
        options: shuffle(['CH₄', 'CH₂O', 'CO₂', 'C₆H₁₂O₆']),
        answer: 'CH₄',
        explanation: `CH₄ is ~75%. Others are lower (e.g. CO2 is ~27%).`,
        teks: 'C.8.C'
    });

    // Q6
    questions.push({
        type: 'fill-in',
        question: `Mass of O in 100g CO₂ (27% C, 73% O)?`,
        answer: '73',
        tolerance: 0.1,
        hint: 'Grams',
        explanation: `If it is 73% oxygen, then 100g contains 73g.`,
        teks: 'C.8.C'
    });

    // Q7
    questions.push({
        type: 'multiple-choice',
        question: `Formula for Percent Composition?`,
        options: shuffle(['(Part/Whole) * 100', '(Whole/Part) * 100', 'Part + Whole', 'Part * Whole']),
        answer: '(Part/Whole) * 100',
        explanation: `The percentage is the mass of the element divided by total mass times 100.`,
        teks: 'C.8.C'
    });

    // Q8
    questions.push({
        type: 'multiple-choice',
        question: `Percent of Mg in MgO (mass 40.3)? (Mg=24.3)`,
        options: shuffle(['60.3%', '39.7%', '50.0%', '24.3%']),
        answer: '60.3%',
        explanation: `(24.3 / 40.3) * 100 ≈ 60.3%`,
        teks: 'C.8.C'
    });

    // Q9
    questions.push({
        type: 'multiple-choice',
        question: `Percent O in CO (mass 28.01)?`,
        options: shuffle(['57.1%', '42.9%', '50%', '30%']),
        answer: '57.1%',
        explanation: `(16 / 28.01) * 100 ≈ 57.1%`,
        teks: 'C.8.C'
    });

    // Q10
    questions.push({
        type: 'multiple-choice',
        question: `Find % of N in NH₃ (mass 17.03). (N=14.01)`,
        options: shuffle(['82.3%', '17.7%', '50.5%', '90.1%']),
        answer: '82.3%',
        explanation: `(14.01 / 17.03) * 100 ≈ 82.3%`,
        teks: 'C.8.C'
    });

    // Q11
    questions.push({
        type: 'fill-in',
        question: `A compound has 50g total mass and contains 10g H. What is % H?`,
        answer: '20',
        tolerance: 0,
        hint: 'Number only',
        explanation: `(10 / 50) * 100 = 20%`,
        teks: 'C.8.C'
    });

    // Q12
    questions.push({
        type: 'multiple-choice',
        question: `Percent Composition allows you to find:`,
        options: shuffle(['Empirical Formula', 'Density', 'Boiling Point', 'pH']),
        answer: 'Empirical Formula',
        explanation: `You can derive the empirical formula from percent composition data.`,
        teks: 'C.8.C'
    });

    // Q13
    questions.push({
        type: 'multiple-choice',
        question: `Calculate % Cl in CaCl₂ (mass 111). (Cl=35.5, note there are 2 Cl)`,
        options: shuffle(['64.0%', '32.0%', '35.5%', '71.0%']),
        answer: '64.0%',
        explanation: `2 * 35.5 = 71. (71 / 111) * 100 ≈ 64.0%`,
        teks: 'C.8.C'
    });

    // Q14
    questions.push({
        type: 'multiple-choice',
        question: `Percent by mass of water in hydrate CuSO₄·5H₂O? (Mass=249.7, 5H₂O=90)`,
        options: shuffle(['36.0%', '18.0%', '64.0%', '50.0%']),
        answer: '36.0%',
        explanation: `(90 / 249.7) * 100 ≈ 36.0%`,
        teks: 'C.8.C'
    });

    // Q15
    questions.push({
        type: 'multiple-choice',
        question: `If a compound is 40% C, 6.7% H, 53.3% O, what is it likely?`,
        options: shuffle(['Glucose (CH₂O)', 'Methane', 'Water', 'Salt']),
        answer: 'Glucose (CH₂O)',
        explanation: `These percentages match the ratio for CH₂O (Empirical formula for Glucose).`,
        teks: 'C.8.C'
    });

    // Q16
    questions.push({
        type: 'fill-in',
        question: `50% of a 200g compound is Oxygen. How many grams of Oxygen?`,
        answer: '100',
        tolerance: 0,
        hint: 'Grams',
        explanation: `0.50 * 200 = 100g.`,
        teks: 'C.8.C'
    });

    // Q17
    questions.push({
        type: 'multiple-choice',
        question: `Which has more Oxygen %? CO₂ or CO?`,
        options: shuffle(['CO₂', 'CO', 'Same', 'Neither']),
        answer: 'CO₂',
        explanation: `CO2 is 73% O. CO is 57% O.`,
        teks: 'C.8.C'
    });

    // Q18
    questions.push({
        type: 'multiple-choice',
        question: `Mass % is an intensive property.`,
        options: shuffle(['False', 'True']),
        answer: 'True',
        explanation: `It relies on the identity of the substance, not the amount you have.`,
        teks: 'C.8.C'
    });

    // Q19
    questions.push({
        type: 'multiple-choice',
        question: `Percent composition sum for a compound is:`,
        options: shuffle(['100%', '0%', '10%', 'Variable']),
        answer: '100%',
        explanation: `The sum of parts equals the whole (100%).`,
        teks: 'C.8.C'
    });

    // Q20
    questions.push({
        type: 'fill-in',
        question: `If a sample is 90% pure gold and weighs 10g, how much gold is there?`,
        answer: '9',
        tolerance: 0,
        hint: 'Grams',
        explanation: `0.9 * 10 = 9g.`,
        teks: 'C.8.C'
    });

    return shuffle(questions);
}

export { shuffle };
