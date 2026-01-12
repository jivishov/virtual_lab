/**
 * Game 2: Formula Detective
 * TEKS C.8.D - Differentiate between empirical and molecular formulas
 */

import { generateFormulaDetectiveQuestions } from '../core/questions.js';

const FormulaDetective = {
    id: 'formula-detective',
    name: 'Formula Detective',
    description: 'Distinguish empirical vs molecular formulas',
    icon: '🔍',
    teks: 'C.8.D',
    questionCount: 20,
    color: 'var(--game-2-color)',

    start() {
        const questions = generateFormulaDetectiveQuestions();
        window.gameEngine.startGame(this.id, questions);
    }
};

// Register game module
window.gameModules['formula-detective'] = FormulaDetective;

export default FormulaDetective;
