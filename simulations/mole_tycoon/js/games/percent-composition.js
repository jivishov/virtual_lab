/**
 * Game 5: Percent Composition Puzzle
 * TEKS C.8.C - Calculate percent composition of compounds
 */

import { generatePercentCompositionQuestions } from '../core/questions.js';

const PercentComposition = {
    id: 'percent-composition',
    name: 'Percent Composition',
    description: 'Calculate element percentages by mass',
    icon: '📊',
    teks: 'C.8.C',
    questionCount: 20,
    color: 'var(--game-5-color)',

    start() {
        const questions = generatePercentCompositionQuestions();
        window.gameEngine.startGame(this.id, questions);
    }
};

// Register game module
window.gameModules['percent-composition'] = PercentComposition;

export default PercentComposition;
