/**
 * MoleTycoon Theme Manager
 * Handles theme switching and persistence
 */

const ThemeManager = {
    // Available themes - Color themes + Sims Era themes + Art Style themes
    themes: [
        // Color themes
        { id: 'default', name: 'Sims Classic', icon: '💚', category: 'color' },
        { id: 'dark-lab', name: 'Dark Lab', icon: '🔬', category: 'color' },
        { id: 'ocean', name: 'Ocean Deep', icon: '🌊', category: 'color' },
        { id: 'sunset', name: 'Sunset', icon: '🌅', category: 'color' },
        { id: 'forest', name: 'Forest', icon: '🌲', category: 'color' },
        // Sims Era themes
        { id: 'sims1', name: 'Sims 1 Retro', icon: '👾', category: 'era' },
        { id: 'sims2', name: 'Sims 2 Glossy', icon: '✨', category: 'era' },
        // Art Style themes
        { id: 'flat-modern', name: 'Flat Modern', icon: '🧪', category: 'art' },
        { id: 'pixel-art', name: 'Pixel Art', icon: '🕹️', category: 'art' },
        { id: 'sims-cartoon', name: 'Sims Cartoon', icon: '🎮', category: 'art' },
        { id: 'dark-neon', name: 'Dark Neon', icon: '💜', category: 'art' }
    ],

    // Current theme
    currentTheme: 'default',
    currentGender: 'male',

    /**
     * Initialize theme manager
     */
    init() {
        // Load saved theme from localStorage
        const savedTheme = localStorage.getItem('moleville-theme');
        if (savedTheme && this.themes.find(t => t.id === savedTheme)) {
            this.currentTheme = savedTheme;
        }

        // Load saved gender
        const savedGender = localStorage.getItem('moleville-gender');
        if (savedGender) {
            this.currentGender = savedGender;
        }

        // Apply theme and gender
        this.applyTheme(this.currentTheme);
        this.applyGender(this.currentGender);

        console.log(`🎨 Theme Manager initialized with theme: ${this.currentTheme}, gender: ${this.currentGender}`);
    },

    /**
     * Apply gender to the document
     * @param {string} gender - 'male' or 'female'
     */
    applyGender(gender) {
        document.documentElement.setAttribute('data-gender', gender);
        this.currentGender = gender;
        localStorage.setItem('moleville-gender', gender);

        // Update selected state in UI (side-by-side avatars)
        document.querySelectorAll('.character-card').forEach(opt => {
            // Find the avatar element inside to get data-gender or check the card's onclick/title
            // Simplest way: check if the card contains the specific click handler or infer from context
            // Actually, best to add data-gender to the character-card in HTML first.
            // But since I didn't add data-gender in HTML replacement above, 
            // I'll check if the innerHTML or class contains 'male'/'female'.
            // Better: update HTML to include data-gender, but for now assuming order or content.

            // Let's assume the HTML update included data-gender on the card or I can infer it.
            // Re-reading HTML replacement... I missed adding data-gender to the wrapper .character-card.
            // I will update the HTML to include data-gender in the next step or rely on checking child .avatar classes.

            const isMale = opt.querySelector('.avatar--male');
            const targetGender = isMale ? 'male' : 'female';

            if (targetGender === gender) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });
    },

    /**
     * Toggle between male and female
     */
    toggleGender() {
        const newGender = this.currentGender === 'male' ? 'female' : 'male';
        this.applyGender(newGender);
    },

    /**
     * Apply a theme to the document
     * @param {string} themeId - The theme ID to apply
     */
    applyTheme(themeId) {
        const html = document.documentElement;

        if (themeId === 'default') {
            // Remove data-theme attribute for default theme
            html.removeAttribute('data-theme');
        } else {
            // Set data-theme attribute
            html.setAttribute('data-theme', themeId);
        }

        this.currentTheme = themeId;

        // Save to localStorage
        localStorage.setItem('moleville-theme', themeId);

        // Trigger custom event for any listeners
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: themeId } }));
    },

    /**
     * Get the current theme ID
     * @returns {string} Current theme ID
     */
    getCurrentTheme() {
        return this.currentTheme;
    },

    /**
     * Render the theme selector HTML
     * @returns {string} HTML string for the theme selector
     */
    renderSelector() {
        const themeOptions = this.themes.map(theme => `
      <button 
        class="theme-option theme-option--${theme.id} ${theme.id === this.currentTheme ? 'active' : ''}"
        data-theme="${theme.id}"
        data-name="${theme.name}"
        title="${theme.name}"
        onclick="window.ThemeManager.selectTheme('${theme.id}')"
      ></button>
    `).join('');

        return `
      <div class="theme-selector">
        <span class="theme-selector__label">🎨 Theme:</span>
        <div class="theme-selector__options">
          ${themeOptions}
        </div>
      </div>
    `;
    },

    /**
     * Handle theme selection
     * @param {string} themeId - The theme ID to switch to
     */
    selectTheme(themeId) {
        this.applyTheme(themeId);

        // Update active state on buttons
        document.querySelectorAll('.theme-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === themeId);
        });

        // Add a little celebration animation
        this.showThemeChangeAnimation(themeId);
    },

    /**
     * Show a brief animation when theme changes
     * @param {string} themeId - The new theme ID
     */
    showThemeChangeAnimation(themeId) {
        const theme = this.themes.find(t => t.id === themeId);
        if (!theme) return;

        // Create a toast notification
        const toast = document.createElement('div');
        toast.className = 'theme-toast';
        toast.innerHTML = `${theme.icon} Theme: ${theme.name}`;
        toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(-100px);
      background: var(--card-bg);
      padding: 12px 24px;
      border-radius: 30px;
      box-shadow: var(--card-shadow);
      font-weight: 700;
      font-size: 14px;
      color: var(--text);
      z-index: 10000;
      transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      border: 2px solid var(--plumbob-green);
    `;

        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });

        // Remove after delay
        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(-100px)';
            setTimeout(() => toast.remove(), 400);
        }, 1500);
    }
};

// Make globally available
window.ThemeManager = ThemeManager;

// Export for module usage
export default ThemeManager;
