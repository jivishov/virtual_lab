/**
 * Game 4: Limiting Reactant Race
 * TEKS C.9.D - Identify limiting reactants in balanced equations
 */

import { generateLimitingReactantQuestions } from '../core/questions.js';

const LimitingReactant = {
    id: 'limiting-reactant',
    name: 'Limiting Reactant Race',
    description: 'Find which reactant runs out first',
    icon: '🏁',
    teks: 'C.9.D',
    questionCount: 20,
    color: 'var(--game-4-color)',

    start() {
        const questions = generateLimitingReactantQuestions();
        window.gameEngine.startGame(this.id, questions);
    }
};

// Register game module
window.gameModules['limiting-reactant'] = LimitingReactant;

export default LimitingReactant;
