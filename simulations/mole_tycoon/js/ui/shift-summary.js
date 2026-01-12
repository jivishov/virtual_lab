/**
 * MoleTycoon Shift Summary UI
 * Displays paystub modal at end of shift.
 * 
 * Cycle 3: Shift System
 */

/**
 * Render the shift summary modal (paystub)
 * @param {object} paystub - Paystub data from ShiftManager.endShift()
 * @param {function} onClose - Callback when modal is closed
 */
function renderShiftSummary(paystub, onClose) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay shift-summary-overlay';
    overlay.innerHTML = `
        <div class="paystub animate-fade-in">
            <div class="paystub__header" style="border-color: ${paystub.shift.color}">
                <div class="paystub__title">
                    <span class="paystub__icon">${paystub.shift.icon}</span>
                    <div>
                        <h2>SHIFT PAYSTUB</h2>
                        <span class="paystub__shift-info">${paystub.shift.name} • ${paystub.date}</span>
                    </div>
                </div>
            </div>
            
            <div class="paystub__body">
                <!-- Earnings Section -->
                <div class="paystub__section">
                    <h3 class="paystub__section-title">💰 Earnings</h3>
                    
                    <div class="paystub__row">
                        <span class="paystub__label">Gross Earnings</span>
                        <span class="paystub__value">${formatCurrency(paystub.grossEarnings)}</span>
                    </div>
                    
                    ${paystub.shiftBonus > 0 ? `
                    <div class="paystub__row paystub__row--bonus">
                        <span class="paystub__label">${paystub.bonusType}</span>
                        <span class="paystub__value paystub__value--positive">+${formatCurrency(paystub.shiftBonus)}</span>
                    </div>
                    ` : ''}
                    
                    <div class="paystub__row paystub__row--total">
                        <span class="paystub__label">Total Earned</span>
                        <span class="paystub__value paystub__value--large">${formatCurrency(paystub.totalEarnings)}</span>
                    </div>
                </div>
                
                <!-- XP Section -->
                <div class="paystub__section">
                    <h3 class="paystub__section-title">⭐ Experience</h3>
                    
                    <div class="paystub__row">
                        <span class="paystub__label">Base XP</span>
                        <span class="paystub__value">+${paystub.baseXP}</span>
                    </div>
                    
                    ${paystub.bonusXP > 0 ? `
                    <div class="paystub__row paystub__row--bonus">
                        <span class="paystub__label">Shift Bonus XP</span>
                        <span class="paystub__value paystub__value--positive">+${paystub.bonusXP}</span>
                    </div>
                    ` : ''}
                    
                    <div class="paystub__row paystub__row--total">
                        <span class="paystub__label">Total XP</span>
                        <span class="paystub__value paystub__value--large">+${paystub.totalXP}</span>
                    </div>
                </div>
                
                <!-- Performance Section -->
                <div class="paystub__section paystub__section--stats">
                    <div class="paystub__stat">
                        <span class="paystub__stat-value">${paystub.successfulContracts}/${paystub.contractsTotal}</span>
                        <span class="paystub__stat-label">Contracts Completed</span>
                    </div>
                    <div class="paystub__stat">
                        <span class="paystub__stat-value">${paystub.avgYield}%</span>
                        <span class="paystub__stat-label">Avg Yield</span>
                    </div>
                    <div class="paystub__stat">
                        <span class="paystub__stat-value">${formatDuration(paystub.duration)}</span>
                        <span class="paystub__stat-label">Time Worked</span>
                    </div>
                </div>
                
                <!-- Current Status -->
                <div class="paystub__footer">
                    <div class="paystub__status">
                        <span>Current Balance: <strong>${formatCurrency(paystub.currentCash)}</strong></span>
                        <span>Level ${paystub.currentLevel}: <strong>${paystub.currentTitle}</strong></span>
                    </div>
                </div>
            </div>
            
            <div class="paystub__actions">
                <button class="btn btn--primary btn--large" id="paystub-close-btn">
                    🏠 Return to Hub
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Handle close
    const closeBtn = overlay.querySelector('#paystub-close-btn');
    closeBtn.addEventListener('click', () => {
        overlay.classList.add('modal-overlay--closing');
        setTimeout(() => {
            overlay.remove();
            if (onClose) onClose();
        }, 300);
    });

    // Allow clicking outside to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeBtn.click();
        }
    });
}

/**
 * Render shift selector UI for the hub
 * @param {function} onSelectShift - Callback when shift is selected
 */
function renderShiftSelector(onSelectShift) {
    const shifts = window.ShiftManager ? window.ShiftManager.getShiftTypes() : [];

    return `
        <div class="shift-selector">
            <h3 class="shift-selector__title">🕐 Start Your Shift</h3>
            <p class="shift-selector__subtitle">Choose a shift to begin your work session</p>
            
            <div class="shift-selector__options">
                ${shifts.map(shift => `
                    <div class="shift-card" 
                         style="--shift-color: ${shift.color}"
                         onclick="window.startShift('${shift.id}')">
                        <div class="shift-card__icon">${shift.icon}</div>
                        <div class="shift-card__info">
                            <h4 class="shift-card__name">${shift.name}</h4>
                            <span class="shift-card__hours">${shift.hours}</span>
                            <p class="shift-card__description">${shift.description}</p>
                        </div>
                        <div class="shift-card__meta">
                            <span class="shift-card__contracts">${shift.contractCount} contracts</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Render active shift banner (shown during gameplay)
 * @param {object} progress - Progress data from ShiftManager.getProgress()
 */
function renderShiftBanner(progress) {
    if (!progress) return '';

    return `
        <div class="shift-banner" style="--shift-color: ${progress.shift.color}">
            <div class="shift-banner__info">
                <span class="shift-banner__icon">${progress.shift.icon}</span>
                <span class="shift-banner__name">${progress.shift.name}</span>
            </div>
            <div class="shift-banner__progress">
                <span>Contract ${progress.completed + 1} of ${progress.total}</span>
                <div class="shift-banner__bar">
                    <div class="shift-banner__fill" style="width: ${progress.progress}%"></div>
                </div>
            </div>
            <div class="shift-banner__earnings">
                <span>💰 ${formatCurrency(progress.earnings)}</span>
                <span>⭐ +${progress.xp}</span>
            </div>
        </div>
    `;
}

/**
 * Format currency for display
 */
function formatCurrency(amount) {
    const sign = amount >= 0 ? '' : '-';
    return `${sign}$${Math.abs(amount).toLocaleString()}`;
}

/**
 * Format duration in seconds to MM:SS
 */
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Export functions
export { renderShiftSummary, renderShiftSelector, renderShiftBanner };
