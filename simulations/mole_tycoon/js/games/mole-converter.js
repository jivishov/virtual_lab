/**
 * Game 1: Mole Mass Converter
 * TEKS C.8.A - Convert between moles and grams using molar mass
 */

import { generateMoleConverterQuestions } from '../core/questions.js';

const MoleConverter = {
    id: 'mole-converter',
    name: 'Mole Mass Converter',
    description: 'Convert between grams and moles using molar mass',
    icon: '⚖️',
    teks: 'C.8.A',
    questionCount: 20,
    color: 'var(--game-1-color)',

    start(questionCount = null) {
        let questions = generateMoleConverterQuestions();
        // If shift specifies a count, limit questions
        if (questionCount && questionCount < questions.length) {
            questions = questions.slice(0, questionCount);
        }
        window.gameEngine.startGame(this.id, questions);
    }
};

// Register game module
window.gameModules['mole-converter'] = MoleConverter;

export default MoleConverter;
