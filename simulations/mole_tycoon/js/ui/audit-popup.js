/**
 * MoleTycoon Audit Popup UI
 * Displays safety inspection questions during gameplay.
 * 
 * Cycle 5: Safety Inspector
 */

import SafetyInspector from '../core/safety-inspector.js';
import GameState from '../core/game-state.js';

/**
 * Show the audit popup modal
 * @param {object} auditData - Audit data from SafetyInspector.startAudit()
 * @param {function} onComplete - Callback when audit is completed
 */
function showAuditPopup(auditData, onComplete) {
  const { question } = auditData;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'audit-overlay';
  overlay.innerHTML = `
    <div class="audit-modal animate-scale-in">
      <div class="audit-header">
        <span class="audit-icon">👷</span>
        <h2 class="audit-title">Safety Inspection!</h2>
        <p class="audit-subtitle">An inspector has arrived to check your lab safety knowledge.</p>
      </div>
      
      <div class="audit-body">
        <div class="audit-category-badge">${question.category}</div>
        <p class="audit-question">${question.question}</p>
        
        <div class="audit-options">
          ${question.options.map((option, index) => `
            <button class="audit-option" data-index="${index}">
              <span class="audit-option__letter">${String.fromCharCode(65 + index)}</span>
              <span class="audit-option__text">${option}</span>
            </button>
          `).join('')}
        </div>
      </div>
      
      <div class="audit-footer">
        <p class="audit-stakes">
          <span class="audit-stakes__pass">✅ Pass: +$${SafetyInspector.bonusAmount}</span>
          <span class="audit-stakes__fail">❌ Fail: -$${SafetyInspector.fineAmount}</span>
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Add click handlers to options
  const options = overlay.querySelectorAll('.audit-option');
  options.forEach(option => {
    option.addEventListener('click', () => {
      const selectedIndex = parseInt(option.dataset.index);
      handleAuditAnswer(overlay, selectedIndex, onComplete);
    });
  });
}

/**
 * Handle audit answer selection
 */
function handleAuditAnswer(overlay, selectedIndex, onComplete) {
  const result = SafetyInspector.processAuditResult(selectedIndex);
  if (!result) return;

  // Apply consequence to GameState
  if (result.passed) {
    GameState.addCash(result.consequence);
  } else {
    GameState.addCash(result.consequence); // Will subtract (negative number)
  }

  // Update modal to show result
  const modal = overlay.querySelector('.audit-modal');
  const options = overlay.querySelectorAll('.audit-option');

  // Highlight correct and selected answers
  options.forEach((option, index) => {
    option.disabled = true;
    if (index === result.correctIndex) {
      option.classList.add('audit-option--correct');
    }
    if (index === selectedIndex && !result.passed) {
      option.classList.add('audit-option--incorrect');
    }
  });

  // Show result panel
  const body = overlay.querySelector('.audit-body');
  const resultHtml = `
    <div class="audit-result ${result.passed ? 'audit-result--pass' : 'audit-result--fail'}">
      <span class="audit-result__icon">${result.passed ? '✅' : '❌'}</span>
      <span class="audit-result__text">${result.passed ? 'Inspection Passed!' : 'Inspection Failed!'}</span>
      <span class="audit-result__amount ${result.passed ? 'text-success' : 'text-error'}">
        ${result.consequence >= 0 ? '+' : ''}$${result.consequence}
      </span>
    </div>
    <p class="audit-explanation">${result.explanation}</p>
  `;
  body.insertAdjacentHTML('beforeend', resultHtml);

  // Update footer with continue button
  const footer = overlay.querySelector('.audit-footer');
  footer.innerHTML = `
    <button class="btn btn--primary audit-continue">Continue Work →</button>
  `;

  // Handle continue
  footer.querySelector('.audit-continue').addEventListener('click', () => {
    overlay.classList.add('audit-overlay--closing');
    setTimeout(() => {
      overlay.remove();
      if (onComplete) onComplete(result);
    }, 300);
  });
}

/**
 * Render audit summary for paystub
 */
function renderAuditSummary() {
  const summary = SafetyInspector.getShiftSummary();

  if (summary.total === 0) {
    return '<p class="audit-summary__none">No safety inspections this shift.</p>';
  }

  return `
    <div class="audit-summary">
      <div class="audit-summary__stats">
        <div class="audit-summary__stat">
          <span class="audit-summary__value">${summary.total}</span>
          <span class="audit-summary__label">Inspections</span>
        </div>
        <div class="audit-summary__stat audit-summary__stat--pass">
          <span class="audit-summary__value">${summary.passed}</span>
          <span class="audit-summary__label">Passed</span>
        </div>
        <div class="audit-summary__stat audit-summary__stat--fail">
          <span class="audit-summary__value">${summary.failed}</span>
          <span class="audit-summary__label">Failed</span>
        </div>
      </div>
      <div class="audit-summary__total ${summary.totalConsequence >= 0 ? 'text-success' : 'text-error'}">
        Safety Impact: ${summary.totalConsequence >= 0 ? '+' : ''}$${summary.totalConsequence}
      </div>
    </div>
  `;
}

// Export functions
export { showAuditPopup, renderAuditSummary };
