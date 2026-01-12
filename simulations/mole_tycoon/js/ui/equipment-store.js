/**
 * Equipment Store Modal
 * UI for browsing and purchasing equipment.
 * 
 * Cycle 9: Equipment Upgrades
 */

import { getAllEquipment, getEquipment } from '../data/equipment-catalog.js';
import GameState from '../core/game-state.js';

/**
 * Render an equipment card
 * @param {object} equip - Equipment data
 * @returns {string} HTML string
 */
function renderEquipmentCard(equip) {
    const owned = GameState.hasEquipment(equip.id);
    const canAfford = GameState.canAfford(equip.cost);

    return `
        <div class="equip-card ${owned ? 'equip-card--owned' : ''} ${!canAfford && !owned ? 'equip-card--expensive' : ''}" 
             data-equip-id="${equip.id}">
            <div class="equip-card__tier">Tier ${equip.tier}</div>
            <div class="equip-card__icon">${equip.icon}</div>
            <h3 class="equip-card__name">${equip.name}</h3>
            <p class="equip-card__description">${equip.description}</p>
            <div class="equip-card__footer">
                ${owned ? `
                    <span class="equip-card__owned-badge">✓ Owned</span>
                ` : `
                    <span class="equip-card__price ${canAfford ? '' : 'equip-card__price--expensive'}">
                        💰 $${equip.cost.toLocaleString()}
                    </span>
                    <button class="btn btn--primary equip-card__buy" 
                            ${canAfford ? '' : 'disabled'}
                            data-equip-id="${equip.id}">
                        ${canAfford ? 'Buy' : 'Can\'t Afford'}
                    </button>
                `}
            </div>
        </div>
    `;
}

/**
 * Show the equipment store modal
 * @param {function} onPurchase - Callback when purchase is made
 */
function showEquipmentStore(onPurchase) {
    const equipment = getAllEquipment();

    // Remove any existing modal
    const existing = document.querySelector('.store-overlay');
    if (existing) existing.remove();

    const modalHTML = `
        <div class="store-overlay">
            <div class="store-modal">
                <div class="store-header">
                    <h2 class="store-header__title">🛒 Equipment Store</h2>
                    <div class="store-header__balance">
                        <span class="store-header__icon">💰</span>
                        <span class="store-header__cash">$${GameState.cash.toLocaleString()}</span>
                    </div>
                    <button class="store-header__close" id="store-close-btn">✕</button>
                </div>
                
                <div class="store-content">
                    <p class="store-subtitle">Purchase equipment to help with calculations!</p>
                    
                    <div class="equip-grid">
                        ${equipment.map(e => renderEquipmentCard(e)).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Handle close button
    document.getElementById('store-close-btn').addEventListener('click', () => {
        closeStore();
    });

    // Handle overlay click to close
    document.querySelector('.store-overlay').addEventListener('click', (e) => {
        if (e.target.classList.contains('store-overlay')) {
            closeStore();
        }
    });

    // Handle buy buttons
    document.querySelectorAll('.equip-card__buy').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const equipId = btn.dataset.equipId;
            const equip = getEquipment(equipId);

            if (equip && GameState.buyEquipment(equipId, equip.cost)) {
                // Show purchase confirmation
                showPurchaseConfirmation(equip);

                // Refresh the store view
                refreshStoreDisplay();

                if (onPurchase) onPurchase(equip);
            }
        });
    });
}

/**
 * Close the store modal
 */
function closeStore() {
    const overlay = document.querySelector('.store-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    }
}

/**
 * Refresh the store display after purchase
 */
function refreshStoreDisplay() {
    const grid = document.querySelector('.equip-grid');
    const cashDisplay = document.querySelector('.store-header__cash');

    if (grid) {
        grid.innerHTML = getAllEquipment().map(e => renderEquipmentCard(e)).join('');

        // Re-attach buy button handlers
        document.querySelectorAll('.equip-card__buy').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const equipId = btn.dataset.equipId;
                const equip = getEquipment(equipId);

                if (equip && GameState.buyEquipment(equipId, equip.cost)) {
                    showPurchaseConfirmation(equip);
                    refreshStoreDisplay();
                }
            });
        });
    }

    if (cashDisplay) {
        cashDisplay.textContent = `$${GameState.cash.toLocaleString()}`;
    }
}

/**
 * Show purchase confirmation toast
 * @param {object} equip - Purchased equipment
 */
function showPurchaseConfirmation(equip) {
    const toast = document.createElement('div');
    toast.className = 'purchase-toast';
    toast.innerHTML = `
        <span class="purchase-toast__icon">${equip.icon}</span>
        <span class="purchase-toast__text">${equip.name} purchased!</span>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('purchase-toast--fade');
        setTimeout(() => toast.remove(), 500);
    }, 2000);
}

// Make globally available
window.showEquipmentStore = showEquipmentStore;

export { showEquipmentStore };
