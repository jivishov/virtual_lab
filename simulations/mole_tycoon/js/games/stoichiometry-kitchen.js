/**
 * Game 3: Stoichiometry Kitchen
 * TEKS C.9.C - Perform stoichiometric calculations
 */

import { generateStoichiometryQuestions } from '../core/questions.js';

const StoichiometryKitchen = {
    id: 'stoichiometry-kitchen',
    name: 'Stoichiometry Kitchen',
    description: 'Calculate mass and mole relationships in reactions',
    icon: '🧪',
    teks: 'C.9.C',
    questionCount: 20,
    color: 'var(--game-3-color)',

    start() {
        const questions = generateStoichiometryQuestions();
        window.gameEngine.startGame(this.id, questions);
    }
};

// Register game module
window.gameModules['stoichiometry-kitchen'] = StoichiometryKitchen;

export default StoichiometryKitchen;
