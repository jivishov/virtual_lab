/**
 * MoleTycoon Yield & Profit Calculator
 * Calculates economic outcomes based on answer accuracy and time.
 * 
 * Cycle 2: Yield & Profit System
 */

import GameState from './game-state.js';

/**
 * Calculate yield percentage based on accuracy and time
 * @param {boolean} isCorrect - Whether the answer was correct
 * @param {number} timeTaken - Seconds taken to answer
 * @param {number} timeLimit - Contract time limit in seconds
 * @returns {number} Yield percentage (0-100)
 */
function calculateYield(isCorrect, timeTaken, timeLimit = 60) {
    if (!isCorrect) {
        return 0;  // Wrong answer = 0% yield
    }

    // Correct answer: Calculate yield based on speed
    const timeRatio = timeLimit > 0 ? timeTaken / timeLimit : 0.5;

    if (timeRatio <= 0.25) {
        return 100;  // Very fast = perfect yield + speed bonus eligible
    } else if (timeRatio <= 0.5) {
        return 95;   // Fast = excellent yield
    } else if (timeRatio <= 0.75) {
        return 85;   // Normal = good yield
    } else if (timeRatio <= 1.0) {
        return 75;   // Slow but on time = acceptable yield
    } else {
        return 60;   // Overtime = reduced yield (still correct)
    }
}

/**
 * Calculate profit/loss from a completed contract
 * @param {object} contract - The Contract object
 * @param {number} yieldPercent - Calculated yield (0-100)
 * @returns {object} { grossRevenue, wasteCost, netProfit }
 */
function calculateProfit(contract, yieldPercent) {
    const basePay = contract.pay;

    if (yieldPercent === 0) {
        // Failed contract: Pay waste disposal cost
        const wasteCost = Math.round(basePay * 0.25);
        return {
            grossRevenue: 0,
            wasteCost: wasteCost,
            netProfit: -wasteCost,
            description: 'Contract failed - waste disposal fee'
        };
    }

    // Successful contract
    const grossRevenue = Math.round(basePay * (yieldPercent / 100));
    const wasteCost = yieldPercent < 100 ? Math.round((100 - yieldPercent) / 100 * basePay * 0.1) : 0;
    const netProfit = grossRevenue - wasteCost;

    let description;
    if (yieldPercent >= 95) {
        description = 'Excellent efficiency!';
    } else if (yieldPercent >= 80) {
        description = 'Good yield';
    } else {
        description = 'Some material wasted';
    }

    return {
        grossRevenue,
        wasteCost,
        netProfit,
        description
    };
}

/**
 * Process a completed contract and update GameState
 * @param {object} contract - The Contract object
 * @param {boolean} isCorrect - Whether the answer was correct
 * @param {number} timeTaken - Seconds taken to answer
 * @returns {object} Full result with yield, profit, XP, etc.
 */
function processContractResult(contract, isCorrect, timeTaken) {
    const yieldPercent = calculateYield(isCorrect, timeTaken, contract.timeLimit);
    const profitResult = calculateProfit(contract, yieldPercent);
    const xpEarned = isCorrect ? contract.xpReward : 0;

    // Update GameState
    GameState.addCash(profitResult.netProfit);
    const xpResult = GameState.addXP(xpEarned);
    GameState.recordContract(profitResult.netProfit, profitResult.wasteCost, yieldPercent);

    // Add reputation for good performance
    if (yieldPercent >= 90) {
        GameState.addReputation(1);
    } else if (yieldPercent === 0) {
        GameState.addReputation(-1);
    }

    return {
        contract: {
            client: contract.client,
            urgency: contract.urgency,
            basePay: contract.pay,
        },
        isCorrect,
        timeTaken,
        yieldPercent,
        ...profitResult,
        xpEarned,
        leveledUp: xpResult.leveledUp,
        newLevel: xpResult.newLevel,
        newTitle: xpResult.newTitle,
        newCash: GameState.cash,
        newXP: GameState.xp,
    };
}

/**
 * Generate a summary ledger for a completed game session
 * @param {Array} results - Array of contract results from processContractResult
 * @returns {object} Session summary
 */
function generateSessionLedger(results) {
    const totalContracts = results.length;
    const successfulContracts = results.filter(r => r.isCorrect).length;
    const failedContracts = totalContracts - successfulContracts;

    const totalGrossRevenue = results.reduce((sum, r) => sum + r.grossRevenue, 0);
    const totalWasteCost = results.reduce((sum, r) => sum + r.wasteCost, 0);
    const totalNetProfit = results.reduce((sum, r) => sum + r.netProfit, 0);
    const totalXP = results.reduce((sum, r) => sum + r.xpEarned, 0);

    const avgYield = successfulContracts > 0
        ? Math.round(results.filter(r => r.isCorrect).reduce((sum, r) => sum + r.yieldPercent, 0) / successfulContracts)
        : 0;

    // Performance rating
    let rating;
    const successRate = (successfulContracts / totalContracts) * 100;
    if (successRate >= 90 && avgYield >= 90) {
        rating = { label: 'S', description: 'Outstanding Performance!', color: 'var(--success)' };
    } else if (successRate >= 80) {
        rating = { label: 'A', description: 'Excellent Work', color: 'var(--primary)' };
    } else if (successRate >= 70) {
        rating = { label: 'B', description: 'Good Job', color: 'var(--secondary)' };
    } else if (successRate >= 60) {
        rating = { label: 'C', description: 'Acceptable', color: 'var(--warning)' };
    } else {
        rating = { label: 'D', description: 'Needs Improvement', color: 'var(--error)' };
    }

    return {
        totalContracts,
        successfulContracts,
        failedContracts,
        successRate: Math.round(successRate),
        avgYield,
        totalGrossRevenue,
        totalWasteCost,
        totalNetProfit,
        totalXP,
        rating,
        currentCash: GameState.cash,
        currentLevel: GameState.level,
        currentTitle: GameState.title,
    };
}

export { calculateYield, calculateProfit, processContractResult, generateSessionLedger };
