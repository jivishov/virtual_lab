/**
 * MoleTycoon Game Engine
 * Core game state management and navigation - Sims Enhanced!
 */

import Contract from './contract.js';
import { processContractResult, generateSessionLedger } from './yield-calculator.js';
import ShiftManager from './shift-manager.js';
import AvatarState from './avatar-state.js';
import SafetyInspector from './safety-inspector.js';
import ReviewTracker from './review-tracker.js';
import GameState from './game-state.js';
import { renderShiftSummary, renderShiftBanner } from '../ui/shift-summary.js';
import { showAuditPopup } from '../ui/audit-popup.js';
import { showLevelUpModal } from '../ui/level-up-modal.js';
import { showInvestorReview } from '../ui/review-modal.js';
import { showSpecializationSelect } from '../ui/specialization-select.js';

class GameEngine {
  constructor() {
    this.currentGame = null;
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.answers = [];
    this.startTime = null;
    this.questions = [];
    this.contracts = [];  // Lab Tycoon: Contract wrappers
    this.contractResults = [];  // Lab Tycoon: Results for ledger
    this.questionStartTime = null;  // Track time per question
    this.isAnswered = false;
  }

  // Sims-style encouraging messages
  getSimsMessage(isCorrect) {
    const correctMessages = [
      "🧪 Skill increased!",
      "💎 +1 Logic Point!",
      "✨ Your Sim is learning!",
      "🎯 Excellent reasoning!",
      "🔬 Science skill UP!",
      "⚗️ Chemistry mastery!",
      "🧠 Big brain energy!"
    ];
    const incorrectMessages = [
      "💭 Your Sim needs more practice...",
      "📚 Time to hit the books!",
      "🤔 Almost there, keep trying!",
      "💪 Learning takes time!",
      "🔄 Try again next time!"
    ];
    const messages = isCorrect ? correctMessages : incorrectMessages;
    return messages[Math.floor(Math.random() * messages.length)];
  }

  // Initialize a new game
  startGame(gameId, questions) {
    this.currentGame = gameId;
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.answers = [];
    this.questions = questions;
    this.startTime = Date.now();
    this.questionStartTime = Date.now();
    this.isAnswered = false;

    // Create contracts for Lab Tycoon mode
    this.contracts = questions.map(q => new Contract(q));
    this.contractResults = [];  // Reset results

    this.renderGame();
  }

  // Get current question
  getCurrentQuestion() {
    return this.questions[this.currentQuestionIndex] || null;
  }

  // Get current contract (Lab Tycoon mode)
  getCurrentContract() {
    return this.contracts[this.currentQuestionIndex] || null;
  }

  // Submit answer
  submitAnswer(answer) {
    if (this.isAnswered) return null;

    const question = this.getCurrentQuestion();
    if (!question) return null;

    const isCorrect = this.checkAnswer(answer, question);
    this.isAnswered = true;

    this.answers.push({
      questionIndex: this.currentQuestionIndex,
      userAnswer: answer,
      correctAnswer: question.answer,
      isCorrect,
      teks: question.teks
    });

    if (isCorrect) {
      this.score++;
    }

    // Living Avatar: Update mood based on answer
    const moodResult = AvatarState.updateMood(isCorrect);

    // Lab Tycoon: Process contract economics
    const contract = this.getCurrentContract();
    let contractResult = null;
    if (contract) {
      const timeTaken = Math.round((Date.now() - this.questionStartTime) / 1000);
      contractResult = processContractResult(contract, isCorrect, timeTaken);

      // Apply mood modifiers to XP
      const moodEffects = AvatarState.getMoodEffects();
      if (contractResult.xpEarned && moodEffects.xpModifier !== 1.0) {
        const moodBonus = Math.round(contractResult.xpEarned * (moodEffects.xpModifier - 1));
        contractResult.moodBonus = moodBonus;
        contractResult.xpEarned += moodBonus;
      }

      this.contractResults.push(contractResult);

      // Track contract in active shift
      if (ShiftManager.isActive) {
        contractResult = ShiftManager.recordContract(contractResult);
      }

      // Cycle 7: Record for investor review
      ReviewTracker.recordContract(contractResult);
    }

    return {
      isCorrect,
      correctAnswer: question.answer,
      explanation: question.explanation,
      simsMessage: this.getSimsMessage(isCorrect),
      contractResult,  // Lab Tycoon: Include economic data
    };
  }

  // Check if answer is correct
  checkAnswer(userAnswer, question) {
    if (question.type === 'multiple-choice') {
      return userAnswer === question.answer;
    } else if (question.type === 'fill-in') {
      const userNum = parseFloat(userAnswer);
      const correctNum = parseFloat(question.answer);

      if (isNaN(userNum) || isNaN(correctNum)) {
        return userAnswer.toLowerCase().trim() === question.answer.toLowerCase().trim();
      }

      const tolerance = question.tolerance || 0.1;
      return Math.abs(userNum - correctNum) <= tolerance;
    }
    return false;
  }

  // Move to next question
  nextQuestion() {
    this.isAnswered = false;
    this.currentQuestionIndex++;

    // Check if shift is complete (before checking game questions)
    if (ShiftManager.isActive && ShiftManager.isShiftComplete()) {
      this.showShiftSummary();
      return false;
    }

    if (this.currentQuestionIndex >= this.questions.length) {
      this.showSummary();
      return false;
    }

    // Cycle 7: Investor Review check (every 10 contracts)
    if (ReviewTracker.isReviewDue()) {
      const reviewData = ReviewTracker.getReviewData();
      showInvestorReview(reviewData, () => {
        // After review completes, continue to next question or audit
        this.checkForAuditOrRender();
      });
      return true; // Don't render question yet, wait for review
    }

    // Safety Inspector: Random audit check (only during shifts)
    if (ShiftManager.isActive && SafetyInspector.shouldTriggerAudit()) {
      const auditData = SafetyInspector.startAudit();
      showAuditPopup(auditData, () => {
        // After audit completes, render the next question
        this.renderQuestion();
      });
      return true; // Don't render question yet, wait for audit
    }

    this.renderQuestion();
    return true;
  }

  // Helper to check for audit after investor review
  checkForAuditOrRender() {
    if (ShiftManager.isActive && SafetyInspector.shouldTriggerAudit()) {
      const auditData = SafetyInspector.startAudit();
      showAuditPopup(auditData, () => {
        this.renderQuestion();
      });
    } else {
      this.renderQuestion();
    }
  }

  // Show shift summary with paystub
  showShiftSummary() {
    const paystub = ShiftManager.endShift();
    if (paystub) {
      renderShiftSummary(paystub, () => {
        this.exitGame();
        // Re-render hub to update stats
        if (window.renderHub) {
          window.renderHub();
        }
      });
    } else {
      this.exitGame();
    }
  }

  // Render the current game view
  renderGame() {
    const gameContainer = document.getElementById('game-container');
    const hubContainer = document.getElementById('hub-container');

    hubContainer.classList.add('hidden');
    gameContainer.classList.remove('hidden');

    this.renderQuestion();
  }

  // Render current question
  renderQuestion() {
    const question = this.getCurrentQuestion();
    const contract = this.getCurrentContract();
    if (!question) return;

    // Reset question timer
    this.questionStartTime = Date.now();

    // Living Avatar: Drain energy for this contract
    const energyResult = AvatarState.drainEnergy();
    const avatarMood = AvatarState.getMoodData();

    const container = document.getElementById('question-area');
    const progress = ((this.currentQuestionIndex + 1) / this.questions.length) * 100;

    // Get shift progress if active
    const shiftProgress = ShiftManager.isActive ? ShiftManager.getProgress() : null;
    const displayTotal = shiftProgress ? shiftProgress.total : this.questions.length;
    const displayCurrent = shiftProgress ? shiftProgress.completed + 1 : this.currentQuestionIndex + 1;
    const displayProgress = shiftProgress ? shiftProgress.progress : progress;

    container.innerHTML = `
      <!-- Unified Game Info Bar (Shift, Energy, Contract on one line) -->
      <div class="game-info-bar">
        <!-- Shift Info -->
        ${shiftProgress ? `
          <div class="game-info-bar__shift" style="--shift-color: ${shiftProgress.shift.color}">
            <span class="game-info-bar__icon">${shiftProgress.shift.icon}</span>
            <span class="game-info-bar__shift-name">${shiftProgress.shift.name}</span>
          </div>
        ` : ''}
        
        <!-- Energy Status -->
        <div class="game-info-bar__energy">
          <span class="game-info-bar__label">⚡</span>
          <div class="energy-bar energy-bar--${energyResult.level} energy-bar--compact">
            <div class="energy-bar__fill" style="width: ${AvatarState.getEnergyPercent()}%"></div>
          </div>
          <span class="game-info-bar__value">${AvatarState.energy}%</span>
        </div>
        
        <!-- Mood -->
        <div class="game-info-bar__mood ${avatarMood.mood !== 'neutral' ? 'game-info-bar__mood--active' : ''}">
          <span class="game-info-bar__emoji">${avatarMood.emoji}</span>
          <span class="game-info-bar__mood-text">${avatarMood.description}</span>
          ${avatarMood.streak > 0 ? `<span class="game-info-bar__streak">🔥${avatarMood.streak}</span>` : ''}
        </div>
        
        <!-- Contract Client (compact) -->
        ${contract ? `
          <div class="game-info-bar__client">
            <span class="game-info-bar__client-icon">${contract.client.icon}</span>
            <span class="game-info-bar__client-name">${contract.client.name}</span>
            ${contract.client.rush ? '<span class="contract-urgent-badge">RUSH</span>' : ''}
          </div>
          <div class="game-info-bar__pay">
            <span>💰 $${contract.pay}</span>
            <span>⭐ +${contract.xpReward} XP</span>
          </div>
        ` : ''}
      </div>
      
      <div class="question-header">
        <button class="back-btn" onclick="gameEngine.exitGame()">
          ← Back to Games
        </button>
        <div class="question-progress">
          <span>Contract ${displayCurrent} of ${displayTotal}</span>
          <div class="question-progress__bar">
            <div class="question-progress__fill" style="width: ${displayProgress}%"></div>
          </div>
        </div>
        <span class="teks-badge">${question.teks}</span>
      </div>
      
      <!-- Sims-style character thinking -->
      <div class="sims-thinking">
        <div class="avatar avatar--small ${window.ThemeManager.currentGender === 'female' ? 'avatar--female' : 'avatar--male'}"></div>
        <div class="thought-bubble thought-bubble--question">
          <span class="thought-icon">💭</span>
          ${contract ? `Contract from ${contract.client.name}...` : 'Hmm, let me think about this...'}
        </div>
      </div>
      
      <div class="question-card animate-fade-in">
        <p class="question-text">${question.question}</p>
        
        ${question.type === 'multiple-choice'
        ? this.renderOptions(question.options)
        : this.renderFillIn(question)}
        
        <div id="feedback-area"></div>
        
        <div class="game-nav">
          <div></div>
          <button id="next-btn" class="btn btn--primary hidden" onclick="gameEngine.nextQuestion()">
            ${this.currentQuestionIndex < this.questions.length - 1 ? 'Next Contract →' : 'See Results →'}
          </button>
        </div>
      </div>
    `;
  }

  // Render multiple choice options
  renderOptions(options) {
    const letters = ['A', 'B', 'C', 'D'];
    return `
      <div class="options-grid">
        ${options.map((option, i) => `
          <div class="option" data-value="${option}" onclick="gameEngine.handleOptionClick(this, '${option.replace(/'/g, "\\'")}')">
            <span class="option__letter">${letters[i]}</span>
            <span class="option__text">${option}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Render fill-in input
  renderFillIn(question) {
    return `
      <div class="fill-in-container">
        <input 
          type="text" 
          class="fill-in-input" 
          id="fill-in-answer"
          placeholder="Enter your answer..."
          onkeypress="if(event.key === 'Enter') gameEngine.handleFillInSubmit()"
        >
        <p class="fill-in-hint">${question.hint || 'Enter a numeric value'}</p>
        <button class="btn btn--primary" onclick="gameEngine.handleFillInSubmit()">
          Submit Answer
        </button>
      </div>
    `;
  }

  // Handle option click for MC
  handleOptionClick(element, value) {
    if (this.isAnswered) return;

    const result = this.submitAnswer(value);
    if (!result) return;

    // Update UI
    const options = document.querySelectorAll('.option');
    options.forEach(opt => {
      opt.classList.add('option--disabled');
      const optValue = opt.dataset.value;

      if (optValue === result.correctAnswer) {
        opt.classList.add('option--correct');
      } else if (opt === element && !result.isCorrect) {
        opt.classList.add('option--incorrect');
      }
    });

    this.showFeedback(result);
  }

  // Handle fill-in submit
  handleFillInSubmit() {
    if (this.isAnswered) return;

    const input = document.getElementById('fill-in-answer');
    const value = input.value.trim();

    if (!value) return;

    const result = this.submitAnswer(value);
    if (!result) return;

    input.classList.add(result.isCorrect ? 'fill-in-input--correct' : 'fill-in-input--incorrect');
    input.disabled = true;

    this.showFeedback(result);
  }

  // Create confetti effect for correct answers
  createConfetti() {
    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'confetti-container';

    const colors = ['#00E676', '#00D4FF', '#FF4081', '#FFAB40', '#AA00FF'];

    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = Math.random() * 0.5 + 's';
      confetti.style.animationDuration = (Math.random() * 1 + 1) + 's';
      confettiContainer.appendChild(confetti);
    }

    document.body.appendChild(confettiContainer);
    setTimeout(() => confettiContainer.remove(), 2500);
  }

  // Show feedback after answer - Sims style!
  showFeedback(result) {
    const feedbackArea = document.getElementById('feedback-area');
    const nextBtn = document.getElementById('next-btn');
    const thinkingBubble = document.querySelector('.thought-bubble--question');

    // Update thinking bubble to reaction
    if (thinkingBubble) {
      thinkingBubble.innerHTML = result.isCorrect
        ? '<span class="thought-icon">🎉</span> I knew it!'
        : '<span class="thought-icon">😅</span> Oops, let me learn from this!';
      thinkingBubble.classList.add(result.isCorrect ? 'thought-bubble--happy' : 'thought-bubble--sad');
    }

    // Show confetti for correct answers
    if (result.isCorrect) {
      this.createConfetti();
    }

    feedbackArea.innerHTML = `
      <div class="feedback feedback--${result.isCorrect ? 'correct' : 'incorrect'}">
        <!-- Combined header with result + message -->
        <div class="feedback__header-bar feedback__header-bar--${result.isCorrect ? 'success' : 'error'}">
          <span class="feedback__icon">${result.isCorrect ? '✅' : '❌'}</span>
          <span class="feedback__header-text">
            <strong>${result.isCorrect ? 'Correct!' : 'Not quite.'}</strong> ${result.simsMessage}
          </span>
        </div>
        
        <!-- Two-column card layout -->
        <div class="feedback__cards">
          <!-- Left card: Result -->
          <div class="feedback__card feedback__card--result feedback__card--${result.isCorrect ? 'profit' : 'loss'}">
            <div class="feedback__card-label">${result.isCorrect ? 'PROFIT' : 'LOSS'}</div>
            <div class="feedback__card-value">${result.contractResult ? `${result.contractResult.netProfit >= 0 ? '+' : ''}$${result.contractResult.netProfit}` : '$0'}</div>
            ${result.isCorrect && result.contractResult ? `
              <div class="feedback__card-extras">
                <span class="feedback__card-extra"><span class="label">Yield</span> ${result.contractResult.yieldPercent}%</span>
                <span class="feedback__card-extra"><span class="label">XP</span> +${result.contractResult.xpEarned}</span>
              </div>
            ` : ''}
          </div>
          
          <!-- Right card: Solution -->
          <div class="feedback__card feedback__card--solution">
            <div class="feedback__card-label">SOLUTION</div>
            <div class="feedback__card-explanation">${result.explanation}</div>
            ${!result.isCorrect ? `<div class="feedback__card-answer"><strong>Answer:</strong> ${result.correctAnswer}</div>` : ''}
          </div>
        </div>
      </div>
    `;

    nextBtn.classList.remove('hidden');

    // Cycle 6: Career Progression - Show level up modal if player leveled up
    if (result.contractResult && result.contractResult.leveledUp) {
      // Delay slightly to let feedback display first
      setTimeout(() => {
        showLevelUpModal(
          result.contractResult.newLevel - 1,
          result.contractResult.newLevel,
          result.contractResult.newTitle
        );

        // Cycle 8: Show specialization select at Level 10
        if (result.contractResult.newLevel >= 10 && !GameState.specialization) {
          // Show after level-up modal dismisses (5 seconds + buffer)
          setTimeout(() => {
            showSpecializationSelect(() => {
              console.log('🎓 Specialization selected:', GameState.specialization);
            });
          }, 5500);
        }
      }, 500);
    }
  }

  // Show end-of-game summary - Sims style level up!
  showSummary() {
    const timeSpent = Math.round((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(timeSpent / 60);
    const seconds = timeSpent % 60;
    const percentage = Math.round((this.score / this.questions.length) * 100);

    const container = document.getElementById('question-area');

    // Sims-style messages based on performance
    let message, messageClass, simsReaction, skillLevel;
    if (percentage >= 80) {
      message = "🏆 SKILL MAXED OUT!";
      messageClass = '';
      simsReaction = "Your Sim has mastered this skill!";
      skillLevel = "Expert";
      this.createConfetti();
    } else if (percentage >= 60) {
      message = "⬆️ Skill Level Increased!";
      messageClass = 'summary__message--needs-work';
      simsReaction = "Good progress! Keep practicing to reach mastery.";
      skillLevel = "Intermediate";
    } else {
      message = "📖 Time for more studying...";
      messageClass = 'summary__message--needs-work';
      simsReaction = "Your Sim should practice more to level up!";
      skillLevel = "Beginner";
    }

    container.innerHTML = `
      <div class="question-card question-card--balanced animate-fade-in">
        <div class="summary summary--balanced">
          <!-- Balanced header: plumbob + title on left, large score on right -->
          <div class="level-up-header--balanced">
            <div class="level-up-header__left">
              <div class="plumbob plumbob--large ${percentage >= 60 ? 'plumbob--happy' : 'plumbob--sad'}"></div>
              <div class="level-up-header__text">
                <h2 class="level-up-title--balanced">${message}</h2>
                <span class="level-up-subtitle">${simsReaction}</span>
              </div>
            </div>
            <div class="level-up-score">${percentage}%</div>
          </div>
          
          <!-- Skill bar full width -->
          <div class="skill-result--balanced">
            <span class="skill-result__label--balanced">🧪 Chemistry Skill: <strong>${skillLevel}</strong></span>
            <div class="skill-bar skill-bar--balanced">
              <div class="skill-bar__fill" style="width: ${percentage}%"></div>
            </div>
          </div>
          
          <!-- Stats + Buttons row -->
          <div class="summary__footer">
            <div class="summary__stats--balanced">
              <div class="summary__stat--balanced">
                <span class="stat-value" style="color: var(--success)">${this.score}</span>
                <span class="stat-label">✓ Correct</span>
              </div>
              <div class="summary__stat--balanced">
                <span class="stat-value" style="color: var(--error)">${this.questions.length - this.score}</span>
                <span class="stat-label">✗ Missed</span>
              </div>
              <div class="summary__stat--balanced">
                <span class="stat-value">${minutes}:${seconds.toString().padStart(2, '0')}</span>
                <span class="stat-label">⏱️ Time</span>
              </div>
            </div>
            <div class="summary__buttons">
              <button class="btn btn--secondary" onclick="gameEngine.exitGame()">🏠 Back to Hub</button>
              <button class="btn btn--primary" onclick="gameEngine.restartGame()">🔄 Practice Again</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Exit current game
  exitGame() {
    const gameContainer = document.getElementById('game-container');
    const hubContainer = document.getElementById('hub-container');

    gameContainer.classList.add('hidden');
    hubContainer.classList.remove('hidden');

    this.currentGame = null;
  }

  // Restart current game
  restartGame() {
    if (this.currentGame) {
      const gameModule = window.gameModules[this.currentGame];
      if (gameModule) {
        gameModule.start();
      }
    }
  }
}

// Create global instance
window.gameEngine = new GameEngine();
window.gameModules = {};

export default window.gameEngine;
