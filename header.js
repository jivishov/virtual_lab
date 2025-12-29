// ===== REUSABLE HEADER COMPONENT =====
// This file provides a consistent header across all pages
// Simply include this script in any HTML page to get the header

// SVG Flag Icons
const flagIcons = {
    en: `<svg viewBox="0 0 60 30" class="flag-icon">
        <rect width="60" height="30" fill="#B22234"/>
        <path d="M0,3.46h60M0,6.92h60M0,10.38h60M0,13.84h60M0,17.3h60M0,20.76h60M0,24.23h60M0,27.69h60" stroke="#fff" stroke-width="2.31"/>
        <rect width="24" height="12.86" fill="#3C3B6E"/>
        <g fill="#fff">
            <g id="s">
                <g id="star">
                    <path d="M3,1.5 l0.588,1.81h1.902l-1.539,1.118 0.588,1.81-1.539-1.118-1.539,1.118 0.588-1.81-1.539-1.118h1.902z"/>
                </g>
                <use href="#star" x="6"/>
                <use href="#star" x="12"/>
                <use href="#star" x="18"/>
            </g>
            <use href="#s" y="4.62"/>
            <use href="#s" x="3" y="2.31"/>
        </g>
    </svg>`,
    az: `<svg viewBox="0 0 60 30" class="flag-icon">
        <rect width="60" height="30" fill="#00B5E2"/>
        <rect width="60" height="20" y="10" fill="#EF3340"/>
        <rect width="60" height="10" y="20" fill="#00A86B"/>
        <circle cx="27" cy="15" r="6" fill="#fff"/>
        <circle cx="28.5" cy="15" r="5" fill="#EF3340"/>
        <path d="M32,12 L33.5,13.5 L35.5,12.5 L34.5,14.5 L36,16 L34,15.5 L33,17.5 L32.5,15.5 L30.5,16 L31.5,14.5 Z" fill="#fff"/>
    </svg>`,
    tr: `<svg viewBox="0 0 60 30" class="flag-icon">
        <rect width="60" height="30" fill="#E30A17"/>
        <circle cx="22" cy="15" r="7" fill="#fff"/>
        <circle cx="24" cy="15" r="5.5" fill="#E30A17"/>
        <path d="M32,10 L33.5,14 L37.5,14 L34,16.5 L35.5,20.5 L32,18 L28.5,20.5 L30,16.5 L26.5,14 L30.5,14 Z" fill="#fff"/>
    </svg>`,
    de: `<svg viewBox="0 0 60 30" class="flag-icon">
        <rect width="60" height="10" fill="#000"/>
        <rect width="60" height="10" y="10" fill="#D00"/>
        <rect width="60" height="10" y="20" fill="#FFCE00"/>
    </svg>`
};

function renderHeader(currentPage = 'home') {
    // Get current language if I18n is loaded
    const currentLang = (typeof I18n !== 'undefined') ? I18n.getCurrentLanguage() : 'en';
    const t = (key) => (typeof I18n !== 'undefined') ? I18n.translate(key) : key;

    const headerHTML = `
        <div class="container">
            <div class="header-content">
                <div class="header-left">
                    <a href="https://virtuallab.az" class="header-brand" title="Virtual Laboratory">
                        <div class="header-icon">
                            <svg viewBox="0 0 640 512" fill="currentColor">
                                <path d="M175 389.4c-9.8 16-15 34.3-15 53.1c-10 3.5-20.8 5.5-32 5.5c-53 0-96-43-96-96V64C14.3 64 0 49.7 0 32S14.3 0 32 0H96h64 64c17.7 0 32 14.3 32 32s-14.3 32-32 32V309.9l-49 79.6zM96 64v96h64V64H96zM352 0H480h32c17.7 0 32 14.3 32 32s-14.3 32-32 32V214.9L629.7 406.2c6.7 10.9 10.3 23.5 10.3 36.4c0 38.3-31.1 69.4-69.4 69.4H261.4c-38.3 0-69.4-31.1-69.4-69.4c0-12.8 3.6-25.4 10.3-36.4L320 214.9V64c-17.7 0-32-14.3-32-32s14.3-32 32-32h32zm32 64V224c0 5.9-1.6 11.7-4.7 16.8L330.5 320h171l-48.8-79.2c-3.1-5.1-4.7-10.8-4.7-16.8V64H384z"/>
                            </svg>
                        </div>
                        <div class="header-text">
                            <h1 class="main-title" data-i18n="header.title">Virtual Laboratory</h1>
                            <p class="subtitle" data-i18n="header.subtitle">Interactive science experiments and simulations for hands-on learning</p>
                        </div>
                    </a>
                </div>
                <div class="header-right">
                    <div class="language-selector">
                        <button class="language-selector-button" id="languageButton" aria-label="Select language">
                            ${flagIcons[currentLang]}
                            <span class="language-code">${currentLang.toUpperCase()}</span>
                            <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                                <path d="M2 4 L6 8 L10 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
                            </svg>
                        </button>
                        <div class="language-dropdown" id="languageDropdown">
                            <button class="language-option ${currentLang === 'en' ? 'active' : ''}" data-lang="en">
                                ${flagIcons.en}
                                <span>English</span>
                            </button>
                            <button class="language-option ${currentLang === 'az' ? 'active' : ''}" data-lang="az">
                                ${flagIcons.az}
                                <span>Azərbaycan</span>
                            </button>
                            <button class="language-option ${currentLang === 'tr' ? 'active' : ''}" data-lang="tr">
                                ${flagIcons.tr}
                                <span>Türkçe</span>
                            </button>
                            <button class="language-option ${currentLang === 'de' ? 'active' : ''}" data-lang="de">
                                ${flagIcons.de}
                                <span>Deutsch</span>
                            </button>
                        </div>
                    </div>
                    <nav class="header-nav">
                        <a href="index.html" class="header-nav-link ${currentPage === 'home' ? 'active' : ''}" data-i18n="header.nav.home">Home</a>
                        <a href="about.html" class="header-nav-link ${currentPage === 'about' ? 'active' : ''}" data-i18n="header.nav.about">About</a>
                    </nav>
                    <div class="header-stats">
                        <div class="header-stat">
                            <span class="header-stat-number">3</span>
                            <span class="header-stat-label" data-i18n="header.stats.labs">Labs</span>
                        </div>
                        <div class="header-stat">
                            <span class="header-stat-number">1</span>
                            <span class="header-stat-label" data-i18n="header.stats.simulations">Simulations</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const headerElement = document.querySelector('.header');
    if (headerElement) {
        headerElement.innerHTML = headerHTML;
        initializeLanguageSelector();
    }
}

function initializeLanguageSelector() {
    const button = document.getElementById('languageButton');
    const dropdown = document.getElementById('languageDropdown');
    const options = document.querySelectorAll('.language-option');

    if (!button || !dropdown) return;

    // Toggle dropdown
    button.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.language-selector')) {
            dropdown.classList.remove('active');
        }
    });

    // Handle language selection
    options.forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            const lang = this.getAttribute('data-lang');

            if (typeof I18n !== 'undefined') {
                I18n.setLanguage(lang);
                // Re-render header with new language
                renderHeader(window.location.pathname.includes('about') ? 'about' : 'home');
            }

            dropdown.classList.remove('active');
        });
    });
}

// Auto-render on page load
document.addEventListener('DOMContentLoaded', function() {
    // Detect current page from URL
    const currentPage = window.location.pathname.includes('about') ? 'about' : 'home';
    renderHeader(currentPage);
});

// Listen for language changes
if (typeof window !== 'undefined') {
    window.addEventListener('languageChanged', function() {
        const currentPage = window.location.pathname.includes('about') ? 'about' : 'home';
        renderHeader(currentPage);
    });
}
