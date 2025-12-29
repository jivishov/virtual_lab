// ===== REUSABLE HEADER COMPONENT =====
// This file provides a consistent header across all pages
// Simply include this script in any HTML page to get the header

function renderHeader(currentPage = 'home') {
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
                            <h1 class="main-title">Virtual Laboratory</h1>
                            <p class="subtitle">Interactive science experiments and simulations for hands-on learning</p>
                        </div>
                    </a>
                </div>
                <div class="header-right">
                    <nav class="header-nav">
                        <a href="index.html" class="header-nav-link ${currentPage === 'home' ? 'active' : ''}">Home</a>
                        <a href="about.html" class="header-nav-link ${currentPage === 'about' ? 'active' : ''}">About</a>
                    </nav>
                    <div class="header-stats">
                        <div class="header-stat">
                            <span class="header-stat-number">3</span>
                            <span class="header-stat-label">Labs</span>
                        </div>
                        <div class="header-stat">
                            <span class="header-stat-number">1</span>
                            <span class="header-stat-label">Simulations</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const headerElement = document.querySelector('.header');
    if (headerElement) {
        headerElement.innerHTML = headerHTML;
    }
}

// Auto-render on page load
document.addEventListener('DOMContentLoaded', function() {
    // Detect current page from URL
    const currentPage = window.location.pathname.includes('about') ? 'about' : 'home';
    renderHeader(currentPage);
});
