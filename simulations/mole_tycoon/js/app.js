/**
 * MoleTycoon Main Application Controller
 * Initializes the game hub and handles navigation
 */

// Import core FIRST - initializes window.gameModules
import './core/game-engine.js';
import ThemeManager from './core/theme-manager.js';
import GameState from './core/game-state.js';
import ShiftManager from './core/shift-manager.js';
import AvatarState from './core/avatar-state.js';
import SafetyInspector from './core/safety-inspector.js';
import ReviewTracker from './core/review-tracker.js';
import LabTier from './core/lab-tier.js';
import { renderShiftSelector, renderShiftSummary } from './ui/shift-summary.js';
import { renderCareerBadge } from './ui/career-badge.js';
import { showEquipmentStore } from './ui/equipment-store.js';

// Import game modules - they register themselves to window.gameModules
import './games/mole-converter.js';
import './games/formula-detective.js';
import './games/stoichiometry-kitchen.js';
import './games/limiting-reactant.js';
import './games/percent-composition.js';

/**
 * Start a shift and begin gameplay with the first available game
 */
function startShift(shiftType) {
  const result = ShiftManager.startShift(shiftType);
  if (!result) return;

  // Reset avatar state for fresh shift
  AvatarState.resetForShift();

  // Reset safety inspector for fresh shift
  SafetyInspector.resetForShift();

  console.log(`🕐 Starting ${result.shift.name} with ${result.contractsTotal} contracts`);

  // Find first available game and start it
  const games = Object.values(window.gameModules);
  if (games.length > 0) {
    // Start the first game with the shift's contract count
    const game = games[0];
    game.start(result.contractsTotal);
  }
}

// Make startShift globally available
window.startShift = startShift;

/**
 * Initialize the application
 */
function init() {
  // Initialize theme manager first
  ThemeManager.init();

  // Initialize game state (Lab Tycoon economy)
  GameState.init();

  // Initialize avatar state (Living Avatar)
  AvatarState.init();

  // Initialize review tracker (Investor Review)
  ReviewTracker.init();

  renderHub();
  console.log('🧪 MoleTycoon initialized!');
}

/**
 * Render the game hub with all mini-game cards
 */
function renderHub() {
  // Cycle 10: Apply tier-based theme
  LabTier.applyTierTheme();

  const hubContainer = document.getElementById('hub-container');
  const games = Object.values(window.gameModules);

  const gamesHTML = games.map(game => `
    <div class="card game-card" style="--game-color: ${game.color}" onclick="window.gameModules['${game.id}'].start()">
      <div class="game-card__icon">${game.icon}</div>
      <h3 class="game-card__title">${game.name}</h3>
      <p class="game-card__description">${game.description}</p>
      <div class="game-card__meta">
        <span class="teks-badge">${game.teks}</span>
        <span>${game.questionCount} questions</span>
      </div>
    </div>
  `).join('');

  hubContainer.innerHTML = `
    <header class="header">
        <div class="header__logo">
          <img src="assets/images/logo.png" alt="MoleTycoon Logo" class="header__logo-img">
        </div>
        <div class="header__content">
          <div class="header__actions">
            <button class="btn btn--secondary" onclick="window.openEquipmentStore()">🛒 Store</button>
            ${ThemeManager.renderSelector()}
          </div>
          <p class="header__subtitle">Build your chemistry empire, one mole at a time.</p>
        </div>
    </header>
    
    <main class="container">
      <!-- Redesigned Profile Dashboard -->
      <div class="avatar-section profile-dashboard">
        
        <div class="profile-header-area">
          <h3 class="profile-title">Your Career</h3>
          <div class="profile-cards-row">
            ${renderCareerBadge(GameState)}
            ${LabTier.renderTierBadge()}
          </div>
        </div>

        <div class="profile-grid">
            <!-- Left Column: Avatar Selection -->
            <div class="avatar-selection-column">
                <div class="character-card ${ThemeManager.currentGender === 'male' ? 'selected' : ''}" 
                     onclick="window.ThemeManager.applyGender('male')"
                     title="Select Male Character">
                    <div class="avatar avatar--male"></div>
                    <span class="character-label">Male Scientist</span>
                    <div class="selection-indicator"></div>
                </div>
                
                <div class="character-card ${ThemeManager.currentGender === 'female' ? 'selected' : ''}" 
                     onclick="window.ThemeManager.applyGender('female')"
                     title="Select Female Character">
                    <div class="avatar avatar--female"></div>
                    <span class="character-label">Female Scientist</span>
                    <div class="selection-indicator"></div>
                </div>
            </div>

            <!-- Right Column: Quick Stats -->
            <div class="stats-column">
                <div class="stats-panel stats-panel--compact">
                    <!-- Cash Balance - Primary Focus -->
                    <div class="stat-row stat-row--primary">
                        <span class="stat-icon">💰</span>
                        <span class="stat-value cash-display">$${GameState.cash.toLocaleString()}</span>
                    </div>
                    
                    <!-- Status Bars Row -->
                    <div class="stat-bars-row">
                        <!-- Energy -->
                        <div class="stat-bar-item">
                            <div class="stat-bar-header">
                                <span>⚡ Energy</span>
                                <span class="stat-bar-value">${AvatarState.getEnergyPercent()}%</span>
                            </div>
                            <div class="energy-bar energy-bar--${AvatarState.getEnergyLevel()} energy-bar--slim">
                                <div class="energy-bar__fill" style="width: ${AvatarState.getEnergyPercent()}%"></div>
                            </div>
                        </div>
                        
                        <!-- Mood -->
                        <div class="stat-bar-item">
                            <div class="stat-bar-header">
                                <span>${AvatarState.getMoodData().emoji} ${AvatarState.getMoodData().name}</span>
                                ${AvatarState.streak > 0 ? `<span class="streak-badge">🔥${AvatarState.streak}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <!-- XP Progress -->
                    <div class="stat-xp-row">
                        <div class="stat-xp-header">
                            <span>⭐ ${GameState.xp} XP</span>
                            <span class="stat-xp-next">Next: ${GameState.getXPToNextLevel()}</span>
                        </div>
                        <div class="skill-bar skill-bar--slim">
                            <div class="skill-bar__fill" style="width: ${GameState.getXPProgress()}%"></div>
                        </div>
                    </div>
                </div>

                <!-- Status Panel Removed -->
            </div>
        </div>
      </div>
      
      <!-- Shift Selector -->
      ${renderShiftSelector()}
      
      <h2 style="text-align: center; margin-bottom: var(--spacing-md); color: var(--text);">
        🎮 Or Practice Without a Shift
      </h2>
      
      <div class="games-grid">
        ${gamesHTML}
      </div>
      
      <div class="text-center" style="margin-top: var(--spacing-xl);">
        <p class="text-muted">
        </p>
      </div>
    </main>
  `;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Make renderHub globally available for refresh after shifts
window.renderHub = renderHub;

// Make equipment store globally available
window.openEquipmentStore = function () {
  showEquipmentStore(() => {
    renderHub(); // Refresh hub after purchase
  });
};

export { renderHub };
